import { initBrowser } from "./_browser.js";
import { screenshotPage } from "../lib/core.js";

export default async function handler(req, res) {
  const { url, timeout = 15000 } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  if (!browser) {
    await initBrowser();
    let retries = 0;
    while (!browser && retries < 3) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (!browser && !isInitializing) {
        await initBrowser();
      }
      retries++;
    }

    if (!browser) {
      throw new Error("Could not initialize browser after multiple attempts");
    }
  }

  try {
    const image = await screenshotPage(browser, url, timeout);
    res.set("Content-Type", "image/jpeg");
    res.status(200).send(image);
  } catch (error) {
    console.error("Error rendering page:", error);
    res.status(500).json({ error: error.message });
  }
}
