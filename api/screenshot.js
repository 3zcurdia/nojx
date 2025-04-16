import { initBrowser } from "../lib/browser.js";
// import { screenshotPage } from "../lib/core.js";

export default async function handler(req, res) {
  const { url, timeout = 15000 } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  let browser = await initBrowser();
  if (!browser) {
    browser = await initBrowser();
    let retries = 0;
    while (!browser && retries < 3) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (!browser && !isInitializing) {
        browser = await initBrowser();
      }
      retries++;
    }
    throw new Error("Could not initialize browser after multiple attempts");
  }

  res.status(200).json({ url: url });
}

// if (!browser) {
//   await initBrowser();
//   let retries = 0;
//   while (!browser && retries < 3) {
//     await new Promise((resolve) => setTimeout(resolve, 2000));
//     if (!browser && !isInitializing) {
//       await initBrowser();
//     }
//     retries++;
//   }

// }

// try {
//   const image = await screenshotPage(browser, url, timeout);
//   res.set("Content-Type", "image/jpeg");
//   res.status(200).send(image);
// } catch (error) {
//   console.error("Error rendering page:", error);
//   res.status(500).json({ error: error.message });
// }
