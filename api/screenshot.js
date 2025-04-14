import { initBrowser, screenshotPage } from "../lib/core.js";

export default async function handler(req, res) {
  const { url, timeout = 15000 } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    const browser = await initBrowser();
    const image = await screenshotPage(browser, url, timeout);
    res.set("Content-Type", "image/jpeg");
    res.status(200).send(image);
  } catch (error) {
    console.error("Error rendering page:", error);
    res.status(500).json({ error: error.message });
  }
}
