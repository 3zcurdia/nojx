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
