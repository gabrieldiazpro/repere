/* eslint-disable @typescript-eslint/no-require-imports -- script ponctuel hors application */
// Vidéo explicative complète (≈ 2 min) : analyse en 60 s sur un site fictif, puis l'application (comptes démo).
// L'analyse rejoue un VRAI flux enregistré sur le site fictif atelier-lumen.test (exploration réelle d'un faux serveur local).
// Usage : node scripts/videos/record-explication.js <base> <flux.ndjson>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:4200';
const STREAM = process.argv[3];
const OUT = path.join(__dirname, 'raw');
fs.mkdirSync(OUT, { recursive: true });
const W = 1280, H = 720;
const lines = fs.readFileSync(STREAM, 'utf8').trim().split('\n');

const CAPTION_JS = (text) => `(() => {
  let el = document.getElementById('__cap');
  if (!el) {
    el = document.createElement('div'); el.id = '__cap';
    el.style.cssText = 'position:fixed;left:50%;bottom:34px;transform:translateX(-50%);z-index:2147483646;background:rgba(15,23,42,.92);color:#fff;font:600 24px/1.3 system-ui,sans-serif;padding:14px 26px;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.25);max-width:1000px;text-align:center;transition:opacity .35s;opacity:0;pointer-events:none';
    document.body.appendChild(el);
  }
  el.textContent = ${JSON.stringify(text)};
  requestAnimationFrame(() => { el.style.opacity = '1'; });
})()`;

const CARD_JS = ([title, sub, small]) => {
  let el = document.getElementById('__card');
  if (!el) {
    el = document.createElement('div'); el.id = '__card';
    el.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:#1e1a5c;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:40px;opacity:0;transition:opacity .45s';
    document.body.appendChild(el);
  }
  el.innerHTML = '';
  const t = document.createElement('div'); t.textContent = title; t.style.cssText = 'font:800 54px/1.15 system-ui,sans-serif;max-width:1050px;letter-spacing:-.01em';
  const s = document.createElement('div'); s.textContent = sub; s.style.cssText = 'font:500 28px/1.35 system-ui,sans-serif;opacity:.88;max-width:950px';
  el.append(t, s);
  if (small) { const m = document.createElement('div'); m.textContent = small; m.style.cssText = 'margin-top:14px;font:500 18px/1.4 system-ui,sans-serif;opacity:.65'; el.append(m); }
  requestAnimationFrame(() => { el.style.opacity = '1'; });
};
const HIDE_CARD_JS = () => { const el = document.getElementById('__card'); if (el) { el.style.opacity = '0'; setTimeout(() => el.remove(), 500); } };

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
          if (e.type === 'saved') continue; // le rapport enregistré n'existe pas sur ce serveur : on reste sur le rapport direct
          if (typeof e.t === 'number') { await new Promise((r) => setTimeout(r, Math.max(0, (e.t - prev) * scale))); prev = e.t; }
          c.enqueue(enc.encode(l + '\n'));
        }
        c.close();
      },
    });
    return new Response(body, { status: 200, headers: { 'content-type': 'application/x-ndjson; charset=utf-8' } });
  };
}

async function smoothScroll(page, px, ms) {
  await page.evaluate(([px, ms]) => new Promise((res) => {
    const start = performance.now(); const from = window.scrollY;
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    function step(now) { const t = Math.min(1, (now - start) / ms); window.scrollTo(0, from + px * ease(t)); if (t < 1) requestAnimationFrame(step); else res(); }
    requestAnimationFrame(step);
  }), [px, ms]);
}

const APP = [
  ['/app?compte=demo', 'Chaque lundi : ce qui a changé sur Google et dans les IA', 500, 6000],
  ['/app/reponses?compte=demo', 'Les réponses de ChatGPT, Gemini et Perplexity, mot pour mot', 450, 6000],
  ['/app/concurrents?compte=demo', 'Qui les IA recommandent à votre place', 450, 5500],
  ['/app/seo?compte=demo', 'Vos scores Google et IA, et les corrections qui comptent', 700, 6500],
  ['/app/sources?compte=demo', 'Les sites que les IA lisent avant de répondre', 400, 5500],
  ['/app/actions?compte=demo', 'Trois actions par semaine, classées par effet, déjà rédigées', 450, 6000],
  ['/app/agent?compte=demo', 'L’agent prépare les corrections ; vous validez avant toute publication', 450, 6500],
  ['/app/trafic?compte=demo-ecom', 'La preuve : les visites venues de chaque IA', 450, 5500],
  ['/app/produits/ventes?compte=demo-ecom', 'Et les ventes qu’elles ont apportées', 400, 5500],
  ['/app/rapports?compte=demo-ecom', 'Un rapport avant / après chaque mois, à partager', 400, 5500],
];

(async () => {
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
  // Préchauffage (sans enregistrer)
  const warm = await browser.newContext({ viewport: { width: W, height: H } });
  const wp = await warm.newPage();
  for (const u of ['/analyse?site=atelier-lumen.test&segment=local', ...APP.map((a) => a[0])]) await wp.goto(BASE + u, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  const state = await warm.storageState();
  await warm.close();

  const dir = path.join(OUT, 'explication');
  fs.rmSync(dir, { recursive: true, force: true });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir, size: { width: W, height: H } }, storageState: state, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('repere.install.dismissed', '1'); } catch {} });
  await page.addInitScript(replayInit, { lines, scale: 4 });
  const marks = []; const t0 = Date.now();
  const mark = async (caption) => { marks.push({ t: (Date.now() - t0) / 1000, caption }); await page.evaluate(CAPTION_JS(caption)); };
  const card = async (a, b, c, ms) => { marks.push({ t: (Date.now() - t0) / 1000, caption: `${a} ${b}`.replace(/([^.…:]) (\p{Lu})/u, "$1. $2") }); await page.evaluate(CARD_JS, [a, b, c]); await page.waitForTimeout(ms); await page.evaluate(HIDE_CARD_JS); await page.waitForTimeout(450); };

  // 1. Ouverture
  await page.goto(BASE + '/analyse?site=atelier-lumen.test&segment=local', { waitUntil: 'networkidle', timeout: 90000 });
  await card('Vos clients demandent à Google… et aux IA.', 'Repéré vous dit pourquoi on vous recommande, ou pas, et fait les corrections avec vous.', null, 4200);
  // 2. Analyse en 60 s
  await mark('Entrez votre site : l’analyse est gratuite, sans inscription');
  await page.waitForTimeout(2600);
  await page.check('input[type=checkbox]').catch(() => {});
  await page.click('button[type=submit]');
  await page.waitForTimeout(300);
  await mark('Repéré explore vraiment le site, page par page (ici un site fictif)');
  await page.waitForTimeout(5500);
  await mark('Les problèmes apparaissent en direct, pour Google et pour les IA');
  await page.waitForSelector('#verdict', { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.evaluate(() => { const v = document.getElementById('verdict'); if (v) window.scrollTo(0, v.getBoundingClientRect().top + window.scrollY - 110); });
  await mark('Le verdict, deux scores et les priorités, en moins d’une minute');
  await page.waitForTimeout(2500);
  await smoothScroll(page, 900, 6000);
  await page.waitForTimeout(800);
  // 3. Transition app
  await card('Ensuite, chaque semaine', 'Mesurer, comprendre, agir, prouver.', 'Comptes de démonstration : entreprises et chiffres fictifs.', 3200);
  for (const [url, caption, scroll, ms] of APP) {
    await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(350);
    await mark(caption);
    await page.waitForTimeout(1100);
    await smoothScroll(page, scroll, ms - 2000);
    await page.waitForTimeout(900);
  }
  // 4. Fin
  await card('Testez votre site en 60 secondes', 'Analyse gratuite, sans inscription, sur Repéré.', null, 4500);
  await page.waitForTimeout(300);
  const video = page.video();
  await ctx.close();
  fs.copyFileSync(await video.path(), path.join(OUT, 'explication.webm'));
  fs.writeFileSync(path.join(OUT, 'explication.json'), JSON.stringify({ marks, total: (Date.now() - t0) / 1000 }, null, 1));
  console.log('explication ok', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  await browser.close();
})();
