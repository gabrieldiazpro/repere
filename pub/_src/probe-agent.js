// Repérage du parcours agent : ouvrir la première proposition et capturer.
const { chromium } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
  const ctx = await b.newContext({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem('repere.install.dismissed', '1'); } catch {} });
  const p = await ctx.newPage();
  await p.goto('http://localhost:4200/app/agent?compte=demo', { waitUntil: 'networkidle' });
  await p.getByText('Relire la première proposition').first().click({ timeout: 5000 }).catch((e) => console.log('click1', e.message.slice(0, 80)));
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/agent-1.png`, fullPage: true });
  const btns = await p.$$eval('button,a', (bs) => bs.map((b) => b.textContent.trim()).filter(Boolean));
  console.log(JSON.stringify(btns));
  await b.close();
})();
