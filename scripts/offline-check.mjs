// Proves the PWA works offline: loads the production preview, waits for the
// service worker to control the page, cuts the network, reloads, and checks
// the app still renders. Usage: node scripts/offline-check.mjs <url>
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const url = process.argv[2];
if (!url) {
  console.error('usage: node scripts/offline-check.mjs <url>');
  process.exit(1);
}

const candidates = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];
const executablePath = candidates.find((p) => existsSync(p));
if (!executablePath) {
  console.error('No Edge/Chrome executable found');
  process.exit(1);
}

const browser = await puppeteer.launch({ executablePath, headless: true });
let failed = false;
try {
  const page = await browser.newPage();
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));

  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, {
    timeout: 20000,
  });
  console.log('service worker controls the page');

  const manifestHref = await page.$eval('link[rel="manifest"]', (el) => el.href);
  console.log(`manifest: ${manifestHref}`);

  await page.setOfflineMode(true);
  await page.reload({ waitUntil: 'load', timeout: 30000 });
  const title = await page.title();
  const heading = await page
    .waitForSelector('.app-name', { timeout: 15000 })
    .then((el) => el.evaluate((node) => node.textContent));
  if (title === 'Centsible' && heading === 'Centsible') {
    console.log('offline reload OK: app shell rendered without network');
  } else {
    console.error(`offline reload FAILED: title=${title} heading=${heading}`);
    failed = true;
  }
} catch (error) {
  console.error('offline check FAILED:', error.message);
  failed = true;
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
