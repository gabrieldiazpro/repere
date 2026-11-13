// Génère les icônes PWA à partir de docs/logo.svg avec le Chromium de Playwright.
// Usage : node src/components/app/generate-icons.mjs  (depuis /home/claude/auditia/app)
// Sorties : public/icons/icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon-180.png
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '../../..');
const out = resolve(appRoot, 'public/icons');
const logoPath = resolve(appRoot, '../docs/logo.svg');
mkdirSync(out, { recursive: true });

const require = createRequire(import.meta.url);
let chromium;
for (const p of ['playwright', '/opt/npm-tools/node_modules/playwright', 'playwright-core', '/opt/npm-tools/node_modules/playwright-core']) {
  try { ({ chromium } = require(p)); break; } catch { /* essai suivant */ }
}
if (!chromium) throw new Error('Playwright introuvable');

const svg = readFileSync(logoPath, 'utf8')
  .replace(/<title>.*?<\/title>/s, '')
  .replace(/\swidth="64"\s+height="64"/, '');
const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

// any : le logo tel quel (coins arrondis, fond transparent autour).
const anySvg = (s) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${s}" height="${s}">${inner}</svg>`;
// maskable / apple : fond plein carré (pas de transparence) ; motif réduit à 80 % (zone de sécurité ≥ 10 % par côté).
const fullSvg = (s, scale) => {
  const motif = inner.replace(/<rect[^>]*\/>/, '');
  const t = (64 * (1 - scale)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${s}" height="${s}"><rect width="64" height="64" fill="#3730A3"/><g transform="translate(${t} ${t}) scale(${scale})">${motif}</g></svg>`;
};

const jobs = [
  { file: 'icon-192.png', size: 192, svg: anySvg(192) },
  { file: 'icon-512.png', size: 512, svg: anySvg(512) },
  { file: 'maskable-512.png', size: 512, svg: fullSvg(512, 0.8) },
  { file: 'apple-touch-icon-180.png', size: 180, svg: fullSvg(180, 0.9) },
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const j of jobs) {
    await page.setViewportSize({ width: j.size, height: j.size });
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${j.svg}</body></html>`);
    await page.locator('svg').screenshot({ path: resolve(out, j.file), omitBackground: true });
    console.log('ok', j.file);
  }
} finally {
  await browser.close();
}
