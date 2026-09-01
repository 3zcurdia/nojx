import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer";

import { getScrapedData } from "../lib/core.js";
import { scrapeData, validateSelectors } from "../lib/scrape.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.join(__dirname, "..", "bin", "cli.js");

function createFakePage(overrides = {}) {
  return {
    setViewport: mock.fn(async () => {}),
    setUserAgent: mock.fn(async () => {}),
    setDefaultNavigationTimeout: mock.fn(() => {}),
    setDefaultTimeout: mock.fn(() => {}),
    goto: mock.fn(async () => {}),
    content: mock.fn(async () => "<html>mock</html>"),
    evaluate: mock.fn(async () => ({})),
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

function spawnCli(args) {
  return new Promise((resolve) => {
    const proc = spawn("node", [cliPath, ...args], { stdio: "pipe" });
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

describe("validateSelectors", () => {
  it("accepts valid selectors", () => {
    assert.doesNotThrow(() =>
      validateSelectors({
        title: { css: "h1", type: "value", value: "text" },
        products: { css: ".p", type: "list", value: "text" },
      }),
    );
  });

  it("throws when css missing", () => {
    assert.throws(
      () => validateSelectors({ title: { type: "value" } }),
      /requires a "css" string/,
    );
  });

  it("throws on invalid type", () => {
    assert.throws(
      () => validateSelectors({ x: { css: "div", type: "bad" } }),
      /invalid type/,
    );
  });

  it("throws on empty object", () => {
    assert.throws(() => validateSelectors({}), /non-empty object/);
  });

  it("throws on empty fields", () => {
    assert.throws(
      () => validateSelectors({ x: { css: "div", fields: {} } }),
      /empty "fields"/,
    );
  });

  it("validates nested fields recursively", () => {
    assert.throws(
      () =>
        validateSelectors({
          product: {
            css: ".p",
            type: "value",
            fields: { name: { type: "value" } },
          },
        }),
      /requires a "css" string/,
    );
  });

  it("accepts nested fields", () => {
    assert.doesNotThrow(() =>
      validateSelectors({
        product: {
          css: ".p",
          type: "value",
          fields: {
            name: { css: ".name", value: "text" },
            price: { css: ".price", value: "attr:href" },
          },
        },
      }),
    );
  });
});

describe("scrapeData", () => {
  it("validates and calls page.evaluate", async () => {
    const page = createFakePage({
      evaluate: mock.fn(async (fn, defs) => {
        assert.deepStrictEqual(defs, { title: { css: "h1" } });
        return { title: "hello" };
      }),
    });
    const result = await scrapeData(page, { title: { css: "h1" } });
    assert.deepStrictEqual(result, { title: "hello" });
    assert.equal(page.evaluate.mock.calls.length, 1);
  });

  it("throws on invalid selectors before evaluate", async () => {
    const page = createFakePage();
    await assert.rejects(
      () => scrapeData(page, { bad: { type: "value" } }),
      /requires a "css" string/,
    );
    assert.equal(page.evaluate.mock.calls.length, 0);
  });
});

describe("getScrapedData", () => {
  it("prepares page, scrapes, and closes page", async () => {
    const page = createFakePage({
      evaluate: mock.fn(async () => ({ title: "hi" })),
    });
    const browser = createFakeBrowser(page);
    const result = await getScrapedData(browser, "http://example.com", {
      title: { css: "h1" },
    });
    assert.equal(browser.newPage.mock.calls.length, 1);
    assert.equal(page.goto.mock.calls[0].arguments[0], "http://example.com");
    assert.equal(page.evaluate.mock.calls.length, 1);
    assert.equal(page.close.mock.calls.length, 1);
    assert.deepStrictEqual(result.data, { title: "hi" });
  });

  it("propagates timeout", async () => {
    const page = createFakePage({
      evaluate: mock.fn(async () => ({})),
    });
    const browser = createFakeBrowser(page);
    await getScrapedData(
      browser,
      "http://example.com",
      { title: { css: "h1" } },
      9999,
    );
    assert.equal(page.goto.mock.calls[0].arguments[1].timeout, 9999);
  });
});

describe("scrapeData integration", () => {
  it("extracts value text", { timeout: 30000 }, async () => {
    const browser = await puppeteer.launch({
      args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"],
    });
    try {
      const html = `<html><body><h1 class="page-title">Hello World</h1></body></html>`;
      const dataUrl = "data:text/html," + encodeURIComponent(html);
      const result = await getScrapedData(browser, dataUrl, {
        title: { css: "h1.page-title", type: "value", value: "text" },
      });
      assert.equal(result.data.title, "Hello World");
    } finally {
      await browser.close();
    }
  });

  it("extracts list text", { timeout: 30000 }, async () => {
    const browser = await puppeteer.launch({
      args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"],
    });
    try {
      const html = `<html><body><ul><li class="item">a</li><li class="item">b</li></ul></body></html>`;
      const dataUrl = "data:text/html," + encodeURIComponent(html);
      const result = await getScrapedData(browser, dataUrl, {
        items: { css: ".item", type: "list", value: "text" },
      });
      assert.deepStrictEqual(result.data.items, ["a", "b"]);
    } finally {
      await browser.close();
    }
  });

  it("extracts attr via attr: syntax", { timeout: 30000 }, async () => {
    const browser = await puppeteer.launch({
      args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"],
    });
    try {
      const html = `<html><body><img class="pic" src="https://example.com/a.jpg"></body></html>`;
      const dataUrl = "data:text/html," + encodeURIComponent(html);
      const result = await getScrapedData(browser, dataUrl, {
        src: { css: "img.pic", type: "value", value: "attr:src" },
      });
      assert.equal(result.data.src, "https://example.com/a.jpg");
    } finally {
      await browser.close();
    }
  });

  it(
    "extracts attr via value:attr + attr field",
    { timeout: 30000 },
    async () => {
      const browser = await puppeteer.launch({
        args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"],
      });
      try {
        const html = `<html><body><a class="link" href="/foo">x</a></body></html>`;
        const dataUrl = "data:text/html," + encodeURIComponent(html);
        const result = await getScrapedData(browser, dataUrl, {
          href: { css: "a.link", type: "value", value: "attr", attr: "href" },
        });
        assert.equal(result.data.href, "/foo");
      } finally {
        await browser.close();
      }
    },
  );

  it("extracts html", { timeout: 30000 }, async () => {
    const browser = await puppeteer.launch({
      args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"],
    });
    try {
      const html = `<html><body><div class="desc"><b>bold</b> text</div></body></html>`;
      const dataUrl = "data:text/html," + encodeURIComponent(html);
      const result = await getScrapedData(browser, dataUrl, {
        desc: { css: ".desc", type: "value", value: "html" },
      });
      assert.ok(result.data.desc.includes("<b>bold</b>"));
    } finally {
      await browser.close();
    }
  });

  it(
    "extracts nested list with fields (product page)",
    { timeout: 30000 },
    async () => {
      const browser = await puppeteer.launch({
        args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"],
      });
      try {
        const html = `
          <html><body>
            <h1 class="page-title">My Product</h1>
            <div class="products">
              <div class="product"><span class="name">A</span><span class="price">10</span><a href="/a">link</a></div>
              <div class="product"><span class="name">B</span><span class="price">20</span><a href="/b">link</a></div>
            </div>
          </body></html>`;
        const dataUrl = "data:text/html," + encodeURIComponent(html);
        const result = await getScrapedData(browser, dataUrl, {
          title: { css: "h1.page-title", type: "value", value: "text" },
          products: {
            css: ".product",
            type: "list",
            fields: {
              name: { css: ".name", value: "text" },
              price: { css: ".price", value: "text" },
              url: { css: "a", value: "attr:href" },
            },
          },
        });
        assert.equal(result.data.title, "My Product");
        assert.equal(result.data.products.length, 2);
        assert.deepStrictEqual(result.data.products[0], {
          name: "A",
          price: "10",
          url: "/a",
        });
        assert.deepStrictEqual(result.data.products[1], {
          name: "B",
          price: "20",
          url: "/b",
        });
      } finally {
        await browser.close();
      }
    },
  );

  it("extracts nested value with fields", { timeout: 30000 }, async () => {
    const browser = await puppeteer.launch({
      args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"],
    });
    try {
      const html = `<html><body><div class="product"><span class="name">Solo</span><span class="price">99</span></div></body></html>`;
      const dataUrl = "data:text/html," + encodeURIComponent(html);
      const result = await getScrapedData(browser, dataUrl, {
        product: {
          css: ".product",
          type: "value",
          fields: {
            name: { css: ".name", value: "text" },
            price: { css: ".price", value: "text" },
          },
        },
      });
      assert.deepStrictEqual(result.data.product, {
        name: "Solo",
        price: "99",
      });
    } finally {
      await browser.close();
    }
  });

  it(
    "returns null for missing value and [] for missing list",
    { timeout: 30000 },
    async () => {
      const browser = await puppeteer.launch({
        args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"],
      });
      try {
        const html = `<html><body><p>hi</p></body></html>`;
        const dataUrl = "data:text/html," + encodeURIComponent(html);
        const result = await getScrapedData(browser, dataUrl, {
          missing: { css: ".nope", type: "value", value: "text" },
          missingList: { css: ".nope", type: "list", value: "text" },
        });
        assert.equal(result.data.missing, null);
        assert.deepStrictEqual(result.data.missingList, []);
      } finally {
        await browser.close();
      }
    },
  );

  it("handles deep nesting", { timeout: 30000 }, async () => {
    const browser = await puppeteer.launch({
      args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"],
    });
    try {
      const html = `<html><body>
          <div class="outer"><div class="inner"><span class="leaf">deep</span></div></div>
        </body></html>`;
      const dataUrl = "data:text/html," + encodeURIComponent(html);
      const result = await getScrapedData(browser, dataUrl, {
        outer: {
          css: ".outer",
          type: "value",
          fields: {
            inner: {
              css: ".inner",
              type: "value",
              fields: { leaf: { css: ".leaf", value: "text" } },
            },
          },
        },
      });
      assert.deepStrictEqual(result.data.outer, { inner: { leaf: "deep" } });
    } finally {
      await browser.close();
    }
  });
});

describe("CLI scrape", () => {
  it("outputs JSON via --scrape", { timeout: 30000 }, async () => {
    const html = `<html><body><h1 class="page-title">CLI Title</h1><div class="product"><span class="name">X</span></div></body></html>`;
    const server = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    try {
      const selectors = JSON.stringify({
        title: { css: "h1.page-title", type: "value", value: "text" },
        products: {
          css: ".product",
          type: "list",
          fields: { name: { css: ".name", value: "text" } },
        },
      });
      const { code, stdout } = await spawnCli([
        `http://127.0.0.1:${port}`,
        "--scrape",
        selectors,
      ]);
      assert.equal(code, 0);
      const parsed = JSON.parse(stdout);
      assert.equal(parsed.title, "CLI Title");
      assert.deepStrictEqual(parsed.products, [{ name: "X" }]);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("outputs JSON via --scrape-file", { timeout: 30000 }, async () => {
    const html = `<html><body><h1>File Title</h1></body></html>`;
    const server = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nojx-"));
    const filePath = path.join(tmpDir, "selectors.json");
    fs.writeFileSync(
      filePath,
      JSON.stringify({ title: { css: "h1", type: "value", value: "text" } }),
    );
    try {
      const { code, stdout } = await spawnCli([
        `http://127.0.0.1:${port}`,
        "--scrape-file",
        filePath,
      ]);
      assert.equal(code, 0);
      const parsed = JSON.parse(stdout);
      assert.equal(parsed.title, "File Title");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("errors when --scrape and --colors are combined", async () => {
    const { code, stderr } = await spawnCli([
      "http://127.0.0.1:1",
      "--scrape",
      '{"a":{"css":"h1"}}',
      "--colors",
    ]);
    assert.equal(code, 1);
    assert.ok(stderr.includes("mutually exclusive"));
  });

  it("errors when --scrape and --scrape-file are combined", async () => {
    const { code, stderr } = await spawnCli([
      "http://127.0.0.1:1",
      "--scrape",
      '{"a":{"css":"h1"}}',
      "--scrape-file",
      "/tmp/x.json",
    ]);
    assert.equal(code, 1);
    assert.ok(stderr.includes("mutually exclusive"));
  });

  it("errors on invalid JSON for --scrape", async () => {
    const html = `<html><body>hi</body></html>`;
    const server = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    try {
      const { code, stderr } = await spawnCli([
        `http://127.0.0.1:${port}`,
        "--scrape",
        "{bad",
      ]);
      assert.equal(code, 1);
      assert.ok(stderr.includes("Invalid JSON"));
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("errors when selector missing css", async () => {
    const html = `<html><body>hi</body></html>`;
    const server = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    try {
      const { code, stderr } = await spawnCli([
        `http://127.0.0.1:${port}`,
        "--scrape",
        JSON.stringify({ bad: { type: "value" } }),
      ]);
      assert.equal(code, 1);
      assert.ok(stderr.includes('requires a "css"'));
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("errors when --scrape-file path missing", async () => {
    const { code, stderr } = await spawnCli([
      "http://127.0.0.1:1",
      "--scrape-file",
      "/nonexistent/path.json",
    ]);
    assert.equal(code, 1);
    assert.ok(stderr.includes("Error:"));
  });
});
