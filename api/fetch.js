import { initBrowser, getPageData } from "../lib/core.js";

export default async function handler(req, res) {
  const { url, timeout = 15000 } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

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
    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching page data:", error);
    if (browser) await browser.close().catch(console.error);
    return res.status(500).json({
      error: "Failed to fetch page data",
      message: error.message,
    });
  }
}
