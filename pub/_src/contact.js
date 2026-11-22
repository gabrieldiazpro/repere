// Planche contact : 6 images clés des reels + 12 visuels → ../planche.png
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const R = __dirname;
const vids = fs.readdirSync(path.join(R, 'frames')).filter((f) => f.endsWith('.png')).sort();
const vis = fs.readdirSync(path.join(R, '..', 'visuels')).filter((f) => f.endsWith('.png')).sort();
const cell = (src, label, w, h) => `<figure><img src="${src}" style="width:${w}px;height:${h}px"><figcaption>${label}</figcaption></figure>`;
const html = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="common.css"><style>
body{width:2400px;background:var(--canvas);color:var(--ink);padding:60px;overflow:visible}
h1{font:700 56px/1 var(--display);margin-bottom:10px} p{font:500 24px/1.4 var(--sans);color:var(--muted);margin-bottom:40px}
h2{font:700 34px/1 var(--display);margin:30px 0 22px}
.g{display:flex;flex-wrap:wrap;gap:28px} figure{background:#fff;border:1px solid var(--line);border-radius:18px;padding:14px;box-shadow:0 8px 24px rgba(27,31,46,.06)}
img{display:block;border-radius:10px;object-fit:cover} figcaption{font:600 20px/1.2 var(--sans);margin-top:10px;color:var(--ink)}
</style><body><h1>Repéré · créations Meta (V8)</h1><p>22 nov. 2026 · captures réelles des comptes de démonstration, données fictives étiquetées · ${vids.length} reels 1080×1920 + ${vis.length} visuels</p>
<h2>Reels 9:16 (image clé)</h2><div class="g">${vids.map((f) => cell('frames/' + f, f.replace('.png', '.mp4'), 320, 569)).join('')}</div>
<h2>Visuels 1:1 et 4:5</h2><div class="g">${vis.map((f) => cell('../visuels/' + f, f, f.startsWith('p') ? 400 : 400, f.startsWith('p') ? 500 : 400)).join('')}</div></body>`;
fs.writeFileSync(path.join(R, 'contact.html'), html);
(async () => {
  const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const p = await (await b.newContext({ viewport: { width: 2400, height: 1200 }, deviceScaleFactor: 1 })).newPage();
  await p.goto('file://' + path.join(R, 'contact.html')); await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(R, '..', 'planche.png'), fullPage: true });
  await b.close(); console.log('planche ok');
})();
