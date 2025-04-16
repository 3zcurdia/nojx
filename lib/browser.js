import puppeteer from "puppeteer";
import puppeteerCore from "puppeteer-core";
import chromium from "@sparticuz/chromium";

export async function initBrowser() {
  let browser = null;
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
  }
}
