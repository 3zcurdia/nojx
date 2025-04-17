#!/usr/bin/env node
import { startServer } from "../src/server.js";

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

const args = process.argv.slice(2);

if (args[0] === "server" || args[0] === "s") {
  startServer();
} else if (args[0]) {
  const url = args[0];
  const onlyColors = args.includes("--colors");

  try {
    const result = await fetchPageData(url);
    console.log(
      onlyColors ? JSON.stringify(result.colors, null, 2) : result.html,
    );
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
} else {
  console.error("Usage: nojx <url> [--colors] | nojx server");
}
