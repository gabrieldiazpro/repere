#!/usr/bin/env node
/**
 * Vérifie le site EN LIGNE, de l'extérieur, sans rien modifier ni déclencher.
 *
 *   node scripts/ops/verifier-prod.mjs https://votre-domaine.fr
 *   node scripts/ops/verifier-prod.mjs https://votre-domaine.fr --json
 *
 * Contrôles : pages clés (200, titre, canonique sur le bon domaine), pages légales sans « [À COMPLÉTER] »,
 * en-têtes de sécurité (CSP appliquée, HSTS, nosniff, anti-iframe, Referrer-Policy, Permissions-Policy),
 * redirection http → https, robots.txt / sitemap.xml / llms.txt, webhook Stripe joignable et configuré (requête
 * sans signature : refusée par la route AVANT tout traitement), santé de la base et de la file (/api/health,
 * détail avec CRON_SECRET lu dans .env.production.local s'il existe), identité publiée (ENTITY_READY).
 * Code de sortie 1 si un contrôle bloquant échoue.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEnvFile } from './lib/envfile.mjs';

export const KEY_PAGES = ['/', '/tarifs', '/local', '/pme', '/e-commerce', '/audit', '/methode', '/a-propos', '/contact'];
export const LEGAL_PAGES = ['/mentions-legales', '/cgv', '/confidentialite'];

const TODO_RE = /\[\s*À\s+COMPL[ÉE]TER|\[\s*à compléter|\[\s*A COMPLETER/i;

async function get(fetchImpl, url, init = {}) {
  const t0 = Date.now();
  try {
    const res = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(20_000), ...init, headers: { 'user-agent': 'repere-verifier-prod/1.0', ...(init.headers ?? {}) } });
    const text = init.method === 'HEAD' ? '' : await res.text().catch(() => '');
    return { status: res.status, headers: res.headers, text, ms: Date.now() - t0 };
  } catch (e) {
    return { status: 0, headers: new Headers(), text: '', error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 };
  }
}

/**
 * Lance tous les contrôles. `fetchImpl` est injectable (tests).
 * @param {string} base
 * @param {{ fetchImpl?: (url: string, init?: any) => Promise<Response>, cronSecret?: string }} [opts]
 * @returns {Promise<{ ok: boolean, results: { group: string, name: string, ok: boolean, level: 'error'|'warn', detail: string }[] }>}
 */
export async function verify(base, { fetchImpl = fetch, cronSecret } = {}) {
  const origin = new URL(base).origin;
  const host = new URL(origin).host;
  const results = [];
  const add = (group, name, ok, detail = '', level = 'error') => results.push({ group, name, ok, level, detail });

  // 1. Pages clés
  const home = await get(fetchImpl, `${origin}/`);
  for (const p of KEY_PAGES) {
    const r = p === '/' ? home : await get(fetchImpl, `${origin}${p}`);
    const okStatus = r.status === 200;
    add('Pages', p, okStatus && /<title>[^<]{3,}<\/title>/i.test(r.text), okStatus ? `${r.ms} ms` : `HTTP ${r.status}${r.error ? ` (${r.error})` : ''}`);
  }
  const canonical = /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i.exec(home.text)?.[1] ?? /<link[^>]+href="([^"]+)"[^>]+rel="canonical"/i.exec(home.text)?.[1];
  add('Pages', 'adresse canonique de l’accueil', Boolean(canonical && new URL(canonical, origin).host === host), canonical ? canonical : 'absente', canonical ? 'error' : 'warn');
  if (/localhost|127\.0\.0\.1|\.vercel\.app/.test(home.text.match(/<link[^>]+rel="canonical"[^>]*>/i)?.[0] ?? '')) add('Pages', 'canonique hors domaine', false, 'localhost ou *.vercel.app : renseignez NEXT_PUBLIC_SITE_URL');

  // 2. Pages légales
  for (const p of LEGAL_PAGES) {
    const r = await get(fetchImpl, `${origin}${p}`);
    const todos = (r.text.match(new RegExp(TODO_RE.source, 'gi')) ?? []).length;
    add('Légal', p, r.status === 200 && todos === 0, r.status !== 200 ? `HTTP ${r.status}` : todos ? `${todos} « [À COMPLÉTER] » visibles` : 'complète');
  }

  // 3. En-têtes de sécurité (page d'accueil)
  const h = home.headers;
  const csp = h.get('content-security-policy');
  add('Sécurité', 'Content-Security-Policy appliquée', Boolean(csp), csp ? 'présente' : h.get('content-security-policy-report-only') ? 'seulement en Report-Only (CSP_REPORT_ONLY à vider)' : 'absente');
  const hsts = h.get('strict-transport-security') ?? '';
  add('Sécurité', 'HSTS', /max-age=\d{7,}/.test(hsts), hsts || 'absent');
  add('Sécurité', 'X-Content-Type-Options', /nosniff/i.test(h.get('x-content-type-options') ?? ''), h.get('x-content-type-options') ?? 'absent');
  add('Sécurité', 'anti-iframe (X-Frame-Options ou frame-ancestors)', Boolean(h.get('x-frame-options') || /frame-ancestors/.test(csp ?? '')), h.get('x-frame-options') ?? (csp ? 'frame-ancestors' : 'absent'));
  add('Sécurité', 'Referrer-Policy', Boolean(h.get('referrer-policy')), h.get('referrer-policy') ?? 'absent', 'warn');
  add('Sécurité', 'Permissions-Policy', Boolean(h.get('permissions-policy')), h.get('permissions-policy') ? 'présente' : 'absente', 'warn');
  const plain = await get(fetchImpl, `http://${host}/`);
  const loc = plain.headers.get('location') ?? '';
  add('Sécurité', 'http → https', [301, 302, 307, 308].includes(plain.status) && loc.startsWith('https://'), plain.status ? `HTTP ${plain.status} ${loc}` : plain.error ?? 'injoignable', 'warn');
  const apiHealthHead = await get(fetchImpl, `${origin}/api/health`);
  add('Sécurité', 'noindex sur /api', /noindex/i.test(apiHealthHead.headers.get('x-robots-tag') ?? ''), apiHealthHead.headers.get('x-robots-tag') ?? 'absent', 'warn');

  // 4. Robots, sitemap, llms.txt
  const robots = await get(fetchImpl, `${origin}/robots.txt`);
  const sitemapLine = /^sitemap:\s*(\S+)/im.exec(robots.text)?.[1];
  add('Référencement', 'robots.txt', robots.status === 200 && Boolean(sitemapLine) && new URL(sitemapLine, origin).host === host, robots.status === 200 ? sitemapLine ?? 'sans ligne Sitemap:' : `HTTP ${robots.status}`);
  add('Référencement', 'robots.txt n’interdit pas tout le site', robots.status === 200 && !/^disallow:\s*\/\s*$/im.test(robots.text.split(/^user-agent:\s*\*/im)[1]?.split(/^user-agent:/im)[0] ?? ''), 'règle « User-agent: * »');
  const sitemap = await get(fetchImpl, `${origin}/sitemap.xml`);
  const locs = [...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const foreign = locs.filter((u) => { try { return new URL(u).host !== host; } catch { return true; } });
  add('Référencement', 'sitemap.xml', sitemap.status === 200 && locs.length > 0 && foreign.length === 0, sitemap.status !== 200 ? `HTTP ${sitemap.status}` : foreign.length ? `${foreign.length} adresses hors domaine (ex. ${foreign[0]})` : `${locs.length} adresses`);
  const llms = await get(fetchImpl, `${origin}/llms.txt`);
  add('Référencement', 'llms.txt', llms.status === 200 && llms.text.includes(host), llms.status === 200 ? (llms.text.includes(host) ? 'présent' : 'ne cite pas le domaine') : `HTTP ${llms.status}`);

  // 5. Identité publiée (ENTITY_READY)
  const entity = llms.status === 200 && /SIREN\s+\d{9}/.test(llms.text) && locs.some((u) => u.endsWith('/a-propos'));
  add('Identité', 'ENTITY_READY (SIREN dans llms.txt, /a-propos indexable)', entity, entity ? 'identité publiée' : 'identité incomplète : NEXT_PUBLIC_FOUNDER_* et NEXT_PUBLIC_LEGAL_* puis redéployer');

  // 6. Webhook Stripe : requête SANS signature, refusée avant tout traitement (aucun événement déclenché)
  const wh = await get(fetchImpl, `${origin}/api/stripe/webhook`, { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
  add(
    'Stripe',
    'webhook joignable et configuré',
    wh.status === 400,
    wh.status === 400 ? 'répond 400 « signature manquante » (attendu)' : wh.status === 503 ? '503 : STRIPE_SECRET_KEY ou STRIPE_WEBHOOK_SECRET absente sur Vercel' : `HTTP ${wh.status}${wh.error ? ` (${wh.error})` : ''}`,
  );

  // 7. Santé (base, configuration, file de tâches)
  const health = await get(fetchImpl, `${origin}/api/health`, cronSecret ? { headers: { authorization: `Bearer ${cronSecret}` } } : {});
  let hj = null;
  try {
    hj = JSON.parse(health.text);
  } catch {
    /* non JSON */
  }
  add('Santé', '/api/health', health.status === 200 && hj && hj.status !== 'fail', hj ? `statut ${hj.status}, base ${hj.checks?.db}, configuration ${hj.checks?.env}, file ${hj.checks?.jobs}` : `HTTP ${health.status}`);
  add('Santé', 'mode production', hj?.mode === 'production', hj ? `mode ${hj.mode}` : 'inconnu');
  if (hj?.db) add('Santé', 'base Supabase', hj.db.backend === 'supabase' && hj.db.level === 'ok', `${hj.db.backend}${hj.db.ms ? `, ${hj.db.ms} ms` : ''}${hj.db.error ? ` : ${hj.db.error}` : ''}`);
  if (hj?.env) {
    add('Santé', 'variables (démarrage)', (hj.env.errors ?? []).length === 0, (hj.env.errors ?? []).join(' ; ') || 'aucune erreur');
    for (const w of hj.env.warnings ?? []) add('Santé', 'avertissement', false, w, 'warn');
  }
  if (hj?.keys) {
    const ai = Object.entries(hj.keys.ai ?? {}).filter(([, v]) => v).map(([k]) => k);
    add('Santé', 'IA configurées', ai.length > 0, ai.join(', ') || 'aucune (audits simulés)');
    add('Santé', 'Stripe, Resend, cron', Boolean(hj.keys.stripe && hj.keys.resend && hj.keys.cron), `stripe ${hj.keys.stripe ? 'oui' : 'NON'}, resend ${hj.keys.resend ? 'oui' : 'NON'}, cron ${hj.keys.cron ? 'oui' : 'NON'}`);
  } else if (!cronSecret) {
    add('Santé', 'détail', false, 'CRON_SECRET non fourni : détail non vérifié (base, clés)', 'warn');
  }
  if (hj?.jobs?.stats) add('Santé', 'file de tâches', hj.jobs.level === 'ok', `${hj.jobs.stats.queued} en attente, ${hj.jobs.stats.dead} en échec`, 'warn');

  const ok = results.every((r) => r.ok || r.level === 'warn');
  return { ok, results };
}

export function formatVerify(base, r) {
  const L = [`Vérification de ${base}`];
  let group = '';
  for (const x of r.results) {
    if (x.group !== group) {
      group = x.group;
      L.push('', group);
    }
    L.push(`  ${x.ok ? '✓' : x.level === 'warn' ? '!' : '✗'} ${x.name}${x.detail ? ` — ${x.detail}` : ''}`);
  }
  const bad = r.results.filter((x) => !x.ok && x.level === 'error').length;
  const warn = r.results.filter((x) => !x.ok && x.level === 'warn').length;
  L.push('', r.ok ? `✓ EN LIGNE ET CONFORME${warn ? ` (${warn} point(s) à surveiller)` : ''}` : `✗ ${bad} contrôle(s) bloquant(s) en échec${warn ? `, ${warn} à surveiller` : ''}`);
  return L.join('\n');
}

async function main() {
  const argv = process.argv.slice(2);
  const base = argv.find((a) => /^https?:\/\//.test(a));
  if (!base) {
    console.error('Usage : node scripts/ops/verifier-prod.mjs https://votre-domaine.fr');
    process.exitCode = 1;
    return;
  }
  const env = (await readEnvFile()) ?? {};
  const cronSecret = process.env.CRON_SECRET || env.CRON_SECRET || undefined;
  const r = await verify(base, { cronSecret });
  if (argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else console.log(formatVerify(base, r));
  process.exitCode = r.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  });
}
