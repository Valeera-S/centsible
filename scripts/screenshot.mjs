// Drives the local Edge/Chrome over CDP to screenshot the running app.
// Usage: node scripts/screenshot.mjs <url> <outfile> [width] [height] [seed|seed-zh]
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const [url, outfile, widthArg, heightArg, seedDemo] = process.argv.slice(2);
if (!url || !outfile) {
  console.error('usage: node scripts/screenshot.mjs <url> <outfile> [width] [height] [seedDemo]');
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

// Modern headless, not 'shell': the shell mode skips painting some SVG chart
// geometry (Recharts bars exist in the DOM but never render).
const browser = await puppeteer.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({
    width: Number(widthArg ?? 1280),
    height: Number(heightArg ?? 1200),
    deviceScaleFactor: 1,
  });
  page.on('console', (msg) => console.log(`[console:${msg.type()}]`, msg.text()));
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

  if (seedDemo === 'seed' || seedDemo === 'seed-zh') {
    // Demo data: enough variety to exercise ring, donut, and trend.
    await page.evaluate(async () => {
      const today = new Date();
      const iso = (day) =>
        `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const open = indexedDB.open('centsible');
      const db = await new Promise((resolve, reject) => {
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      const rows = [
        ['rent', 90000, 1, 'June rent'],
        ['dining', 1738, 2, 'lunch'],
        ['dining', 384, 2, 'boba'],
        ['groceries', 10376, 3, 'weekly groceries'],
        ['shopping', 10452, 5, 'Target'],
        ['health', 700, 6, 'CVS'],
        ['dining', 1268, 8, 'lunch'],
        ['bills', 510, 9, 'phone plan'],
        ['groceries', 3254, 10, 'groceries'],
        ['entertainment', 999, 10, 'streaming'],
      ];
      const tx = db.transaction('transactions', 'readwrite');
      const store = tx.objectStore('transactions');
      const now = Date.now();
      for (const [categoryId, amountCents, day, note] of rows) {
        store.put({
          id: crypto.randomUUID(),
          type: 'expense',
          amountCents,
          categoryId,
          date: iso(day),
          note,
          source: 'manual',
          createdAt: now,
          updatedAt: now,
        });
      }
      store.put({
        id: crypto.randomUUID(),
        type: 'income',
        amountCents: 240000,
        categoryId: 'stipend',
        date: iso(1),
        note: 'TA stipend',
        source: 'manual',
        createdAt: now,
        updatedAt: now,
      });
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    });
    if (seedDemo === 'seed-zh') {
      await page.evaluate(async () => {
        const open = indexedDB.open('centsible');
        const db = await new Promise((resolve, reject) => {
          open.onsuccess = () => resolve(open.result);
          open.onerror = () => reject(open.error);
        });
        const tx = db.transaction('settings', 'readwrite');
        const store = tx.objectStore('settings');
        const current = await new Promise((resolve) => {
          const req = store.get('singleton');
          req.onsuccess = () => resolve(req.result);
        });
        store.put({ ...current, locale: 'zh' });
        await new Promise((resolve) => {
          tx.oncomplete = resolve;
        });
      });
    }
    await page.reload({ waitUntil: 'networkidle0' });
  }

  await new Promise((resolve) => setTimeout(resolve, 1500));
  await page.screenshot({ path: outfile, fullPage: true });
  console.log(`saved ${outfile}`);
} finally {
  await browser.close();
}
