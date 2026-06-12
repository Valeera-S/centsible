// Rasterizes public/icon.svg into the PWA png set using the local browser.
import puppeteer from 'puppeteer-core';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

const svg = readFileSync(resolve('public/icon.svg'), 'utf8');
// Maskable icons must keep content inside the central 80% safe zone.
const maskableSvg = svg
  .replace(
    '<rect width="512" height="512" fill="#f6f1e7"/>',
    '<rect width="512" height="512" fill="#f6f1e7"/><g transform="translate(51.2 51.2) scale(0.8)">',
  )
  .replace('</svg>', '</g></svg>');

const targets = [
  { file: 'public/pwa-192.png', size: 192, content: svg },
  { file: 'public/pwa-512.png', size: 512, content: svg },
  { file: 'public/maskable-512.png', size: 512, content: maskableSvg },
];

const browser = await puppeteer.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage();
  for (const target of targets) {
    await page.setViewport({ width: target.size, height: target.size, deviceScaleFactor: 1 });
    const html = `<!doctype html><html><body style="margin:0">${target.content.replace(
      '<svg ',
      `<svg width="${target.size}" height="${target.size}" `,
    )}</body></html>`;
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: target.file, omitBackground: false });
    console.log(`wrote ${target.file}`);
  }
} finally {
  await browser.close();
}
