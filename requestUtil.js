const puppeteer = require("puppeteer");

let browser;
const pagePool = [];
const maxPages = 5; // Adjust this based on your system's capabilities

async function initBrowser() {
  browser = await puppeteer.launch();
}

async function getPage() {
  if (pagePool.length > 0) {
    return pagePool.pop();
  }
  if (pagePool.length < maxPages) {
    const page = await browser.newPage();
    await setupPage(page);
    return page;
  }
  // Wait for a page to become available
  await new Promise((resolve) => setTimeout(resolve, 100));
  return getPage();
}

async function releasePage(page) {
  pagePool.push(page);
}

async function setupPage(page) {
  await page.setExtraHTTPHeaders({
    accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "accept-language": "en-GB,en;q=0.9",
    "cache-control": "no-cache",
    cookie:
      "__cf_bm=r1PHEOMX23xRusL.mG8YqRBZTRWzJwF6ygnw6W2yglU-1728047289-1.0.1.1-H0RjjnkLNblr.soEp.XjnnYepSGzcEITpatBCVpGCmkdPPHUlOwGJrw9U.RPNdIXFpIbrFMGrvWW4ZVpV.FK1Q",
    pragma: "no-cache",
    priority: "u=0, i",
    "sec-ch-ua":
      '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "upgrade-insecure-requests": "1",
  });

  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
  );
}

async function makeRequest(url) {
  const page = await getPage();
  try {
    const response = await page.goto(url, { waitUntil: "networkidle0" });
    const buffer = await response.buffer();
    return buffer;
  } finally {
    await releasePage(page);
  }
}

async function closeBrowser() {
  if (browser) {
    await browser.close();
  }
}

module.exports = { makeRequest, initBrowser, closeBrowser };
