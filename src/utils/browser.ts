import puppeteer, { Browser, Page } from 'puppeteer';
import dotenv from 'dotenv';

dotenv.config();

let browser: Browser;
const pagePool: Page[] = [];
const maxPages = 5;

export async function initBrowser(): Promise<void> {
  browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

async function getPage(): Promise<Page> {
  if (pagePool.length > 0) {
    return pagePool.pop()!;
  }
  if (pagePool.length < maxPages) {
    const page = await browser.newPage();
    await setupPage(page);
    return page;
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
  return getPage();
}

async function releasePage(page: Page): Promise<void> {
  pagePool.push(page);
}

async function setupPage(page: Page): Promise<void> {
  const midjourneyToken = process.env.MIDJOURNEY_COOKIE;
  if (!midjourneyToken) {
    throw new Error('MIDJOURNEY_COOKIE is not set in the environment variables');
  }

  await page.setExtraHTTPHeaders({
    accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'accept-language': 'en-GB,en;q=0.9',
    'cache-control': 'no-cache',
    cookie: midjourneyToken,
    pragma: 'no-cache',
    'sec-ch-ua': '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'upgrade-insecure-requests': '1',
  });

  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
  );
}

export async function makeRequest(url: string): Promise<Buffer> {
  const page = await getPage();
  try {
    const response = await page.goto(url, { waitUntil: 'networkidle0' });
    if (!response) {
      throw new Error(`Failed to load ${url}`);
    }
    return await response.buffer();
  } finally {
    await releasePage(page);
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
  }
}
