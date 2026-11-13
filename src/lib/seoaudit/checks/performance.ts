/**
 * Section « Mobile et performance ». Deux sources :
 *  - le crawl (viewport, poids HTML, temps de réponse mesuré par notre robot, scripts bloquants, compression) ;
 *  - `PerfData` de SEO-DATA si fourni (Core Web Vitals terrain CrUX au 75e centile, Lighthouse en laboratoire).
 * Seuils officiels : LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 (bon) ; > 4 s, > 500 ms, > 0,25 (mauvais). TTFB ≤ 0,8 s (bon), > 1,8 s (mauvais).
 */
import { SRC } from '../sources';
import type { AuditCtx, CheckDef, Hit, PerfMetrics, Severity } from '../types';
import { attr, headOf, median, pl, tags } from '../util';
import { hitPages, hitSite } from './helpers';

const sec = 'performance' as const;
const cat = 'performance';

/** Mesures terrain mobiles (origine), sinon pire page mobile terrain, sinon laboratoire. */
function mobileMetrics(ctx: AuditCtx): { m: PerfMetrics; kind: 'terrain' | 'laboratoire'; url?: string } | null {
  const perf = ctx.perf;
  if (!perf) return null;
  if (perf.origin?.mobile && Object.values(perf.origin.mobile).some((v) => v !== undefined)) return { m: perf.origin.mobile, kind: 'terrain' };
  const field = perf.pages?.filter((p) => p.strategy === 'mobile' && p.field);
  if (field?.length) return { m: field[0].field as PerfMetrics, kind: 'terrain', url: field[0].url };
  const lab = perf.pages?.filter((p) => p.strategy === 'mobile' && p.lab);
  if (lab?.length) return { m: lab[0].lab as PerfMetrics, kind: 'laboratoire', url: lab[0].url };
  return null;
}

function metricCheck(key: keyof PerfMetrics, good: number, poor: number, fmt: (v: number) => string, fieldOnly = false) {
  return (ctx: AuditCtx): Hit | null => {
    const mm = mobileMetrics(ctx);
    const v = mm?.m[key];
    if (!mm || v === undefined || (fieldOnly && mm.kind !== 'terrain')) return null;
    if (v <= good) return null;
    const severity: Severity = v > poor ? 'high' : 'medium';
    return hitSite(ctx, `${fmt(v)} (mobile, ${mm.kind})`, { severity, evidence: `${String(key)} = ${fmt(v)} ; bon ≤ ${fmt(good)}, mauvais > ${fmt(poor)} — source ${ctx.perf?.source}, ${ctx.perf?.fetchedAt}${ctx.perf?.demo ? ' (données de démonstration)' : ''}` });
  };
}

const ms = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')} s` : `${Math.round(v)} ms`);

function renderBlocking(html: string): number {
  return tags(headOf(html), 'script').filter((t) => !!attr(t, 'src') && !/\s(async|defer)\b/i.test(t) && !/type\s*=\s*["']?module/i.test(t)).length;
}

export const PERFORMANCE: CheckDef[] = [
  {
    id: 'seo.mobile.viewport_missing', section: sec, category: 'mobile', severity: 'high', impact: 3, effort: 1, scope: 'page',
    label: 'Balise viewport absente (site non adapté au mobile)',
    title: (n) => `${pl(n, 'page n’est', 'pages ne sont')} pas configurées pour mobile (balise viewport absente)`,
    why: 'Google classe votre site d’après sa version mobile ; sans viewport, la page s’affiche en miniature illisible sur téléphone.',
    fix: 'Ajoutez <meta name="viewport" content="width=device-width, initial-scale=1"> dans l’en-tête.',
    source: SRC.mobileFirst,
    run: (ctx) => hitPages(ctx.html.filter((p) => !!p.html && !/<meta[^>]+name\s*=\s*["']?viewport/i.test(headOf(p.html)))),
  },
  {
    id: 'seo.mobile.zoom_disabled', section: sec, category: 'mobile', severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Zoom bloqué sur mobile',
    title: (n) => `${pl(n, 'page empêche', 'pages empêchent')} le zoom sur mobile`,
    why: 'Bloquer le zoom gêne les personnes malvoyantes ; c’est un défaut d’accessibilité signalé par Lighthouse.',
    fix: 'Retirez user-scalable=no et maximum-scale=1 de la balise viewport.',
    source: SRC.viewport,
    run: (ctx) => hitPages(ctx.html.filter((p) => {
      const v = tags(headOf(p.html ?? ''), 'meta').find((t) => /name\s*=\s*["']?viewport/i.test(t));
      const c = v ? attr(v, 'content') ?? '' : '';
      return /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(c);
    })),
  },
  {
    id: 'seo.mobile.plugins', section: sec, category: 'mobile', severity: 'low', impact: 1, effort: 2, scope: 'page',
    label: 'Contenus Flash / plugins',
    title: (n) => `${pl(n, 'page utilise', 'pages utilisent')} des contenus Flash ou plugins non lisibles`,
    why: 'Ces contenus ne s’affichent plus dans aucun navigateur et ne sont pas indexés.',
    fix: 'Remplacez-les par du HTML, une image ou une vidéo standard.',
    source: SRC.mobileFirst,
    run: (ctx) => hitPages(ctx.html.filter((p) => !!p.html && /<(object|embed)\b[^>]*(\.swf|x-shockwave-flash|java)/i.test(p.html))),
  },
  {
    id: 'seo.perf.slow_server', section: sec, category: cat, severity: 'medium', impact: 2, effort: 2, scope: 'site',
    label: 'Serveur lent (temps de réponse médian > 1 s)',
    title: () => 'Votre serveur met plus d’une seconde à répondre (médiane mesurée par notre robot)',
    why: 'Tout le reste de l’affichage attend la première réponse du serveur (TTFB) ; au-delà de 0,8 s, c’est perceptible.',
    fix: 'Activez un cache de pages, un CDN, ou passez à un hébergement plus rapide.',
    source: SRC.ttfb,
    run: (ctx) => {
      const xs = ctx.html.map((p) => p.fetchMs).filter((x) => x > 0);
      if (xs.length < 3) return null;
      const m = median(xs);
      return m > 1000 ? hitSite(ctx, `${ms(m)} (médiane sur ${xs.length} pages)`, { evidence: 'Mesure depuis notre serveur, indicative (pas une mesure chez vos visiteurs).' }) : null;
    },
  },
  {
    id: 'seo.perf.slow_pages', section: sec, category: cat, severity: 'low', impact: 1, effort: 2, scope: 'page',
    label: 'Pages très lentes à répondre (> 3 s)',
    title: (n) => `${pl(n, 'page a mis', 'pages ont mis')} plus de 3 secondes à répondre`,
    why: 'Des pages ponctuellement très lentes signalent souvent une requête lourde (recherche, filtre, extension).',
    fix: 'Identifiez ce qui ralentit ces pages (requêtes, extensions) et mettez-les en cache.',
    source: SRC.ttfb,
    run: (ctx) => hitPages(ctx.html.filter((p) => p.fetchMs > 3000), (p) => ms(p.fetchMs)),
  },
  {
    id: 'seo.perf.html_heavy', section: sec, category: cat, severity: 'low', impact: 1, effort: 2, scope: 'page',
    label: 'Code HTML très lourd (> 600 Ko)',
    title: (n) => `${pl(n, 'page a', 'pages ont')} un code HTML de plus de 600 Ko`,
    why: 'Un HTML énorme ralentit le premier affichage, surtout sur mobile ; Google ne lit pas au-delà de 15 Mo.',
    fix: 'Allégez le gabarit : moins de code en ligne, de menus dupliqués et de scripts intégrés.',
    source: SRC.webVitals,
    run: (ctx) => hitPages(ctx.html.filter((p) => p.bytes > 600_000), (p) => `${Math.round(p.bytes / 1024)} Ko`),
  },
  {
    id: 'seo.perf.too_many_scripts', section: sec, category: cat, severity: 'low', impact: 1, effort: 2, scope: 'page',
    label: 'Trop de scripts (> 40)',
    title: (n) => `${pl(n, 'page charge', 'pages chargent')} plus de 40 scripts`,
    why: 'Chaque script occupe le téléphone et retarde la réaction aux clics (INP).',
    fix: 'Supprimez les extensions et traceurs inutiles ; regroupez et différez le reste.',
    source: SRC.inp,
    run: (ctx) => hitPages(ctx.html.filter((p) => p.renderHints.scriptsCount > 40), (p) => `${p.renderHints.scriptsCount} scripts`),
  },
  {
    id: 'seo.perf.render_blocking', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'page',
    label: 'Scripts bloquants dans l’en-tête',
    title: (n) => `${pl(n, 'page charge', 'pages chargent')} plus de 2 scripts bloquants avant d’afficher le contenu`,
    why: 'Le navigateur attend ces scripts avant d’afficher quoi que ce soit.',
    fix: 'Ajoutez defer (ou async) aux scripts de l’en-tête qui ne sont pas indispensables au premier affichage.',
    source: SRC.renderBlocking,
    run: (ctx) => hitPages(ctx.html.filter((p) => !!p.html && renderBlocking(p.html) > 2), (p) => `${renderBlocking(p.html ?? '')} scripts`),
  },
  {
    id: 'seo.perf.no_compression', section: sec, category: cat, severity: 'low', impact: 1, effort: 1, scope: 'site',
    label: 'Compression (gzip/brotli) désactivée',
    title: () => 'Vos pages ne sont pas compressées (gzip / brotli)',
    why: 'La compression divise souvent par 4 le poids du HTML transféré.',
    fix: 'Activez gzip ou brotli sur le serveur ou le CDN (un réglage chez la plupart des hébergeurs).',
    source: SRC.textCompression,
    run: (ctx) => {
      const big = ctx.html.filter((p) => p.bytes > 20_000);
      if (big.length < 2) return null;
      const none = big.filter((p) => !p.headers['content-encoding']);
      return none.length / big.length > 0.8 ? hitSite(ctx, `${none.length} pages de plus de 20 Ko sans compression`) : null;
    },
  },
  {
    id: 'seo.cwv.lcp', section: sec, category: cat, severity: 'medium', impact: 3, effort: 2, scope: 'site',
    label: 'LCP (affichage du contenu principal) lent',
    title: () => 'Le contenu principal met trop longtemps à s’afficher sur mobile (LCP)',
    why: 'Le LCP mesure quand le visiteur voit enfin l’essentiel ; au-delà de 2,5 s, une partie part avant.',
    fix: 'Allégez et priorisez l’image du haut de page (fetchpriority="high"), réduisez le temps serveur et les CSS bloquants.',
    source: SRC.lcp,
    run: metricCheck('lcpMs', 2500, 4000, ms),
  },
  {
    id: 'seo.cwv.inp', section: sec, category: cat, severity: 'medium', impact: 3, effort: 3, scope: 'site',
    label: 'INP (réactivité aux clics) lente',
    title: () => 'Votre site réagit lentement aux clics et aux saisies sur mobile (INP)',
    why: 'L’INP, Core Web Vital depuis mars 2024, mesure le délai entre un geste et la réaction de la page.',
    fix: 'Réduisez le JavaScript (extensions, chat, traceurs), découpez les tâches longues, différez ce qui n’est pas utile au premier clic.',
    source: SRC.inp,
    run: metricCheck('inpMs', 200, 500, ms, true),
  },
  {
    id: 'seo.cwv.cls', section: sec, category: cat, severity: 'medium', impact: 2, effort: 1, scope: 'site',
    label: 'CLS (stabilité visuelle) mauvais',
    title: () => 'La page « saute » pendant le chargement sur mobile (CLS)',
    why: 'Des éléments qui bougent font cliquer au mauvais endroit et agacent les visiteurs.',
    fix: 'Réservez la place des images, publicités et bandeaux (width/height, aspect-ratio) ; évitez d’insérer du contenu au-dessus.',
    source: SRC.cls,
    run: metricCheck('cls', 0.1, 0.25, (v) => v.toFixed(2).replace('.', ',')),
  },
  {
    id: 'seo.cwv.ttfb', section: sec, category: cat, severity: 'medium', impact: 2, effort: 2, scope: 'site',
    label: 'TTFB (réponse du serveur) lent chez les visiteurs',
    title: () => 'Votre serveur répond lentement à vos visiteurs réels (TTFB)',
    why: 'Mesuré chez vos visiteurs (CrUX), un TTFB lent retarde tout l’affichage.',
    fix: 'Cache de pages, CDN proche de la France, hébergement plus performant.',
    source: SRC.ttfb,
    run: metricCheck('ttfbMs', 800, 1800, ms, true),
  },
  {
    id: 'seo.cwv.lab_score', section: sec, category: cat, severity: 'medium', impact: 2, effort: 2, scope: 'page',
    label: 'Score Lighthouse mobile faible (< 50)',
    title: (n) => `${pl(n, 'page obtient', 'pages obtiennent')} un score de performance mobile inférieur à 50/100 (Lighthouse)`,
    why: 'Mesure de laboratoire (téléphone simulé) : un score faible annonce une expérience lente pour beaucoup de visiteurs.',
    fix: 'Suivez les recommandations prioritaires du rapport PageSpeed Insights de ces pages.',
    source: SRC.webVitals,
    run: (ctx) => {
      const bad = (ctx.perf?.pages ?? []).filter((p) => p.strategy === 'mobile' && (p.lab?.performanceScore ?? 100) < 50);
      return bad.length ? { items: bad.map((p) => ({ url: p.url, detail: `${p.lab?.performanceScore}/100` })), base: Math.max(1, (ctx.perf?.pages ?? []).filter((p) => p.strategy === 'mobile').length) } : null;
    },
  },
  {
    id: 'seo.cwv.no_field_data', section: sec, category: cat, severity: 'info', impact: 1, effort: 1, scope: 'site',
    label: 'Pas de données terrain Chrome (CrUX)',
    title: () => 'Google ne dispose pas de mesures de vitesse chez vos visiteurs réels (trafic insuffisant pour CrUX)',
    why: 'C’est courant pour les petits sites : Google s’appuie alors sur d’autres signaux. Les mesures de laboratoire restent indicatives.',
    fix: 'Rien à corriger ; suivez le score de laboratoire.',
    source: SRC.cwv,
    run: (ctx) => (ctx.perf && !ctx.perf.origin?.mobile && !(ctx.perf.pages ?? []).some((p) => p.field) ? hitSite(ctx) : null),
  },
];
