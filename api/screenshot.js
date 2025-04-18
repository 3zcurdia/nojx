import { initBrowser, getScreenshot } from "../lib/core.js";

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
    const screenshot = await getScreenshot(browser, url, timeout);
    await browser.close();
    res.setHeader("Content-Type", "image/jpeg");
    res.status(200).send(screenshot);
  } catch (error) {
    console.error("Error taking screenshot:", error);
    if (browser) await browser.close().catch(console.error);
    return res.status(500).json({
      error: "Failed to take screenshot",
      message: error.message,
    });
  }
}

// try {
//   const image = await screenshotPage(browser, url, timeout);
//   res.set("Content-Type", "image/jpeg");
//   res.status(200).send(image);
// } catch (error) {
//   console.error("Error rendering page:", error);
//   res.status(500).json({ error: error.message });
// }
