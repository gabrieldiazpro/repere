// Captures de l'app démo (localhost:4200) pour les créations publicitaires.
// Un seul Chromium, deviceScaleFactor 1, viewport mobile 720×1280.
// - stills/<nom>.png : pages entières (barres fixes masquées) pour les défilements montés ensuite ;
// - seq/<nom>/NNNN.jpg + seq/<nom>.json : séquences d'images (≈10 i/s) pour les interactions réelles.
// Usage : node capture.js [nom...]   (sans argument : tout)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:4200';
const OUT = path.join(__dirname, 'footage');
const STREAM = '/tmp/claude-0/-home-claude/1613138e-8209-5786-b4b6-a2bbf8070257/scratchpad/aui/rich.ndjson';
const W = 720, H = 1280;
const only = process.argv.slice(2);
const want = (n) => !only.length || only.includes(n);

const HIDE_FIXED = `(() => {
  const s = document.createElement('style'); s.id='__pubhide';
  s.textContent = '[data-pub-hidden]{display:none!important}';
  document.head.appendChild(s);
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if ((cs.position === 'fixed' || cs.position === 'sticky') && el.getBoundingClientRect().top > 200) el.setAttribute('data-pub-hidden','');
  }
})()`;

function replayInit({ lines, scale }) {
  const orig = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!url.includes('/api/v5/analysis') || (init && init.method !== 'POST')) return orig(input, init);
    const enc = new TextEncoder();
    const body = new ReadableStream({
      async start(c) {
        let prev = 0;
        for (const l of lines) {
          const e = JSON.parse(l);
          if (e.type === 'saved') continue;
          if (typeof e.t === 'number') { await new Promise((r) => setTimeout(r, Math.max(0, (e.t - prev) * scale))); prev = e.t; }
          c.enqueue(enc.encode(l + '\n'));
        }
        c.close();
      },
    });
    return new Response(body, { status: 200, headers: { 'content-type': 'application/x-ndjson; charset=utf-8' } });
  };
}

// Enregistreur de séquence : capture en boucle pendant que `act` s'exécute.
async function sequence(page, name, act) {
  const dir = path.join(OUT, 'seq', name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const frames = []; let running = true; const t0 = Date.now();
  const loop = (async () => {
    while (running) {
      const t = (Date.now() - t0) / 1000;
      const f = String(frames.length).padStart(4, '0') + '.jpg';
      await page.screenshot({ path: path.join(dir, f), type: 'jpeg', quality: 90 }).catch(() => {});
      frames.push({ f, t });
      const wait = 100 - ((Date.now() - t0) % 100);
      await new Promise((r) => setTimeout(r, wait));
    }
  })();
  const marks = [];
  await act((label) => marks.push({ label, t: (Date.now() - t0) / 1000 }));
  running = false; await loop;
  fs.writeFileSync(path.join(OUT, 'seq', name + '.json'), JSON.stringify({ frames, marks, w: W, h: H }, null, 0));
  console.log('seq', name, frames.length, 'images', ((Date.now() - t0) / 1000).toFixed(1) + 's', JSON.stringify(marks));
}

async function smoothScroll(page, px, ms) {
  await page.evaluate(([px, ms]) => new Promise((res) => {
    const start = performance.now(); const from = window.scrollY;
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    function step(now) { const t = Math.min(1, (now - start) / ms); window.scrollTo(0, from + px * ease(t)); if (t < 1) requestAnimationFrame(step); else res(); }
    requestAnimationFrame(step);
  }), [px, ms]);
}

const STILLS = [
  ['lundi-local', '/app?compte=demo'],
  ['reponses-local', '/app/reponses?compte=demo'],
  ['lundi-pme', '/app?compte=demo-pme'],
  ['reponses-pme', '/app/reponses?compte=demo-pme'],
  ['concurrents-pme', '/app/concurrents?compte=demo-pme'],
  ['trafic-ecom', '/app/trafic?compte=demo-ecom'],
  ['ventes-ecom', '/app/produits/ventes?compte=demo-ecom'],
  ['rapports-ecom', '/app/rapports?compte=demo-ecom'],
  ['lundi-agence', '/app?compte=demo-agence'],
  ['rapports-agence', '/app/rapports?compte=demo-agence'],
  ['agent-liste', '/app/agent?compte=demo'],
  ['verite-local', '/app/verite?compte=demo'],
];

(async () => {
  fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: 'no-preference', colorScheme: 'light' });
  await ctx.addInitScript(() => { try { localStorage.setItem('repere.install.dismissed', '1'); localStorage.setItem('theme', 'light'); } catch {} });
  const page = await ctx.newPage();

  for (const [name, url] of STILLS) {
    if (!want(name)) continue;
    await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(1800);
    await page.evaluate(HIDE_FIXED);
    await page.screenshot({ path: path.join(OUT, 'stills', name + '.png'), fullPage: true });
    console.log('still', name);
  }

  if (want('analyse')) {
    const lines = fs.readFileSync(STREAM, 'utf8').trim().split('\n');
    const p2 = await ctx.newPage();
    await p2.addInitScript(replayInit, { lines, scale: 2.5 });
    await p2.goto(BASE + '/analyse', { waitUntil: 'networkidle', timeout: 90000 });
    await p2.waitForTimeout(800);
    await sequence(p2, 'analyse', async (mark) => {
      await p2.waitForTimeout(500);
      mark('typing');
      const input = p2.locator('input[type=url], input[name=site], input[name=url], input[type=text]').first();
      await input.click();
      await input.pressSequentially('atelier-lumen.test', { delay: 70 });
      await p2.waitForTimeout(400);
      await p2.locator('input[type=checkbox]').first().check();
      await p2.waitForTimeout(500);
      mark('submit');
      await p2.click('button[type=submit]');
      await p2.waitForTimeout(200);
      mark('running');
      await p2.waitForSelector('#verdict', { timeout: 90000 }).catch(() => {});
      await p2.waitForTimeout(600);
      mark('verdict');
      await p2.evaluate(() => { const v = document.getElementById('verdict'); if (v) window.scrollTo({ top: v.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' }); });
      await p2.waitForTimeout(1500);
      await smoothScroll(p2, 700, 3000);
      await p2.waitForTimeout(800);
      mark('end');
    });
    await p2.close();
  }

  if (want('agent')) {
    await page.goto(BASE + '/app/agent?compte=demo', { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(1200);
    await sequence(page, 'agent', async (mark) => {
      await page.waitForTimeout(1200);
      mark('open');
      await page.getByText('Relire la première proposition').first().click();
      await page.waitForTimeout(1500);
      mark('diff');
      await smoothScroll(page, 560, 1800);
      await page.waitForTimeout(2200);
      mark('validate');
      await page.getByRole('button', { name: /Valider les 2 modifications/ }).click();
      await page.waitForTimeout(1800);
      mark('after');
      const apply = page.getByRole('button', { name: /^Appliquer/ }).first();
      if (await apply.count()) { await apply.click().catch(() => {}); await page.waitForTimeout(2500); mark('applied'); }
      await page.waitForTimeout(1500);
      mark('end');
    });
    await page.evaluate(HIDE_FIXED);
    await page.screenshot({ path: path.join(OUT, 'stills', 'agent-apres.png'), fullPage: true });
  }

  await browser.close();
})();
