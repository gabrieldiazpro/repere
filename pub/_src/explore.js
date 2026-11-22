// Repérage : capture (viewport mobile 720×1280, dsf 1) des écrans démo candidats.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://localhost:4200';
const OUT = process.argv[2];
const pages = (process.argv[3] || '').split(',').filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
  const ctx = await b.newContext({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem('repere.install.dismissed', '1'); } catch {} });
  const p = await ctx.newPage();
  for (const u of pages) {
    const name = u.replace(/[^a-z0-9]+/gi, '_').slice(0, 60);
    try {
      await p.goto(BASE + u, { waitUntil: 'networkidle', timeout: 60000 });
      await p.waitForTimeout(1500);
      await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
      const h = await p.evaluate(() => document.documentElement.scrollHeight);
      console.log(name, h);
    } catch (e) { console.log('ERR', u, e.message.slice(0, 100)); }
  }
  await b.close();
})();
