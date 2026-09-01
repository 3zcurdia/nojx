import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.join(__dirname, "..", "bin", "cli.js");

// Lazy loader for fetchPageData to avoid top-level side effect print.
// First import of bin/cli.js prints "NoJX v0.1.0" when no args; we silence it.
let cachedFetchPageData = null;
async function loadFetchPageData() {
  if (cachedFetchPageData) return cachedFetchPageData;
  const origLog = console.log;
  const origError = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    const mod = await import("../bin/cli.js");
    cachedFetchPageData = mod.fetchPageData;
  } finally {
    console.log = origLog;
    console.error = origError;
  }
  return cachedFetchPageData;
}

function createFakePage(overrides = {}) {
  return {
    setViewport: async () => {},
    setUserAgent: async () => {},
    setDefaultNavigationTimeout: () => {},
    setDefaultTimeout: () => {},
    goto: async () => {},
    content: async () => "<html>fake</html>",
    evaluate: async () => ({
      "background-colors": { "#ff0000": 1 },
      "foreground-colors": { "#00ff00": 1 },
      colors: { "#ff0000": 1, "#00ff00": 1 },
    }),
    screenshot: async () => Buffer.from("img"),
    close: async () => {},
    ...overrides,
  };
}

function createFakeBrowser(pageOverrides = {}) {
  const page = createFakePage(pageOverrides);
  const browser = {
    newPage: async () => page,
    close: mock.fn(async () => {}),
    _page: page,
  };
  return browser;
}

function withFastTimers(fn) {
  const originalSetTimeout = global.setTimeout;
  global.setTimeout = (cb, ms, ...args) => originalSetTimeout(cb, 0, ...args);
  return fn().finally(() => {
    global.setTimeout = originalSetTimeout;
  });
}

function spawnCli(args, options = {}) {
  return new Promise((resolve) => {
    const proc = spawn("node", [cliPath, ...args], {
      stdio: "pipe",
      ...options,
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
    proc.on("error", (err) => {
      resolve({ code: 1, stdout, stderr: stderr + err.message });
    });
  });
}

describe("fetchPageData", () => {
  it("returns data and closes browser on success", async (t) => {
    const fakeBrowser = createFakeBrowser();
    t.mock.method(puppeteer, "launch", async () => fakeBrowser);

    const fetchPageData = await loadFetchPageData();
    const data = await fetchPageData("http://example.com", 1234);

    assert.equal(data.html, "<html>fake</html>");
    assert.deepStrictEqual(data.colors, {
      "background-colors": { "#ff0000": 1 },
      "foreground-colors": { "#00ff00": 1 },
      colors: { "#ff0000": 1, "#00ff00": 1 },
    });
    assert.equal(fakeBrowser.close.mock.calls.length, 1);
  });

  it("retries when initBrowser returns null and eventually succeeds", async (t) => {
    const fakeBrowser = createFakeBrowser({
      content: async () => "<html>retry success</html>",
    });
    let callCount = 0;
    t.mock.method(puppeteer, "launch", async () => {
      callCount += 1;
      if (callCount < 3) throw new Error("launch fail");
      return fakeBrowser;
    });

    const origError = console.error;
    console.error = () => {};

    const fetchPageData = await loadFetchPageData();
    const data = await withFastTimers(() =>
      fetchPageData("http://example.com"),
    );

    console.error = origError;

    assert.equal(callCount, 3);
    assert.equal(data.html, "<html>retry success</html>");
    assert.equal(fakeBrowser.close.mock.calls.length, 1);
  });

  it("retries when initBrowser returns null via null return", async (t) => {
    let callCount = 0;
    const fakeBrowser = createFakeBrowser();
    // initBrowser returns null when launch throws; we simulate throw
    t.mock.method(puppeteer, "launch", async () => {
      callCount += 1;
      if (callCount <= 2) throw new Error("fail");
      return fakeBrowser;
    });

    const origError = console.error;
    console.error = () => {};

    const fetchPageData = await loadFetchPageData();
    const data = await withFastTimers(() =>
      fetchPageData("http://example.com"),
    );

    console.error = origError;

    assert.equal(callCount, 3);
    assert.ok(data.html);
  });

  it("throws after 3 failed initBrowser attempts", async (t) => {
    t.mock.method(puppeteer, "launch", async () => {
      throw new Error("launch fail");
    });

    const origError = console.error;
    console.error = () => {};

    const fetchPageData = await loadFetchPageData();

    await assert.rejects(
      () => withFastTimers(() => fetchPageData("http://example.com")),
      (err) => {
        assert.match(err.message, /Could not initialize browser/);
        return true;
      },
    );

    console.error = origError;
  });

  it("closes browser and rethrows when getPageData fails", async (t) => {
    const fakeBrowser = createFakeBrowser({
      goto: async () => {
        throw new Error("navigation failed");
      },
    });
    t.mock.method(puppeteer, "launch", async () => fakeBrowser);

    const fetchPageData = await loadFetchPageData();

    await assert.rejects(() => fetchPageData("http://example.com"), {
      message: "navigation failed",
    });

    assert.equal(fakeBrowser.close.mock.calls.length, 1);
  });

  it("closes browser when getPageData throws after successful prepare", async (t) => {
    const fakeBrowser = createFakeBrowser({
      content: async () => {
        throw new Error("content failed");
      },
    });
    t.mock.method(puppeteer, "launch", async () => fakeBrowser);

    const fetchPageData = await loadFetchPageData();

    await assert.rejects(() => fetchPageData("http://example.com"), {
      message: "content failed",
    });

    assert.equal(fakeBrowser.close.mock.calls.length, 1);
  });

  it("propagates timeout to getPageData", async (t) => {
    const fakeBrowser = createFakeBrowser();
    let capturedTimeout;
    fakeBrowser._page.goto = async (url, opts) => {
      capturedTimeout = opts.timeout;
    };
    t.mock.method(puppeteer, "launch", async () => fakeBrowser);

    const fetchPageData = await loadFetchPageData();
    await fetchPageData("http://example.com", 9999);

    assert.equal(capturedTimeout, 9999);
  });
});

describe("CLI", () => {
  it("prints version and usage when no URL is provided", async () => {
    const { code, stdout, stderr } = await spawnCli([]);

    assert.equal(code, 0);
    assert.ok(stdout.includes("NoJX v0.1.0"));
    assert.ok(stderr.includes("Usage: nojx <url> [--colors]"));
  });

  it("outputs html when given a URL", { timeout: 30000 }, async () => {
    const htmlContent = "<html><body><h1>hello nojx</h1></body></html>";
    const server = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(htmlContent);
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();

    try {
      const { code, stdout } = await spawnCli([`http://127.0.0.1:${port}`]);

      assert.equal(code, 0);
      assert.ok(stdout.includes("hello nojx"));
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("outputs JSON colors with --colors flag", { timeout: 30000 }, async () => {
    const htmlContent = `
        <html><body>
          <div style="background-color: rgb(255, 0, 0); color: rgb(0, 255, 0);">hello</div>
        </body></html>
      `;
    const server = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(htmlContent);
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();

    try {
      const { code, stdout } = await spawnCli([
        `http://127.0.0.1:${port}`,
        "--colors",
      ]);

      assert.equal(code, 0);
      const parsed = JSON.parse(stdout);
      assert.ok(parsed["background-colors"]);
      assert.ok(parsed["foreground-colors"]);
      assert.ok(parsed.colors);
      assert.equal(parsed["background-colors"]["#ff0000"], 1);
      assert.equal(parsed["foreground-colors"]["#00ff00"], 1);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("exits with code 1 on invalid URL", { timeout: 30000 }, async () => {
    const { code, stderr } = await spawnCli(["http://127.0.0.1:1"]);

    assert.equal(code, 1);
    assert.ok(stderr.includes("Error:"));
  });
});
