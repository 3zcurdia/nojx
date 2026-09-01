import puppeteer from "puppeteer";

import { scrapeData } from "./scrape.js";

export async function initBrowser() {
  try {
    return await puppeteer.launch({
      args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"],
    });
  } catch (error) {
    console.error("Error initializing browser:", error);
    return null;
  }
}

export async function getPageData(browser, url, timeout = 15000) {
  let page = await preparePage(browser, url, timeout);
  const html = await page.content();
  const colors = await extractColorSummary(page);
  await page.close();
  return { html: html, colors: colors };
}

export async function getScreenshot(browser, url, timeout = 15000) {
  let page = await preparePage(browser, url, timeout);
  let screenshot = await page.screenshot({ type: "jpeg", quality: 80 });
  await page.close();
  return screenshot;
}

export async function getScrapedData(browser, url, selectors, timeout = 15000) {
  let page = await preparePage(browser, url, timeout);
  const data = await scrapeData(page, selectors);
  await page.close();
  return { data };
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
    function toHex(color) {
      const rgba = color
        .replace(/^rgba?\(|\s+|\)$/g, "")
        .split(",")
        .map(Number);

      const [r, g, b, a] = rgba;
      if (r === 0 && g === 0 && b === 0) {
        return null;
      }
      if (rgba.length === 4 && a < 1) {
        return color;
      }

      return (
        "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")
      );
    }

    const bgMap = {};
    const fgMap = {};
    const allMap = {};
    const elements = Array.from(document.querySelectorAll("*"));
    elements.forEach((el) => {
      const styles = window.getComputedStyle(el);
      const bg = toHex(styles.getPropertyValue("background-color"));
      const fg = toHex(styles.getPropertyValue("color"));

      if (bg !== null) {
        bgMap[bg] = (bgMap[bg] || 0) + 1;
        allMap[bg] = (allMap[bg] || 0) + 1;
      }
      if (fg !== null) {
        fgMap[fg] = (fgMap[fg] || 0) + 1;
        allMap[fg] = (allMap[fg] || 0) + 1;
      }
    });
    return {
      "background-colors": bgMap,
      "foreground-colors": fgMap,
      colors: allMap,
    };
  });
}
