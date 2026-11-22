// Rendu des visuels statiques (statics.html?v=…) en PNG, dsf 1. Usage : node render-statics.js [nom,…]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const OUT = path.join(ROOT, '..', 'visuels');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage', '--allow-file-access-from-files'] });
  const page = await (await b.newContext({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 })).newPage();
  const url = (v) => 'file://' + path.join(ROOT, 'statics.html') + '?v=' + v;
  await page.goto(url('s1-avant-apres-titre'));
  const all = await page.evaluate(() => window.LIST);
  const names = process.argv[2] ? process.argv[2].split(',') : all;
  for (const n of names) {
    await page.goto(url(n));
    await page.waitForFunction(() => window.READY === true);
    const h = n.startsWith('p') ? 1350 : 1080;
    // contrôle : rien ne déborde du cadre
    const over = await page.evaluate((h) => [...document.querySelectorAll('.ad *')].filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > h + 1 || r.right > 1081; }).map((e) => e.className || e.tagName).slice(0, 5), h);
    await page.screenshot({ path: path.join(OUT, n + '.png'), clip: { x: 0, y: 0, width: 1080, height: h } });
    console.log(n, over.length ? 'DÉBORDE: ' + over.join(' | ') : 'ok');
  }
  await b.close();
})();
