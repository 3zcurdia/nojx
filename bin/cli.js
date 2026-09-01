#!/usr/bin/env node
import fs from "node:fs";

export async function fetchPageData(url, timeout = 15000) {
  const { initBrowser, getPageData } = await import("../lib/core.js");

  let browser = null;
  try {
    let retries = 0;
    while (!browser && retries < 3) {
      browser = await initBrowser();
      if (!browser) {
        retries++;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    if (!browser) {
      throw new Error("Could not initialize browser after multiple attempts");
    }

    const data = await getPageData(browser, url, timeout);
    await browser.close();
    return data;
  } catch (error) {
    if (browser) await browser.close().catch(console.error);
    throw error;
  }
}

export async function fetchScrapedData(url, selectors, timeout = 15000) {
  const { initBrowser, getScrapedData } = await import("../lib/core.js");

  let browser = null;
  try {
    let retries = 0;
    while (!browser && retries < 3) {
      browser = await initBrowser();
      if (!browser) {
        retries++;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    if (!browser) {
      throw new Error("Could not initialize browser after multiple attempts");
    }

    const data = await getScrapedData(browser, url, selectors, timeout);
    await browser.close();
    return data;
  } catch (error) {
    if (browser) await browser.close().catch(console.error);
    throw error;
  }
}

const args = process.argv.slice(2);

if (args[0]) {
  const url = args[0];
  const onlyColors = args.includes("--colors");
  const scrapeIdx = args.indexOf("--scrape");
  const scrapeFileIdx = args.indexOf("--scrape-file");
  const hasScrape = scrapeIdx !== -1;
  const hasScrapeFile = scrapeFileIdx !== -1;

  if (hasScrape && hasScrapeFile) {
    console.error("Error: --scrape and --scrape-file are mutually exclusive");
    process.exit(1);
  }

  if ((hasScrape || hasScrapeFile) && onlyColors) {
    console.error("Error: --scrape and --colors are mutually exclusive");
    process.exit(1);
  }

  if (hasScrape || hasScrapeFile) {
    let selectorsRaw;

    if (hasScrape) {
      if (
        scrapeIdx + 1 >= args.length ||
        args[scrapeIdx + 1].startsWith("--")
      ) {
        console.error("Error: --scrape requires a JSON string argument");
        process.exit(1);
      }
      selectorsRaw = args[scrapeIdx + 1];
    } else {
      if (
        scrapeFileIdx + 1 >= args.length ||
        args[scrapeFileIdx + 1].startsWith("--")
      ) {
        console.error("Error: --scrape-file requires a file path argument");
        process.exit(1);
      }
      const filePath = args[scrapeFileIdx + 1];
      try {
        selectorsRaw = fs.readFileSync(filePath, "utf8");
      } catch (err) {
        console.error("Error:", err.message);
        process.exit(1);
      }
    }

    let selectors;
    try {
      selectors = JSON.parse(selectorsRaw);
    } catch (err) {
      console.error("Error: Invalid JSON for selectors:", err.message);
      process.exit(1);
    }

    try {
      const { validateSelectors } = await import("../lib/scrape.js");
      validateSelectors(selectors);
    } catch (err) {
      console.error("Error:", err.message);
      process.exit(1);
    }

    try {
      const result = await fetchScrapedData(url, selectors);
      console.log(JSON.stringify(result.data, null, 2));
    } catch (err) {
      console.error("Error:", err.message);
      process.exit(1);
    }
  } else {
    try {
      const result = await fetchPageData(url);
      console.log(
        onlyColors ? JSON.stringify(result.colors, null, 2) : result.html,
      );
    } catch (err) {
      console.error("Error:", err.message);
      process.exit(1);
    }
  }
} else {
  console.log("NoJX v0.1.0");
  console.error(
    "Usage: nojx <url> [--colors] [--scrape <jsonString>] [--scrape-file <path>]",
  );
}
