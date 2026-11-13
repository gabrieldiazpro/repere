/* eslint-disable @typescript-eslint/no-require-imports -- script ponctuel hors application */
// Enregistre les vidéos de démo dans la vraie app (comptes démo). Usage : node record.js <base> <id>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:4200';
const ONLY = process.argv[3];
const OUT = path.join(__dirname, 'raw');
fs.mkdirSync(OUT, { recursive: true });

const W = 1280, H = 720;

// Chaque scène : [url, légende, défilement en px (ou sélecteur à survoler), durée ms]
const SCENARIOS = {
  hero: [
    ['/app?compte=demo', 'Chaque lundi : ce qui a changé dans les réponses des IA', 500, 5200],
    ['/app/reponses?compte=demo', 'Les réponses de ChatGPT, Gemini et Perplexity, mot pour mot', 450, 5000],
    ['/app/sources?compte=demo', 'Les sites que les IA lisent avant de répondre', 400, 4600],
    ['/app/actions?compte=demo', 'Vos actions de la semaine, déjà rédigées', 450, 5200],
    ['/app/trafic?compte=demo', 'Et la preuve : les visites venues des IA', 350, 4600],
  ],
  mesurer: [
    ['/app/questions?compte=demo-pme', 'Les questions que vos clients posent aux IA', 400, 5000],
    ['/app/reponses?compte=demo-pme', 'Chaque réponse, avec votre position', 500, 5200],
    ['/app/ia?compte=demo-pme', 'IA par IA : où vous êtes cité, où vous ne l’êtes pas', 400, 5000],
    ['/app/concurrents?compte=demo-pme', 'Votre part de voix face aux concurrents', 500, 5200],
  ],
  comprendre: [
    ['/app/sources?compte=demo-pme', 'D’où viennent les réponses : les sources citées', 500, 5200],
    ['/app/seo?compte=demo-pme', 'Google et les IA : vos deux scores, et les corrections qui comptent', 500, 5600],
    ['/app/verite?compte=demo-pme', 'Ce que les IA disent de faux sur vous', 400, 5200],
    ['/app/copilote?compte=demo-pme&q=Pourquoi%20mes%20concurrents%20sont%20cit%C3%A9s%20%C3%A0%20ma%20place%20%3F', 'Posez la question au copilote', 300, 6500],
  ],
  agir: [
    ['/app/actions?compte=demo', 'Trois actions par semaine, classées par effet', 450, 5200],
    ['/app/local/fiche-google?compte=demo', 'Votre fiche Google, critère par critère', 500, 5000],
    ['/app/local/avis?compte=demo', 'Demandes d’avis et réponses prêtes à envoyer', 500, 5000],
    ['/app/pages?compte=demo-pme', 'Chaque page notée, avec les corrections à faire', 450, 5600, 'Analyser une page d’exemple|Analyser une page d\'exemple'],
    ['/app/agent?compte=demo', 'L’agent prépare les corrections, vous validez avant publication', 450, 5600],
  ],
  prouver: [
    ['/app/trafic?compte=demo-ecom', 'Les visites envoyées par chaque IA', 450, 5200],
    ['/app/produits/ventes?compte=demo-ecom', 'Les ventes attribuées aux IA', 450, 5200],
    ['/app/rapports?compte=demo-ecom', 'Un rapport mensuel avant / après, à partager', 400, 5000],
    ['/app?compte=demo-ecom', 'Mesurer, comprendre, agir, prouver', 300, 4500],
  ],
};

const CAPTION_JS = (text) => `(() => {
  let el = document.getElementById('__cap');
  if (!el) {
    el = document.createElement('div'); el.id = '__cap';
    el.style.cssText = 'position:fixed;left:50%;bottom:34px;transform:translateX(-50%);z-index:2147483647;background:rgba(15,23,42,.92);color:#fff;font:600 24px/1.3 system-ui,sans-serif;padding:14px 26px;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.25);max-width:1000px;text-align:center;transition:opacity .35s;opacity:0;pointer-events:none';
    document.body.appendChild(el);
  }
  el.textContent = ${JSON.stringify(text)};
  requestAnimationFrame(() => { el.style.opacity = '1'; });
})()`;

async function smoothScroll(page, px, ms) {
  await page.evaluate(([px, ms]) => new Promise((res) => {
    const start = performance.now();
    const from = window.scrollY;
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    function step(now) {
      const t = Math.min(1, (now - start) / ms);
      window.scrollTo(0, from + px * ease(t));
      if (t < 1) requestAnimationFrame(step); else res();
    }
    requestAnimationFrame(step);
  }), [px, ms]);
}

async function recordOne(browser, id, scenes) {
  // Préchauffe : charge chaque page une fois, sans enregistrer (cache, données démo).
  const warm = await browser.newContext({ viewport: { width: W, height: H } });
  const wp = await warm.newPage();
  for (const [url] of scenes) { await wp.goto(BASE + url, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {}); }
  const state = await warm.storageState();
  await warm.close();

  const dir = path.join(OUT, id);
  fs.rmSync(dir, { recursive: true, force: true });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir, size: { width: W, height: H } }, storageState: state, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('repere.install.dismissed', '1'); } catch {} });
  const marks = [];
  const t0 = Date.now();
  for (const [url, caption, scroll, ms, click] of scenes) {
    await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(350);
    if (click) { await page.getByText(new RegExp(click, 'i')).first().click({ timeout: 5000 }).catch((e) => console.log('clic manqué', click)); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(600); }
    marks.push({ t: (Date.now() - t0) / 1000, caption });
    await page.evaluate(CAPTION_JS(caption));
    await page.waitForTimeout(1100);
    await smoothScroll(page, scroll, ms - 2000);
    await page.waitForTimeout(900);
  }
  await page.waitForTimeout(400);
  const video = page.video();
  await ctx.close();
  const src = await video.path();
  fs.copyFileSync(src, path.join(OUT, id + '.webm'));
  fs.writeFileSync(path.join(OUT, id + '.json'), JSON.stringify({ marks, total: (Date.now() - t0) / 1000 }, null, 1));
  console.log(id, 'ok', ((Date.now() - t0) / 1000).toFixed(1) + 's');
}

(async () => {
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
  for (const [id, scenes] of Object.entries(SCENARIOS)) {
    if (ONLY && ONLY !== id) continue;
    await recordOne(browser, id, scenes);
  }
  await browser.close();
})();
