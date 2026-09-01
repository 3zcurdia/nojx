import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import puppeteer from "puppeteer";

import { getPageData, getScreenshot, initBrowser } from "../lib/core.js";

function createFakePage(overrides = {}) {
  return {
    setViewport: mock.fn(async () => {}),
    setUserAgent: mock.fn(async () => {}),
    setDefaultNavigationTimeout: mock.fn(() => {}),
    setDefaultTimeout: mock.fn(() => {}),
    goto: mock.fn(async () => {}),
    content: mock.fn(async () => "<html>mock</html>"),
    evaluate: mock.fn(async () => ({
      "background-colors": { "#ff0000": 1 },
      "foreground-colors": { "#00ff00": 1 },
      colors: { "#ff0000": 1, "#00ff00": 1 },
    })),
    screenshot: mock.fn(async () => Buffer.from("fake-image")),
    close: mock.fn(async () => {}),
    ...overrides,
  };
}

function createFakeBrowser(page) {
  const fakePage = page || createFakePage();
  return {
    newPage: mock.fn(async () => fakePage),
    close: mock.fn(async () => {}),
    _page: fakePage,
  };
}

describe("initBrowser", () => {
  it("launches puppeteer with correct args and returns browser", async (t) => {
    const fakeBrowser = { close: async () => {} };
    let capturedArgs;
    t.mock.method(puppeteer, "launch", async (opts) => {
      capturedArgs = opts.args;
      return fakeBrowser;
    });

    const browser = await initBrowser();

    assert.strictEqual(browser, fakeBrowser);
    assert.ok(capturedArgs.includes("--no-sandbox"));
    assert.ok(capturedArgs.includes("--disable-dev-shm-usage"));
    assert.ok(capturedArgs.includes("--disable-gpu"));
  });

  it("returns null when puppeteer.launch throws", async (t) => {
    t.mock.method(puppeteer, "launch", async () => {
      throw new Error("launch failed");
    });

    const originalError = console.error;
    let logged = "";
    console.error = (...args) => {
      logged += args.join(" ");
    };

    const browser = await initBrowser();

    console.error = originalError;

    assert.strictEqual(browser, null);
    assert.ok(logged.includes("Error initializing browser"));
  });

  it("returns null and logs when launch rejects", async (t) => {
    t.mock.method(puppeteer, "launch", async () => {
      throw new Error("no chrome");
    });

    const originalError = console.error;
    console.error = () => {};

    const result = await initBrowser();

    console.error = originalError;

    assert.strictEqual(result, null);
  });
});

describe("getPageData", () => {
  it("prepares page, extracts html and colors, and closes page", async () => {
    const page = createFakePage();
    const browser = createFakeBrowser(page);

    const result = await getPageData(browser, "http://example.com", 1234);

    assert.equal(browser.newPage.mock.calls.length, 1);
    assert.deepStrictEqual(page.setViewport.mock.calls[0].arguments, [
      { width: 1280, height: 800 },
    ]);
    const ua = page.setUserAgent.mock.calls[0].arguments[0];
    assert.ok(ua.includes("Mozilla/5.0"));
    assert.equal(
      page.setDefaultNavigationTimeout.mock.calls[0].arguments[0],
      1234,
    );
    assert.equal(page.setDefaultTimeout.mock.calls[0].arguments[0], 1234);
    assert.equal(page.goto.mock.calls[0].arguments[0], "http://example.com");
    assert.deepStrictEqual(page.goto.mock.calls[0].arguments[1], {
      waitUntil: ["networkidle2", "domcontentloaded"],
      timeout: 1234,
    });
    assert.equal(page.content.mock.calls.length, 1);
    assert.equal(page.evaluate.mock.calls.length, 1);
    assert.equal(page.close.mock.calls.length, 1);
    assert.equal(result.html, "<html>mock</html>");
    assert.deepStrictEqual(result.colors, {
      "background-colors": { "#ff0000": 1 },
      "foreground-colors": { "#00ff00": 1 },
      colors: { "#ff0000": 1, "#00ff00": 1 },
    });
  });

  it("uses default timeout 15000 when not provided", async () => {
    const page = createFakePage();
    const browser = createFakeBrowser(page);

    await getPageData(browser, "http://example.com");

    assert.equal(
      page.setDefaultNavigationTimeout.mock.calls[0].arguments[0],
      15000,
    );
    assert.equal(page.setDefaultTimeout.mock.calls[0].arguments[0], 15000);
    assert.equal(page.goto.mock.calls[0].arguments[1].timeout, 15000);
  });

  it("propagates errors and does not swallow goto failures", async () => {
    const page = createFakePage({
      goto: mock.fn(async () => {
        throw new Error("navigation failed");
      }),
    });
    const browser = createFakeBrowser(page);

    await assert.rejects(() => getPageData(browser, "http://bad-url", 500), {
      message: "navigation failed",
    });
  });

  it(
    "integration: extracts real colors via puppeteer",
    { timeout: 30000 },
    async () => {
      const browser = await puppeteer.launch({
        args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"],
      });
      try {
        const html = `
        <html><body>
          <div style="background-color: rgb(255, 0, 0); color: rgb(0, 255, 0);">hello</div>
          <div style="background-color: #0000ff;">blue</div>
        </body></html>
      `;
        const dataUrl = "data:text/html," + encodeURIComponent(html);
        const result = await getPageData(browser, dataUrl);

        assert.ok(result.html.includes("hello"));
        assert.ok(result.colors["background-colors"]["#ff0000"] >= 1);
        assert.ok(result.colors["background-colors"]["#0000ff"] >= 1);
        assert.ok(result.colors["foreground-colors"]["#00ff00"] >= 1);
        assert.ok(result.colors.colors["#ff0000"] >= 1);
      } finally {
        await browser.close();
      }
    },
  );
});

describe("getScreenshot", () => {
  it("prepares page, takes jpeg screenshot, and closes page", async () => {
    const page = createFakePage();
    const browser = createFakeBrowser(page);

    const result = await getScreenshot(browser, "http://example.com", 2000);

    assert.equal(browser.newPage.mock.calls.length, 1);
    assert.deepStrictEqual(page.setViewport.mock.calls[0].arguments, [
      { width: 1280, height: 800 },
    ]);
    assert.equal(page.screenshot.mock.calls.length, 1);
    assert.deepStrictEqual(page.screenshot.mock.calls[0].arguments[0], {
      type: "jpeg",
      quality: 80,
    });
    assert.equal(page.close.mock.calls.length, 1);
    assert.ok(Buffer.isBuffer(result));
    assert.equal(result.toString(), "fake-image");
  });

  it("uses default timeout when not provided", async () => {
    const page = createFakePage();
    const browser = createFakeBrowser(page);

    await getScreenshot(browser, "http://example.com");

    assert.equal(
      page.setDefaultNavigationTimeout.mock.calls[0].arguments[0],
      15000,
    );
    assert.equal(page.goto.mock.calls[0].arguments[1].timeout, 15000);
  });

  it(
    "integration: captures screenshot via real browser",
    { timeout: 30000 },
    async () => {
      const browser = await puppeteer.launch({
        args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"],
      });
      try {
        const html = "<html><body><h1>hello screenshot</h1></body></html>";
        const dataUrl = "data:text/html," + encodeURIComponent(html);
        const buf = await getScreenshot(browser, dataUrl);

        assert.ok(buf instanceof Uint8Array || Buffer.isBuffer(buf));
        assert.ok(buf.length > 100);
        // JPEG magic bytes
        assert.equal(buf[0], 0xff);
        assert.equal(buf[1], 0xd8);
      } finally {
        await browser.close();
      }
    },
  );
});
