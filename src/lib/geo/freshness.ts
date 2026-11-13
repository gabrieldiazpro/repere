/**
 * Section « Fraîcheur » : dates visibles et dateModified honnêtes.
 * Repéré ne propose JAMAIS de changer une date sans changement réel du contenu (mise en garde de Google).
 */
import { typesOf } from '@/lib/siteaudit/jsonld';
import type { GeoFinding, GeoSection } from './types';
import { UTILITY_PATH, isArticlePage } from './entity';
import { DATE_RE } from './passages';
import { finding, plural, section, str, type GeoPage } from './util';

const CAT = 'geo.fraicheur';
const DAY = 86_400_000;

const MONTHS: Record<string, number> = { janvier: 0, février: 1, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5, juillet: 6, août: 7, aout: 7, septembre: 8, octobre: 9, novembre: 10, décembre: 11, decembre: 11 };
const VISIBLE_DATE = /\b(\d{1,2})(?:er)?\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+((?:19|20)\d{2})\b|\b(\d{1,2})\/(\d{1,2})\/((?:19|20)\d{2})\b|\b((?:19|20)\d{2})-(\d{2})-(\d{2})\b/gi;
const STALE_PRICE_YEAR = /\b(tarifs?|prix|grille tarifaire|catalogue|barème)\s+((?:19|20)\d{2})\b/i;

/** Dates visibles d'un texte (ms). */
export function visibleDates(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(VISIBLE_DATE)) {
    let t: number;
    if (m[1]) t = Date.UTC(Number(m[3]), MONTHS[m[2].toLowerCase()] ?? 0, Number(m[1]));
    else if (m[4]) t = Date.UTC(Number(m[6]), Number(m[5]) - 1, Number(m[4]));
    else t = Date.UTC(Number(m[7]), Number(m[8]) - 1, Number(m[9]));
    if (Number.isFinite(t)) out.push(t);
  }
  return out;
}

function ldDates(p: GeoPage): { modified: number | null; published: number | null } {
  let modified: number | null = null;
  let published: number | null = null;
  for (const n of p.nodes) {
    const m = str(n.dateModified);
    const d = str(n.datePublished);
    if (m && Number.isFinite(Date.parse(m))) modified = Math.max(modified ?? 0, Date.parse(m));
    if (d && Number.isFinite(Date.parse(d))) published = Math.max(published ?? 0, Date.parse(d));
  }
  const og = p.page.openGraph?.['article:modified_time'];
  if (og && Number.isFinite(Date.parse(og))) modified = Math.max(modified ?? 0, Date.parse(og));
  return { modified, published };
}

export function auditFreshness(pages: GeoPage[], nowIso?: string): { section: GeoSection; latest: number | null } {
  const now = nowIso ? Date.parse(nowIso) : Date.now();
  const findings: GeoFinding[] = [];
  const withHtml = pages.filter((p) => p.parsed);
  const articles = withHtml.filter((p) => isArticlePage(p));
  const infoPages = withHtml.filter((p) => !UTILITY_PATH.test(p.path));

  let latest: number | null = null;
  const perPage = new Map<string, { visible: number | null; modified: number | null; published: number | null; header: number | null }>();
  for (const p of withHtml) {
    const vis = visibleDates(p.parsed?.mainText ?? '').filter((t) => t <= now + DAY);
    const { modified, published } = ldDates(p);
    const lm = p.page.headers['last-modified'];
    const header = lm && Number.isFinite(Date.parse(lm)) ? Date.parse(lm) : null;
    const v = vis.length ? Math.max(...vis) : null;
    perPage.set(p.url, { visible: v, modified, published, header });
    for (const t of [v, modified, published]) if (t && t <= now + DAY) latest = Math.max(latest ?? 0, t);
  }

  // Articles sans date visible.
  const noDate = articles.filter((p) => !perPage.get(p.url)?.visible && !DATE_RE.test(p.parsed?.mainText.slice(0, 4000) ?? ''));
  if (noDate.length) {
    findings.push(
      finding({
        id: 'geo.fraicheur.no_visible_date',
        category: CAT,
        severity: noDate.length / articles.length >= 0.5 ? 'medium' : 'low',
        title: `${plural(noDate.length, 'article n’affiche', 'articles n’affichent')} aucune date de publication ou de mise à jour`,
        why: 'Les assistants citent en moyenne des pages plus récentes que la recherche classique, et des modèles de classement favorisent les passages datés récemment. Sans date, l’IA ne peut pas juger si l’information est à jour.',
        fix: 'Affichez « Publié le … · Mis à jour le … » en haut de chaque article, et renseignez datePublished / dateModified dans le JSON-LD. Ne changez la date que si le contenu change vraiment.',
        affected: noDate.map((p) => ({ url: p.url })),
        impact: 2,
        effort: 1,
        evidenceLevel: 'probable',
      }),
    );
  }

  // JSON-LD Article sans dateModified.
  const articleLd = withHtml.filter((p) => p.nodes.some((n) => typesOf(n).some((t) => /Article|BlogPosting|Report/.test(t))));
  const noModified = articleLd.filter((p) => !p.nodes.some((n) => str(n.dateModified)));
  if (noModified.length) {
    findings.push(
      finding({
        id: 'geo.fraicheur.no_datemodified',
        category: CAT,
        severity: 'low',
        title: `${plural(noModified.length, 'article balisé n’a', 'articles balisés n’ont')} pas de dateModified dans le JSON-LD`,
        why: 'dateModified indique aux machines la date de dernière révision réelle du contenu.',
        fix: 'Ajoutez dateModified (date de la dernière modification réelle) au bloc Article / BlogPosting.',
        affected: noModified.map((p) => ({ url: p.url })),
        impact: 1,
        effort: 1,
        evidenceLevel: 'probable',
      }),
    );
  }

  // Date de modification déclarée dans le futur.
  const future = withHtml.filter((p) => {
    const d = perPage.get(p.url);
    return (d?.modified ?? 0) > now + 2 * DAY || (d?.published ?? 0) > now + 2 * DAY;
  });
  if (future.length) {
    findings.push(
      finding({
        id: 'geo.fraicheur.future_date',
        category: CAT,
        severity: 'medium',
        title: `${plural(future.length, 'page déclare', 'pages déclarent')} une date dans le futur`,
        why: 'Une date incohérente fait douter de toutes les dates du site ; Google met en garde contre les dates artificielles.',
        fix: 'Corrigez datePublished / dateModified : ils doivent refléter la date réelle de publication et de modification.',
        affected: future.map((p) => ({ url: p.url })),
        impact: 1,
        effort: 1,
        evidenceLevel: 'probable',
      }),
    );
  }

  // Tarifs datés d'une année passée.
  const year = new Date(now).getUTCFullYear();
  const stalePrices = infoPages.filter((p) => {
    const m = STALE_PRICE_YEAR.exec(p.parsed?.mainText ?? '');
    return m && Number(m[2]) < year - 1;
  });
  if (stalePrices.length) {
    findings.push(
      finding({
        id: 'geo.fraicheur.stale_prices',
        category: CAT,
        severity: 'medium',
        title: `${plural(stalePrices.length, 'page affiche', 'pages affichent')} des tarifs datés d’une année passée`,
        why: 'Une IA peut reprendre un prix ancien comme s’il était actuel, ou écarter la page comme obsolète.',
        fix: 'Mettez à jour la grille et son année, ou retirez l’année si les prix sont toujours valables.',
        affected: stalePrices.map((p) => ({ url: p.url, detail: STALE_PRICE_YEAR.exec(p.parsed?.mainText ?? '')?.[0] })),
        impact: 2,
        effort: 1,
        evidenceLevel: 'probable',
      }),
    );
  }

  // Site sans aucune date récente (plus de 2 ans) alors qu'il a des articles.
  if (articles.length >= 2 && latest !== null && now - latest > 730 * DAY) {
    findings.push(
      finding({
        id: 'geo.fraicheur.stale_site',
        category: CAT,
        severity: 'low',
        title: `Votre contenu daté le plus récent remonte à ${new Date(latest).toISOString().slice(0, 10)}`,
        why: 'ChatGPT, Perplexity, Gemini et Copilot citent en moyenne des pages plus récentes que la recherche classique (étude sur 17 millions de citations).',
        fix: 'Révisez vos contenus les plus consultés (prix, délais, réglementation) ou publiez un contenu utile récent. Ne modifiez pas les dates sans modifier le fond.',
        affected: articles.slice(0, 20).map((p) => ({ url: p.url })),
        impact: 1,
        effort: 2,
        evidenceLevel: 'probable',
      }),
    );
  }

  const note = withHtml.length
    ? `${plural(articles.length, 'article', 'articles')} et ${plural(infoPages.length, 'page d’information', 'pages d’information')} examinés${latest ? ` ; date la plus récente trouvée : ${new Date(latest).toISOString().slice(0, 10)}` : ' ; aucune date trouvée'}.`
    : 'Aucun HTML conservé : fraîcheur non mesurée.';
  return { section: section('fraicheur', 'Fraîcheur', 5, findings, note, withHtml.length > 0), latest };
}
