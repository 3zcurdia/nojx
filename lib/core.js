import puppeteer from "puppeteer";
import puppeteerCore from "puppeteer-core";
import chromium from "@sparticuz/chromium";

let browser = null;
let isInitializing = false;

export async function initBrowser() {
  if (browser) return browser;

  if (isInitializing) {
    await waitForInit();
    return browser;
  }

  isInitializing = true;
  try {
    chromium.setGraphicsMode = false;

    if (process.env.NODE_ENV === "production") {
      browser = await puppeteerCore.launch({
        args: [
          ...chromium.args,
          "--disable-dev-shm-usage",
          "--no-sandbox",
          "--disable-gpu",
        ],
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: true,
        ignoreHTTPSErrors: true,
      });
    } else {
      browser = await puppeteer.launch({
        args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"],
      });
    }

    browser.on("disconnected", () => {
      browser = null;
      setTimeout(initBrowser, 1000);
    });
  } catch (error) {
    console.error("Error initializing browser:", error);
    browser = null;
    setTimeout(initBrowser, 10000);
  } finally {
    isInitializing = false;
  }
}

function waitForInit(retries = 10, delay = 500) {
  return new Promise((resolve, reject) => {
    const check = () => {
      if (!isInitializing) return resolve();
      if (retries-- <= 0)
        return reject(new Error("Timeout waiting for browser"));
      setTimeout(check, delay);
    };
    check();
  });
}

export async function loadPage(browser, url, timeout = 15000) {
  let page = null;
  try {
    page = await preparePage(browser, url, timeout);
    const html = await page.content();
    const colors = await extractColorSummary(page);
    return { html: html, colors: colors };
  } catch (error) {
    console.error(`Error during page rendering: ${error.message}`);
    throw error;
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (err) {
        console.error("Error closing page:", err);
      }
    }
  }
}

export async function screenshotPage(browser, url, timeout = 15000) {
  let page = null;
  try {
    page = await preparePage(browser, url, timeout);
    return await page.screenshot({ type: "jpeg", quality: 80 });
  } catch (error) {
    console.error(`Error during page rendering: ${error.message}`);
    throw error;
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (err) {
        console.error("Error closing page:", err);
      }
    }
  }
}

async function preparePage(browser, url, timeout = 15000) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  );
  await page.setDefaultNavigationTimeout(timeout);
  await page.setDefaultTimeout(timeout);
  await page.goto(url, {
    waitUntil: ["networkidle2", "domcontentloaded"],
    timeout,
  });
  return page;
}

async function extractColorSummary(page) {
  return await page.evaluate(() => {
    const bgMap = {};
    const fgMap = {};
    const allMap = {};
    const elements = Array.from(document.querySelectorAll("*"));
    elements.forEach((el) => {
      const styles = window.getComputedStyle(el);
      const bg = styles.getPropertyValue("background-color");
      const fg = styles.getPropertyValue("color");
      bgMap[bg] = (bgMap[bg] || 0) + 1;
      fgMap[fg] = (fgMap[fg] || 0) + 1;
      allMap[bg] = (allMap[bg] || 0) + 1;
      allMap[fg] = (allMap[fg] || 0) + 1;
    });
    return {
      "background-colors": bgMap,
      "foreground-colors": fgMap,
      colors: allMap,
    };
  });
}
