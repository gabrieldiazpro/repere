/**
 * Analyse des outils V7 à partir de pages déjà récupérées (aucun réseau ici) : structure des titres, images et textes
 * alternatifs, poids de la page, compatibilité mobile, HTTPS et contenu mixte, contenu dupliqué, fraîcheur, résultats
 * enrichis Google. Réutilise l'extraction du crawl (src/lib/crawl/extract.ts), le lecteur HTML de siteaudit, les règles
 * Google de seoaudit/schema.ts et les dates de geo/freshness.ts. Côté serveur uniquement.
 */
import { extractPage } from '@/lib/crawl/extract';
import { findBlocks, parseAttrs, parseHtml, stripComments, stripTags, tags } from '@/lib/siteaudit/html';
import { microdataTypes } from '@/lib/siteaudit/jsonld';
import { allNodes, str, typesOf } from '@/lib/seoaudit/util';
import { visibleDates } from '@/lib/geo/freshness';
import type { PageFetch } from '../v6/analyze';
import { blockedBase } from './access';
import { check, fold, pl, richResults, sharedSentences, similarity, verdictOf } from './pure';
import type {
  AccessInfo,
  AltKind,
  DateSignal,
  DuplicateReport,
  DupSide,
  FreshnessReport,
  HeadingRow,
  HeadingsReport,
  HttpsReport,
  ImageRow,
  ImagesReport,
  MixedItem,
  MobileReport,
  ResourceKind,
  ResourceRow,
  RichReport,
  V6Check,
  WeightReport,
} from './types';

export type { PageFetch };

const now = () => new Date().toISOString();
const base = (p: PageFetch, checks: V6Check[], verdict: ReturnType<typeof verdictOf>, access?: AccessInfo | null) => ({
  url: p.requestedUrl,
  finalUrl: p.finalUrl,
  status: p.status,
  verdict,
  checks,
  checkedAt: now(),
  ...(access ? { access } : {}),
});
const bodyOf = (html: string) => {
  const c = stripComments(html);
  const i = c.search(/<body\b/i);
  return i >= 0 ? c.slice(i) : c;
};
const sameOrigin = (a: string, b: string) => {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
};
const absOf = (href: string | undefined, baseUrl: string): string | null => {
  if (!href) return null;
  const h = href.trim();
  if (!h || /^(data|javascript|mailto|tel|blob|about):/i.test(h) || h.startsWith('#')) return null;
  try {
    const u = new URL(h, baseUrl);
    if (!/^https?:$/.test(u.protocol)) return null;
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
};
const firstSrcset = (s: string | undefined) => (s ?? '').split(',')[0]?.trim().split(/\s+/)[0] || undefined;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`);
export { kb as formatBytes };

/* ------------------------------------------------------------------ */
/* Structure des titres H1–H6                                          */
/* ------------------------------------------------------------------ */

const QUESTION = /\?\s*$|^(comment|pourquoi|quel(le)?s?|combien|qu['’]est[- ]ce|que faire|quand|où|faut-il|peut-on|est-ce|dois-je|qui |à quoi|a quoi)/i;

export function analyzeHeadings(p: PageFetch, access: AccessInfo | null = null): HeadingsReport {
  const empty = { title: null, headings: [], counts: [0, 0, 0, 0, 0, 0], words: 0 };
  if (access?.blocked) return { ...blockedBase(p, access), ...empty };
  const parsed = parseHtml(p.html ?? '');
  let prev = 1;
  const headings: HeadingRow[] = parsed.headings.map((h, i) => {
    const text = h.text.replace(/\s+/g, ' ').trim();
    const skipped = i > 0 ? h.level > prev + 1 : h.level > 2;
    prev = h.level;
    return { level: h.level, text, skipped, empty: !text, question: QUESTION.test(text) };
  });
  const counts = [1, 2, 3, 4, 5, 6].map((l) => headings.filter((h) => h.level === l).length);
  const words = parsed.mainText.split(/\s+/).filter(Boolean).length;
  const checks: V6Check[] = [];
  const h1 = headings.filter((h) => h.level === 1 && !h.empty);
  if (!h1.length) checks.push(check('h1.missing', 'Aucun titre H1', 'fail', headings.length ? `La page commence par un H${headings[0].level}.` : 'La page n’a aucun intertitre dans le HTML.', 'Ajoutez un H1 unique qui dit le sujet de la page en une phrase (« Plombier chauffagiste à Lyon 3 »).'));
  else if (h1.length > 1) checks.push(check('h1.multiple', `${h1.length} titres H1`, 'warn', h1.slice(0, 3).map((h) => `« ${clip(h.text, 60)} »`).join(', '), 'Gardez un seul H1 (le sujet de la page) et passez les autres en H2. Souvent : le logo ou le menu balisés en H1 par le thème.'));
  else checks.push(check('h1.ok', 'Un seul H1', 'ok', `« ${clip(h1[0].text, 120)} »`));
  const title = parsed.title || null;
  if (h1.length === 1 && title && fold(h1[0].text) === fold(title)) checks.push(check('h1.title', 'H1 identique au title', 'ok', 'Rien d’anormal ; un H1 un peu plus naturel que le title est souvent plus agréable à lire.', '', true));
  const skips = headings.filter((h) => h.skipped);
  if (skips.length) checks.push(check('skip', `${pl(skips.length, 'saut de niveau', 'sauts de niveau')}`, 'warn', skips.slice(0, 4).map((h) => `H${h.level} « ${clip(h.text || '(vide)', 50)} »`).join(' · '), 'Descendez d’un niveau à la fois (H2 puis H3) : le plan reste lisible pour les lecteurs d’écran, Google et les IA qui découpent la page par sections.'));
  else if (headings.length > 1) checks.push(check('skip.ok', 'Niveaux dans l’ordre', 'ok', 'Aucun saut de niveau (H2 → H4).'));
  const emptyH = headings.filter((h) => h.empty);
  if (emptyH.length) checks.push(check('empty', `${pl(emptyH.length, 'titre vide', 'titres vides')}`, 'warn', 'Balise de titre sans texte (souvent une image sans alt, ou un espacement du thème).', 'Supprimez la balise, ou donnez-lui un texte (ou un alt à l’image qu’elle contient).'));
  const long = headings.filter((h) => h.text.length > 90);
  if (long.length) checks.push(check('long', `${pl(long.length, 'titre très long', 'titres très longs')}`, 'warn', long.slice(0, 2).map((h) => `H${h.level} : ${h.text.length} caractères`).join(' · '), 'Un intertitre annonce une section : une ligne suffit. Le texte long a sa place dans un paragraphe (balisé <p>).'));
  const seen = new Map<string, number>();
  for (const h of headings) if (h.text && h.level <= 3) seen.set(`${h.level}|${fold(h.text)}`, (seen.get(`${h.level}|${fold(h.text)}`) ?? 0) + 1);
  const dups = [...seen].filter(([, n]) => n > 1);
  if (dups.length) checks.push(check('dup', `${pl(dups.length, 'intertitre répété', 'intertitres répétés')}`, 'warn', dups.slice(0, 3).map(([k, n]) => `« ${clip(k.split('|')[1], 40)} » × ${n}`).join(' · '), 'Donnez à chaque section un titre qui la distingue : deux sections au même titre se confondent dans les réponses des IA.'));
  if (words > 500 && counts[1] === 0) checks.push(check('noh2', `Texte de ${words} mots sans intertitre H2`, 'warn', 'Un long bloc sans sections est difficile à parcourir et à découper.', 'Ajoutez un H2 toutes les 200 à 300 lignes de lecture environ, chacun sur une question ou une idée.'));
  const q = headings.filter((h) => h.level >= 2 && h.question);
  if (headings.filter((h) => h.level >= 2).length >= 2) checks.push(check('questions', q.length ? `${pl(q.length, 'intertitre formulé en question', 'intertitres formulés en question')}` : 'Aucun intertitre en question', 'ok', q.length ? q.slice(0, 3).map((h) => `« ${clip(h.text, 60)} »`).join(' · ') : 'Facultatif : un intertitre en forme de question (« Combien coûte… ? ») correspond mot pour mot à ce que les clients demandent aux IA.', '', true));
  const verdict = verdictOf(checks, { ok: 'Le plan de la page est clair', warn: 'Le plan de la page est à retoucher', fail: 'La page n’a pas de titre principal (H1)' });
  return { ...base(p, checks, verdict, access), title, headings, counts, words };
}

/* ------------------------------------------------------------------ */
/* Images et textes alternatifs                                        */
/* ------------------------------------------------------------------ */

const FILENAME_ALT = /\.(jpe?g|png|webp|gif|avif|svg|bmp|tiff?)$|^(img|image|dsc|dscn|dcim|pxl|photo|capture|screenshot|unnamed|untitled)[-_ ]?\d+|^[\w-]*[_-]\d{3,}[\w-]*$/i;
const GENERIC_ALT = /^(image|img|photo|picture|logo|icone|icône|icon|visuel|illustration|banniere|bannière|banner|placeholder|sans titre|untitled)$/i;

export function altKind(alt: string | undefined): AltKind {
  if (alt === undefined) return 'missing';
  const a = alt.trim();
  if (!a) return 'empty';
  if (FILENAME_ALT.test(a)) return 'filename';
  if (GENERIC_ALT.test(fold(a))) return 'generic';
  if (a.length > 150) return 'long';
  return 'ok';
}

/** Images de la page, dans l'ordre, avec la nature de leur texte alternatif et le fait qu'elles soient cliquables. */
export function pageImages(p: PageFetch): ImageRow[] {
  const html = p.html ?? '';
  const ex = extractPage(html, p.finalUrl);
  const body = bodyOf(html);
  const linked = new Set<string>();
  for (const b of findBlocks(body, ['a'])) {
    const inner = body.slice(b.openEnd, b.closeStart);
    if (stripTags(inner).trim()) continue; // le lien a déjà un texte
    for (const t of tags(inner, 'img')) {
      const s = absOf(t.attrs.src || t.attrs['data-src'] || firstSrcset(t.attrs.srcset), ex.baseUrl);
      if (s) linked.add(s);
    }
  }
  const rows: ImageRow[] = ex.images.slice(0, 200).map((im) => {
    const kind = altKind(im.alt);
    return { src: im.src, alt: im.alt ?? null, kind, linked: linked.has(im.src) };
  });
  const byAlt = new Map<string, Set<string>>();
  for (const r of rows) if (r.alt && r.kind === 'ok') byAlt.set(fold(r.alt), (byAlt.get(fold(r.alt)) ?? new Set()).add(r.src));
  for (const r of rows) if (r.alt && r.kind === 'ok' && (byAlt.get(fold(r.alt))?.size ?? 0) >= 3) r.kind = 'duplicate';
  return rows;
}

/** Images à vérifier (http(s), même site d'abord), sans doublon. */
export function imagesToCheck(rows: ImageRow[], pageUrl: string, max = 20): string[] {
  const urls = [...new Set(rows.map((r) => r.src).filter((s) => /^https?:\/\//.test(s)))];
  return [...urls.filter((u) => sameOrigin(u, pageUrl)), ...urls.filter((u) => !sameOrigin(u, pageUrl))].slice(0, max);
}

export function analyzeImages(p: PageFetch, rows: ImageRow[], statuses: Map<string, { status: number; bytes?: number; contentType?: string; error?: string }> = new Map(), access: AccessInfo | null = null): ImagesReport {
  const zero = { total: 0, missing: 0, empty: 0, weak: 0, checked: 0, broken: 0, images: [] };
  if (access?.blocked) return { ...blockedBase(p, access), ...zero };
  const images = rows.map((r) => {
    const s = statuses.get(r.src);
    return s ? { ...r, status: s.status, ...(s.bytes !== undefined ? { bytes: s.bytes } : {}), ...(s.contentType ? { contentType: s.contentType } : {}), ...(s.error ? { error: s.error } : {}) } : r;
  });
  const missing = images.filter((r) => r.kind === 'missing');
  const empty = images.filter((r) => r.kind === 'empty');
  const weak = images.filter((r) => ['filename', 'generic', 'long', 'duplicate'].includes(r.kind));
  const checked = images.filter((r) => r.status !== undefined && !r.error?.startsWith('non vérifié'));
  const broken = checked.filter((r) => r.status === 0 || (r.status ?? 0) >= 400);
  const linkedNoName = images.filter((r) => r.linked && (r.kind === 'missing' || r.kind === 'empty'));
  const checks: V6Check[] = [];
  if (!images.length) checks.push(check('none', 'Aucune image dans le HTML', 'ok', 'Rien à vérifier. Si votre page affiche des images, elles sont peut-être chargées par JavaScript ou en image de fond CSS : les robots ne les voient pas comme des images.', '', true));
  if (missing.length) {
    const share = missing.length / images.length;
    checks.push(check('alt.missing', `${pl(missing.length, 'image sans attribut alt', 'images sans attribut alt')}`, share > 0.3 ? 'fail' : 'warn', missing.slice(0, 3).map((r) => clip(r.src.split('/').pop() || r.src, 50)).join(' · '), 'Décrivez chaque image utile en quelques mots (« Chauffe-eau thermodynamique posé dans un garage ») ; pour une image décorative, mettez alt="" (vide).'));
  } else if (images.length) checks.push(check('alt.ok', 'Toutes les images ont un attribut alt', 'ok', `${pl(images.length, 'image', 'images')}.`));
  if (linkedNoName.length) checks.push(check('alt.link', `${pl(linkedNoName.length, 'lien-image sans nom', 'liens-images sans nom')}`, 'fail', 'Une image cliquable sans alt ni texte donne un lien muet : ni un lecteur d’écran, ni Google ne savent où il mène.', 'Mettez dans l’alt la destination du lien (« Demander un devis », « Accueil »).'));
  if (weak.length) {
    const why = [...new Set(weak.map((r) => ({ filename: 'nom de fichier', generic: 'mot générique', long: 'trop long', duplicate: 'même texte sur 3 images et plus' })[r.kind as 'filename'] ?? ''))].join(', ');
    checks.push(check('alt.weak', `${pl(weak.length, 'texte alternatif peu utile', 'textes alternatifs peu utiles')}`, 'warn', `${why} : ${weak.slice(0, 3).map((r) => `« ${clip(r.alt ?? '', 40)} »`).join(' · ')}`, 'Un bon alt dit ce que montre l’image, dans le contexte de la page, en moins de 125 caractères.'));
  }
  if (empty.length) checks.push(check('alt.empty', `${pl(empty.length, 'image déclarée décorative', 'images déclarées décoratives')} (alt vide)`, 'ok', 'Correct pour un motif ou une icône à côté d’un texte. Vérifiez qu’aucune ne porte une information (photo d’un produit, d’un chantier).', '', true));
  if (broken.length) checks.push(check('broken', `${pl(broken.length, 'image cassée', 'images cassées')}`, 'fail', broken.slice(0, 3).map((r) => `${r.status || 'injoignable'} · ${clip(r.src.split('/').pop() || r.src, 40)}`).join(' · '), 'Remplacez ou retirez ces images : elles s’affichent comme un cadre vide.'));
  else if (checked.length) checks.push(check('broken.ok', 'Aucune image cassée', 'ok', `${pl(checked.length, 'image vérifiée', 'images vérifiées')} sur ${images.length}.`));
  const verdict = verdictOf(checks, {
    ok: images.length ? 'Vos images sont décrites et s’affichent' : 'Aucune image à décrire sur cette page',
    warn: 'Vos images sont à mieux décrire',
    fail: broken.length ? 'Des images sont cassées sur cette page' : 'Des images n’ont pas de texte alternatif',
  });
  return { ...base(p, checks, verdict, access), total: images.length, missing: missing.length, empty: empty.length, weak: weak.length, checked: checked.length, broken: broken.length, images };
}

/* ------------------------------------------------------------------ */
/* Poids de la page                                                    */
/* ------------------------------------------------------------------ */

/** Ressources appelées par le HTML (fichiers externes), sans doublon, 80 au plus. */
export function pageResources(p: PageFetch): ResourceRow[] {
  const html = stripComments(p.html ?? '');
  const ex = extractPage(p.html ?? '', p.finalUrl);
  const out = new Map<string, ResourceRow>();
  const add = (href: string | undefined, kind: ResourceKind) => {
    const u = absOf(href, ex.baseUrl);
    if (!u || out.has(u) || out.size >= 80) return;
    out.set(u, { url: u, kind, bytes: null, external: !sameOrigin(u, p.finalUrl) });
  };
  for (const t of tags(html, 'link')) {
    const rel = (t.attrs.rel ?? '').toLowerCase().split(/\s+/);
    if (rel.includes('stylesheet')) add(t.attrs.href, 'style');
    else if (rel.includes('preload') || rel.includes('modulepreload')) {
      const as = (t.attrs.as ?? (rel.includes('modulepreload') ? 'script' : '')).toLowerCase();
      add(t.attrs.href, as === 'font' ? 'font' : as === 'style' ? 'style' : as === 'script' ? 'script' : as === 'image' ? 'image' : 'autre');
    }
  }
  for (const t of tags(html, 'script')) if (t.attrs.src) add(t.attrs.src, 'script');
  for (const im of ex.images) if (!im.src.startsWith('data:')) add(im.src, 'image');
  for (const t of tags(html, 'video')) {
    if (t.attrs.poster) add(t.attrs.poster, 'image');
    if (t.attrs.src) add(t.attrs.src, 'media');
  }
  for (const t of tags(html, 'source')) if (t.attrs.src) add(t.attrs.src, 'media');
  for (const t of tags(html, 'iframe')) if (t.attrs.src) add(t.attrs.src, 'autre');
  return [...out.values()];
}

/** Ressources à mesurer : même site d'abord (styles, scripts, images), puis les autres. */
export function resourcesToCheck(rows: ResourceRow[], max = 30): string[] {
  const order: ResourceKind[] = ['style', 'script', 'font', 'image', 'autre', 'media'];
  const sorted = [...rows].filter((r) => r.kind !== 'media' && r.kind !== 'autre').sort((a, b) => Number(a.external) - Number(b.external) || order.indexOf(a.kind) - order.indexOf(b.kind));
  return sorted.slice(0, max).map((r) => r.url);
}

export function analyzeWeight(p: PageFetch, rows: ResourceRow[], sizes: Map<string, { status: number; bytes?: number; contentType?: string; error?: string }> = new Map(), access: AccessInfo | null = null, htmlBytes = 0): WeightReport {
  const zero = { htmlBytes: 0, compressed: null, totalKnown: 0, unknown: 0, requests: 0, checked: 0, byKind: [], heaviest: [], resources: [] };
  if (access?.blocked) return { ...blockedBase(p, access), ...zero };
  const resources: ResourceRow[] = rows.map((r) => {
    const s = sizes.get(r.url);
    if (!s) return r;
    return { ...r, status: s.status, bytes: s.bytes ?? null, ...(s.contentType ? { contentType: s.contentType } : {}), ...(s.error ? { error: s.error } : {}) };
  });
  const html = htmlBytes || Buffer.byteLength(p.html ?? '', 'utf8');
  const compressed = p.headers['content-encoding'] ?? null;
  const known = resources.filter((r) => typeof r.bytes === 'number');
  const totalKnown = html + known.reduce((s, r) => s + (r.bytes ?? 0), 0);
  const checkedN = resources.filter((r) => r.status !== undefined).length;
  const unknown = resources.length - known.length;
  const kinds: ResourceKind[] = ['html', 'image', 'script', 'style', 'font', 'media', 'autre'];
  const byKind = kinds
    .map((k) => ({ kind: k, count: k === 'html' ? 1 : resources.filter((r) => r.kind === k).length, bytes: k === 'html' ? html : known.filter((r) => r.kind === k).reduce((s, r) => s + (r.bytes ?? 0), 0) }))
    .filter((x) => x.count > 0);
  const heaviest = [...known].sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0)).slice(0, 8);
  const checks: V6Check[] = [];
  if (html > 1024 * 1024) checks.push(check('html.big', `HTML de ${kb(html)}`, 'warn', 'Les robots lisent un volume limité par page (notre robot, comme beaucoup de robots d’IA, s’arrête à 2 Mo) : un texte placé en fin de HTML peut être ignoré.', 'Allégez le HTML : données JSON embarquées, SVG en ligne répétés, styles copiés dans chaque page.'));
  else checks.push(check('html.ok', `HTML de ${kb(html)}`, 'ok', 'Taille raisonnable.'));
  if (!compressed && html > 20 * 1024) checks.push(check('gzip', 'HTML envoyé sans compression', 'warn', 'Le serveur n’annonce ni gzip ni brotli : la page met plus longtemps à arriver.', 'Activez la compression chez votre hébergeur (souvent une case « Gzip » ou « Brotli », ou une ligne dans .htaccess).'));
  else if (compressed) checks.push(check('gzip.ok', `HTML compressé (${compressed})`, 'ok', 'Le serveur compresse la page.'));
  const imgs = known.filter((r) => r.kind === 'image');
  const huge = imgs.filter((r) => (r.bytes ?? 0) > 1024 * 1024);
  const heavy = imgs.filter((r) => (r.bytes ?? 0) > 300 * 1024 && (r.bytes ?? 0) <= 1024 * 1024);
  if (huge.length) checks.push(check('img.huge', `${pl(huge.length, 'image de plus de 1 Mo', 'images de plus de 1 Mo')}`, 'fail', huge.slice(0, 3).map((r) => `${kb(r.bytes!)} · ${clip(r.url.split('/').pop() || r.url, 40)}`).join(' · '), 'Redimensionnez à la largeur d’affichage (1 600 px suffisent pour un plein écran) et exportez en WebP ou AVIF.'));
  if (heavy.length) checks.push(check('img.heavy', `${pl(heavy.length, 'image entre 300 Ko et 1 Mo', 'images entre 300 Ko et 1 Mo')}`, 'warn', heavy.slice(0, 3).map((r) => `${kb(r.bytes!)} · ${clip(r.url.split('/').pop() || r.url, 40)}`).join(' · '), 'Compressez-les (qualité 75–80 suffit) ; sur WordPress, une extension d’optimisation d’images le fait pour toute la médiathèque.'));
  if (imgs.length && !huge.length && !heavy.length) checks.push(check('img.ok', 'Images légères', 'ok', `${pl(imgs.length, 'image mesurée', 'images mesurées')}, aucune au-dessus de 300 Ko.`));
  const legacy = imgs.filter((r) => /image\/(jpeg|png|gif)/i.test(r.contentType ?? '') && (r.bytes ?? 0) > 150 * 1024);
  if (legacy.length) checks.push(check('img.format', `${pl(legacy.length, 'image lourde en JPEG, PNG ou GIF', 'images lourdes en JPEG, PNG ou GIF')}`, 'warn', 'Les formats WebP et AVIF pèsent souvent 25 à 50 % de moins à qualité égale.', 'Convertissez les plus lourdes en WebP (tous les navigateurs actuels le lisent).'));
  const js = known.filter((r) => r.kind === 'script').reduce((s, r) => s + (r.bytes ?? 0), 0);
  if (js > 1024 * 1024) checks.push(check('js.big', `${kb(js)} de JavaScript`, 'warn', 'Beaucoup de scripts à télécharger avant que la page réagisse, surtout sur mobile.', 'Retirez les extensions et traceurs inutiles ; chargez les autres avec defer.'));
  if (totalKnown > 6 * 1024 * 1024) checks.push(check('total.huge', `Page de ${kb(totalKnown)} au moins`, 'fail', 'Très lourde pour un téléphone en 4G moyenne.', 'Commencez par les images les plus lourdes ci-dessous : ce sont presque toujours elles.'));
  else if (totalKnown > 3 * 1024 * 1024) checks.push(check('total.big', `Page de ${kb(totalKnown)} au moins`, 'warn', 'Lourde pour un téléphone : le chargement se ressent.', 'Allégez les images et les scripts listés ci-dessous.'));
  else checks.push(check('total.ok', `Page de ${kb(totalKnown)} (ressources mesurées)`, 'ok', 'Poids raisonnable.'));
  const requests = resources.length + 1;
  if (requests > 80) checks.push(check('requests', `${requests} fichiers appelés`, 'warn', 'Chaque fichier est une requête de plus.', 'Regroupez ou retirez les scripts et styles des extensions inutilisées.'));
  if (unknown) checks.push(check('unknown', `${pl(unknown, 'ressource non mesurée', 'ressources non mesurées')}`, 'ok', 'Le serveur n’annonce pas leur taille, ou nous ne les avons pas toutes interrogées (30 au plus). Le total est donc un minimum.', '', true));
  const verdict = verdictOf(checks, { ok: `Page légère : ${kb(totalKnown)} mesurés`, warn: `Page de ${kb(totalKnown)} au moins : à alléger`, fail: `Page trop lourde : ${kb(totalKnown)} au moins` });
  return { ...base(p, checks, verdict, access), htmlBytes: html, compressed, totalKnown, unknown, requests, checked: checkedN, byKind, heaviest, resources };
}

/* ------------------------------------------------------------------ */
/* Compatibilité mobile (approximations sur le HTML)                   */
/* ------------------------------------------------------------------ */

export function analyzeMobile(p: PageFetch, access: AccessInfo | null = null): MobileReport {
  if (access?.blocked) return { ...blockedBase(p, access), viewport: null, signals: [] };
  const raw = p.html ?? '';
  const html = stripComments(raw);
  const head = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html)?.[1] ?? html.slice(0, 50_000);
  const vp = tags(head, 'meta').find((t) => (t.attrs.name ?? '').toLowerCase() === 'viewport')?.attrs.content ?? null;
  const body = bodyOf(html).replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ');
  const checks: V6Check[] = [];
  const signals: { label: string; value: string }[] = [];
  signals.push({ label: 'Balise viewport', value: vp ?? 'absente' });
  if (!vp) checks.push(check('viewport.missing', 'Pas de balise viewport', 'fail', 'Sans elle, un téléphone affiche la page comme un écran d’ordinateur réduit : texte minuscule, zoom obligatoire.', 'Ajoutez dans le <head> : <meta name="viewport" content="width=device-width, initial-scale=1">.'));
  else {
    const v = vp.toLowerCase().replace(/\s+/g, '');
    if (/width=\d+/.test(v)) checks.push(check('viewport.fixed', 'Largeur fixe dans la balise viewport', 'fail', `« ${vp} » : la page est dessinée pour une largeur précise, pas pour l’écran du téléphone.`, 'Remplacez par width=device-width, initial-scale=1.'));
    else if (!/width=device-width/.test(v)) checks.push(check('viewport.width', 'Viewport sans width=device-width', 'warn', `« ${vp} »`, 'Ajoutez width=device-width.'));
    else checks.push(check('viewport.ok', 'Balise viewport adaptée aux téléphones', 'ok', `« ${vp} »`));
    const max = /maximum-scale=([\d.]+)/.exec(v);
    if (/user-scalable=(no|0)/.test(v) || (max && Number(max[1]) < 2)) checks.push(check('viewport.zoom', 'Zoom bloqué', 'warn', 'user-scalable=no ou maximum-scale trop bas : un visiteur malvoyant ne peut pas agrandir le texte (règle d’accessibilité WCAG 1.4.4).', 'Retirez user-scalable=no et maximum-scale de la balise viewport.'));
  }
  // Éléments plus larges qu'un téléphone : style en ligne ou attribut width sur tableaux et cadres (approximation).
  let wide = 0;
  for (const m of body.matchAll(/<(table|iframe|div|section|img|video|embed)\b([^>]*)>/gi)) {
    const a = parseAttrs(m[2]);
    const style = (a.style ?? '').toLowerCase();
    const w = /(?:^|;)\s*(?:min-)?width\s*:\s*(\d{3,4})px/.exec(style)?.[1] ?? (['table', 'iframe', 'embed'].includes(m[1].toLowerCase()) ? a.width : undefined);
    if (w && Number(w) >= 500 && !/max-width/.test(style)) wide++;
  }
  signals.push({ label: 'Éléments à largeur fixe ≥ 500 px', value: String(wide) });
  if (wide) checks.push(check('wide', `${pl(wide, 'élément à largeur fixe', 'éléments à largeur fixe')} (500 px et plus)`, 'warn', 'Tableau, cadre ou bloc à largeur imposée dans le HTML : il peut dépasser de l’écran et obliger à défiler de côté. Approximation : la feuille de style peut corriger.', 'Remplacez la largeur fixe par max-width: 100% ; mettez les tableaux larges dans un conteneur qui défile (overflow-x: auto).'));
  let small = 0;
  for (const m of body.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)(px|pt)/gi)) if ((m[2] === 'pt' ? Number(m[1]) * 1.33 : Number(m[1])) < 12) small++;
  small += (body.match(/<font\b[^>]*size\s*=\s*["']?1\b/gi) ?? []).length;
  signals.push({ label: 'Textes de moins de 12 px (styles en ligne)', value: String(small) });
  if (small) checks.push(check('font', `${pl(small, 'texte en très petits caractères', 'textes en très petits caractères')}`, 'warn', 'Taille de police inférieure à 12 px dans le HTML : illisible sur téléphone sans zoom.', 'Gardez au moins 16 px pour le texte courant et 12 px pour les mentions.'));
  // Liens collés les uns aux autres dans un même bloc (cibles tactiles trop proches, approximation).
  const close = (body.match(/<\/a>(?:\s|&nbsp;|[|·•,\-–]){0,3}<a\b/gi) ?? []).length;
  signals.push({ label: 'Liens collés (sans espace ni bloc entre eux)', value: String(close) });
  if (close >= 6) checks.push(check('tap', `${close} liens collés les uns aux autres`, 'warn', 'Des liens séparés par un simple espace ou une barre : au doigt, on touche souvent le voisin. Approximation sur le HTML, sans mesure à l’écran.', 'Espacez-les (au moins 8 px, cibles de 44 px de haut environ) ou passez-les en liste verticale sur mobile.'));
  const plugins = (body.match(/<(object|embed|applet)\b[^>]*(flash|shockwave|\.swf)/gi) ?? []).length;
  if (plugins) checks.push(check('plugins', 'Contenu Flash ou module externe', 'fail', 'Aucun téléphone ne lit Flash depuis 2020 : ce contenu est invisible.', 'Remplacez-le par une image, une vidéo HTML5 ou du texte.'));
  const tel = (body.match(/href\s*=\s*["']tel:/gi) ?? []).length;
  const phones = (stripTags(body).match(/(?:\+33\s?(?:\(0\)\s?)?|\b0)[1-9](?:[\s.-]?\d{2}){4}\b/g) ?? []).length;
  signals.push({ label: 'Liens d’appel (tel:)', value: String(tel) });
  if (phones && !tel) checks.push(check('tel', 'Numéro affiché sans lien d’appel', 'warn', `${pl(phones, 'numéro de téléphone', 'numéros de téléphone')} dans le texte, aucun lien « tel: » : sur mobile, il faut le recopier.`, 'Entourez le numéro d’un lien : <a href="tel:+33478000000">04 78 00 00 00</a>.'));
  else if (tel) checks.push(check('tel.ok', 'Numéro cliquable', 'ok', `${pl(tel, 'lien d’appel', 'liens d’appel')} « tel: ».`));
  let badInputs = 0;
  for (const t of tags(body, 'input')) {
    const n = `${t.attrs.name ?? ''} ${t.attrs.id ?? ''} ${t.attrs.autocomplete ?? ''}`.toLowerCase();
    const type = (t.attrs.type ?? 'text').toLowerCase();
    if (type === 'text' && /(tel|phone|telephone|portable|mobile|e-?mail|courriel)/.test(n)) badInputs++;
  }
  if (badInputs) checks.push(check('inputs', `${pl(badInputs, 'champ de formulaire mal typé', 'champs de formulaire mal typés')}`, 'warn', 'Un champ téléphone ou e-mail en type="text" n’ouvre pas le bon clavier sur mobile.', 'Utilisez type="tel" et type="email" (et autocomplete="tel" / "email").'));
  const srcset = (body.match(/\bsrcset\s*=/gi) ?? []).length;
  signals.push({ label: 'Images adaptatives (srcset)', value: String(srcset) });
  const media = /@media[^{]*(max|min)-width/i.test(raw) || tags(head, 'link').some((t) => /width/.test(t.attrs.media ?? ''));
  signals.push({ label: 'Règles CSS pour petits écrans dans le HTML', value: media ? 'oui' : 'non vues (peut-être dans les fichiers CSS)' });
  const verdict = verdictOf(checks, { ok: 'La page est prévue pour les téléphones', warn: 'La page s’affiche sur mobile, avec des gênes', fail: 'La page n’est pas adaptée aux téléphones' });
  return { ...base(p, checks, verdict, access), viewport: vp, signals };
}

/* ------------------------------------------------------------------ */
/* HTTPS et contenu mixte                                              */
/* ------------------------------------------------------------------ */

const ACTIVE = new Set(['script', 'iframe', 'object', 'embed', 'link:stylesheet', 'form', 'link:preload']);

export function mixedContent(html: string): MixedItem[] {
  const h = stripComments(html);
  const out: MixedItem[] = [];
  const push = (url: string | undefined, tag: string) => {
    if (!url || !/^http:\/\//i.test(url.trim())) return;
    if (out.some((o) => o.url === url && o.tag === tag) || out.length >= 100) return;
    out.push({ url: url.trim(), tag, active: ACTIVE.has(tag) });
  };
  for (const t of tags(h, 'script')) push(t.attrs.src, 'script');
  for (const t of tags(h, 'iframe')) push(t.attrs.src, 'iframe');
  for (const t of tags(h, 'object')) push(t.attrs.data, 'object');
  for (const t of tags(h, 'embed')) push(t.attrs.src, 'embed');
  for (const t of tags(h, 'form')) push(t.attrs.action, 'form');
  for (const t of tags(h, 'link')) {
    const rel = (t.attrs.rel ?? '').toLowerCase();
    if (/stylesheet/.test(rel)) push(t.attrs.href, 'link:stylesheet');
    else if (/preload/.test(rel)) push(t.attrs.href, 'link:preload');
    else if (/icon/.test(rel)) push(t.attrs.href, 'link:icon');
  }
  for (const t of tags(h, 'img')) {
    push(t.attrs.src, 'img');
    push(firstSrcset(t.attrs.srcset), 'img');
  }
  for (const t of tags(h, 'source')) {
    push(t.attrs.src, 'source');
    push(firstSrcset(t.attrs.srcset), 'source');
  }
  for (const t of tags(h, 'video')) {
    push(t.attrs.src, 'video');
    push(t.attrs.poster, 'video');
  }
  for (const t of tags(h, 'audio')) push(t.attrs.src, 'audio');
  for (const m of h.matchAll(/url\(\s*["']?(http:\/\/[^"')\s]+)/gi)) push(m[1], 'css');
  return out;
}

export function analyzeHttps(p: PageFetch, httpVariant: HttpsReport['httpRedirect'] = null, access: AccessInfo | null = null): HttpsReport {
  const https = /^https:/i.test(p.finalUrl);
  const empty = { https, httpRedirect: httpVariant, hsts: null, mixed: [], httpLinks: 0 };
  if (access?.blocked) return { ...blockedBase(p, access), ...empty };
  const html = p.html ?? '';
  const hsts = https ? (p.headers['strict-transport-security'] ?? null) : null;
  const mixed = https ? mixedContent(html) : [];
  let host = '';
  try {
    host = new URL(p.finalUrl).hostname.replace(/^www\./, '');
  } catch {
    /* ignoré */
  }
  const httpLinks = https ? tags(bodyOf(html), 'a').filter((t) => /^http:\/\//i.test(t.attrs.href ?? '') && (() => { try { return new URL(t.attrs.href!).hostname.replace(/^www\./, '') === host; } catch { return false; } })()).length : 0;
  const checks: V6Check[] = [];
  if (!https) checks.push(check('https', 'La page n’est pas en HTTPS', 'fail', 'Les navigateurs affichent « Non sécurisé » ; Google privilégie la version https quand elle existe.', 'Activez un certificat (gratuit avec Let’s Encrypt chez la plupart des hébergeurs) puis redirigez http vers https en 301.'));
  else checks.push(check('https.ok', 'Page servie en HTTPS', 'ok', p.finalUrl));
  if (httpVariant) {
    if (httpVariant.error) checks.push(check('http.variant', 'Version http non vérifiée', 'ok', `${httpVariant.start} : ${httpVariant.error}`, '', true));
    else if (httpVariant.toHttps && httpVariant.status >= 300 && httpVariant.status < 400) checks.push(check('http.redirect', 'http redirige vers https', 'ok', `${httpVariant.start} → ${httpVariant.final} (${httpVariant.status}).`));
    else if (httpVariant.toHttps) checks.push(check('http.redirect', 'http redirige vers https', 'ok', `${httpVariant.start} → ${httpVariant.final}.`));
    else checks.push(check('http.noredirect', 'La version http reste accessible sans redirection', 'warn', `${httpVariant.start} répond ${httpVariant.status} sans renvoyer vers https : deux versions du site coexistent.`, 'Ajoutez une redirection 301 de http vers https pour tout le site (réglage « Forcer HTTPS » chez l’hébergeur ou le CMS).'));
  }
  if (https) {
    if (!hsts) checks.push(check('hsts', 'Pas d’en-tête HSTS', 'warn', 'Le navigateur peut encore tenter la version http avant la redirection.', 'Ajoutez « Strict-Transport-Security: max-age=31536000 » une fois tout le site en https (sous-domaines compris si vous ajoutez includeSubDomains).'));
    else {
      const age = Number(/max-age=(\d+)/i.exec(hsts)?.[1] ?? 0);
      checks.push(age < 15_552_000 ? check('hsts.short', 'HSTS de courte durée', 'warn', `« ${hsts} » : moins de 6 mois.`, 'Montez max-age à 31536000 (un an) quand vous êtes sûr de rester en https.') : check('hsts.ok', 'HSTS actif', 'ok', hsts));
    }
    const active = mixed.filter((m) => m.active);
    const passive = mixed.filter((m) => !m.active);
    if (active.length) checks.push(check('mixed.active', `${pl(active.length, 'ressource active en http', 'ressources actives en http')}`, 'fail', `${active.slice(0, 3).map((m) => `${m.tag.replace('link:', '')} ${clip(m.url, 60)}`).join(' · ')}. Les navigateurs bloquent ces scripts, styles, cadres ou formulaires : une partie de la page ne marche pas.`, 'Remplacez http:// par https:// dans ces adresses (ou retirez le service s’il n’existe pas en https).'));
    if (passive.length) checks.push(check('mixed.passive', `${pl(passive.length, 'image ou média en http', 'images ou médias en http')}`, 'warn', `${passive.slice(0, 3).map((m) => clip(m.url, 60)).join(' · ')}. Le navigateur tente la version https, et la bloque si elle n’existe pas.`, 'Passez ces adresses en https:// (sous WordPress, une recherche-remplacement « http://votre-site » → « https://votre-site » dans la base).'));
    if (!mixed.length) checks.push(check('mixed.ok', 'Aucun contenu mixte', 'ok', 'Toutes les ressources de la page sont appelées en https.'));
    if (httpLinks) checks.push(check('links.http', `${pl(httpLinks, 'lien interne en http', 'liens internes en http')}`, 'warn', 'Chaque clic passe par une redirection de plus.', 'Remplacez ces liens par leur adresse en https.'));
    const ex = extractPage(html, p.finalUrl);
    if (ex.canonical && /^http:\/\//i.test(ex.canonical)) checks.push(check('canonical.http', 'Canonical en http', 'warn', ex.canonical, 'Faites pointer la balise canonical vers l’adresse en https.'));
  }
  const verdict = verdictOf(checks, { ok: 'Connexion sécurisée, sans contenu mixte', warn: 'HTTPS en place, avec des points à finir', fail: https ? 'Du contenu en http casse la page sécurisée' : 'La page n’est pas sécurisée (http)' });
  return { ...base(p, checks, verdict, access), https, httpRedirect: httpVariant, hsts, mixed, httpLinks };
}

/* ------------------------------------------------------------------ */
/* Contenu dupliqué entre deux pages                                   */
/* ------------------------------------------------------------------ */

function side(p: PageFetch): DupSide & { text: string } {
  const html = p.html ?? '';
  const ex = extractPage(html, p.finalUrl);
  const parsed = parseHtml(html);
  const text = parsed.mainText || parsed.bodyText;
  return {
    url: p.requestedUrl,
    finalUrl: p.finalUrl,
    status: p.status,
    title: ex.title ?? null,
    description: ex.metaDescription ?? null,
    h1: ex.h1[0] ?? null,
    canonical: ex.canonical ?? null,
    words: text.split(/\s+/).filter(Boolean).length,
    hash: ex.textHash,
    text,
  };
}

const sameUrl = (a: string | null, b: string) => {
  if (!a) return false;
  const n = (u: string) => {
    try {
      const x = new URL(u);
      return `${x.hostname.replace(/^www\./, '')}${x.pathname.replace(/\/+$/, '') || '/'}${x.search}`;
    } catch {
      return u;
    }
  };
  return n(a) === n(b);
};

export function analyzeDuplicate(pa: PageFetch, pb: PageFetch, access: AccessInfo | null = null): DuplicateReport {
  const A = side(pa);
  const B = side(pb);
  const strip = ({ text: _t, ...s }: DupSide & { text: string }): DupSide => (void _t, s);
  if (access?.blocked) {
    const b = blockedBase(pa, access);
    return { url: pa.requestedUrl, verdict: b.verdict, checks: b.checks, a: strip(A), b: strip(B), similarity: 0, identical: false, shared: [], checkedAt: now(), access };
  }
  const identical = A.hash === B.hash && A.words > 0;
  const sim = identical ? 100 : similarity(A.text, B.text);
  const shared = sim >= 15 ? sharedSentences(A.text, B.text, 5) : [];
  const handled = sameUrl(A.canonical, B.finalUrl) || sameUrl(B.canonical, A.finalUrl);
  const crossSite = (() => {
    try {
      return new URL(A.finalUrl).hostname.replace(/^www\./, '') !== new URL(B.finalUrl).hostname.replace(/^www\./, '');
    } catch {
      return false;
    }
  })();
  const checks: V6Check[] = [];
  if (sameUrl(A.finalUrl, B.finalUrl)) checks.push(check('same', 'Les deux adresses mènent à la même page', 'ok', `Les deux aboutissent à ${A.finalUrl} (redirection) : pas de doublon.`, '', true));
  else if (sim >= 85)
    checks.push(
      check(
        'text.dup',
        identical ? 'Texte identique' : `Textes quasi identiques (${sim} % en commun)`,
        handled ? 'warn' : 'fail',
        handled ? 'Une balise canonical regroupe déjà les deux pages : Google n’en garde qu’une.' : crossSite ? 'Le même texte sur deux sites : Google et les IA n’en citent qu’une version, pas forcément la vôtre.' : 'Google regroupe les doublons et choisit lui-même la page à montrer ; les deux se font concurrence.',
        handled ? 'Si les deux pages doivent exister, différenciez quand même leur texte ; sinon, redirigez l’une vers l’autre en 301.' : crossSite ? 'Réécrivez votre texte avec vos propres faits (zone, délais, prix, exemples) ; si l’autre site vous a copié, demandez-lui une mention de la source.' : 'Fusionnez les deux pages (redirection 301), ou réécrivez l’une avec ce qui la distingue vraiment (ville, produit, public).',
      ),
    );
  else if (sim >= 50) checks.push(check('text.close', `Textes proches (${sim} % en commun)`, 'warn', 'Une bonne partie du texte est commune : typique des pages « ville » ou des fiches produit déclinées.', 'Gardez le gabarit, mais ajoutez à chaque page au moins un tiers de contenu propre (cas réels, prix locaux, questions spécifiques).'));
  else checks.push(check('text.ok', `Textes distincts (${sim} % en commun)`, 'ok', 'Chaque page a son propre contenu.'));
  if (A.title && B.title && fold(A.title) === fold(B.title) && !sameUrl(A.finalUrl, B.finalUrl)) checks.push(check('title.dup', 'Même balise title', 'warn', `« ${clip(A.title, 80)} »`, 'Donnez à chaque page un title qui dit ce qui la distingue.'));
  if (A.description && B.description && fold(A.description) === fold(B.description) && !sameUrl(A.finalUrl, B.finalUrl)) checks.push(check('desc.dup', 'Même meta description', 'warn', `« ${clip(A.description, 80)} »`, 'Rédigez une description propre à chaque page.'));
  if (A.h1 && B.h1 && fold(A.h1) === fold(B.h1) && !sameUrl(A.finalUrl, B.finalUrl)) checks.push(check('h1.dup', 'Même titre H1', 'warn', `« ${clip(A.h1, 80)} »`, 'Un H1 différent par page aide à savoir laquelle répond à quelle question.'));
  if (handled) checks.push(check('canonical', 'Canonical commun', 'ok', `${sameUrl(A.canonical, B.finalUrl) ? 'La première page désigne la seconde' : 'La seconde page désigne la première'} comme version de référence.`, '', true));
  for (const s of [A, B]) if (s.words < 80 && s.status < 400) checks.push(check(`thin.${s === A ? 'a' : 'b'}`, `Page ${s === A ? '1' : '2'} très courte (${s.words} mots)`, 'warn', 'Peu de texte : la comparaison porte surtout sur le menu et le pied de page.', 'Comparez des pages qui ont un vrai contenu, ou étoffez celle-ci.'));
  for (const s of [A, B]) if (s.status >= 400) checks.push(check(`status.${s === A ? 'a' : 'b'}`, `Page ${s === A ? '1' : '2'} en erreur (${s.status})`, 'fail', s.finalUrl, 'Vérifiez l’adresse.'));
  const verdict = verdictOf(checks, { ok: 'Pas de contenu dupliqué entre ces deux pages', warn: sim >= 50 ? 'Contenu en partie dupliqué entre ces deux pages' : 'Pages distinctes, quelques balises en double', fail: 'Ces deux pages se copient' });
  return { url: pa.requestedUrl, verdict, checks, a: strip(A), b: strip(B), similarity: sim, identical, shared, checkedAt: now(), ...(access ? { access } : {}) };
}

/* ------------------------------------------------------------------ */
/* Fraîcheur                                                           */
/* ------------------------------------------------------------------ */

const DAY = 86_400_000;
const STALE_YEAR = /\b(tarifs?|prix|grille tarifaire|catalogue|barème|bareme|programme|planning)\s+((?:19|20)\d{2})\b/gi;
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

export function analyzeFreshness(p: PageFetch, access: AccessInfo | null = null, nowMs = Date.now()): FreshnessReport {
  if (access?.blocked) return { ...blockedBase(p, access), dates: [], latest: null, ageDays: null };
  const html = p.html ?? '';
  const ex = extractPage(html, p.finalUrl);
  const parsed = parseHtml(html);
  const dates: DateSignal[] = [];
  const add = (source: string, value: string | undefined | null) => {
    if (!value) return;
    const t = Date.parse(value);
    dates.push({ source, value: value.slice(0, 40), iso: Number.isFinite(t) ? isoDay(t) : null });
  };
  let ldModified: number | null = null;
  let ldPublished: number | null = null;
  let isArticle = false;
  for (const block of ex.jsonLd)
    for (const n of allNodes(block)) {
      if (typesOf(n).some((t) => /Article|BlogPosting|NewsArticle|Report/.test(t))) isArticle = true;
      const m = str(n.dateModified);
      const d = str(n.datePublished);
      if (m) {
        add('JSON-LD dateModified', m);
        if (Number.isFinite(Date.parse(m))) ldModified = Math.max(ldModified ?? 0, Date.parse(m));
      }
      if (d) {
        add('JSON-LD datePublished', d);
        if (Number.isFinite(Date.parse(d))) ldPublished = Math.max(ldPublished ?? 0, Date.parse(d));
      }
    }
  add('Balise article:modified_time', ex.openGraph['article:modified_time']);
  add('Balise article:published_time', ex.openGraph['article:published_time']);
  for (const t of tags(bodyOf(html), 'time').slice(0, 5)) add('Balise <time>', t.attrs.datetime);
  const vis = visibleDates(parsed.mainText || parsed.bodyText).filter((t) => t <= nowMs + 366 * DAY);
  const visLatest = vis.length ? Math.max(...vis) : null;
  if (visLatest !== null) dates.push({ source: `Date visible dans le texte (${pl(vis.length, 'date', 'dates')})`, value: isoDay(visLatest), iso: isoDay(visLatest) });
  const lm = p.headers['last-modified'];
  const lmT = lm && Number.isFinite(Date.parse(lm)) ? Date.parse(lm) : null;
  if (lm) add('En-tête HTTP Last-Modified', lm);
  const checks: V6Check[] = [];
  const future = dates.filter((d) => d.iso && Date.parse(d.iso) > nowMs + 2 * DAY && !d.source.startsWith('Date visible'));
  if (future.length) checks.push(check('future', 'Date dans le futur', 'fail', future.map((d) => `${d.source} : ${d.iso}`).join(' · '), 'Corrigez la date (souvent un format jour/mois inversé ou un fuseau mal réglé) : Google ignore une date incohérente.'));
  if (visLatest === null) checks.push(check('visible.none', 'Aucune date visible sur la page', isArticle ? 'warn' : 'warn', 'Le lecteur (et l’IA qui le cite) ne sait pas si l’information est à jour.', 'Affichez « Mis à jour le … » près du titre sur les pages d’information (articles, tarifs, guides), et changez-la seulement quand le contenu change.'));
  else checks.push(check('visible.ok', `Date visible : ${isoDay(visLatest)}`, 'ok', `${pl(vis.length, 'date repérée', 'dates repérées')} dans le texte.`));
  if (isArticle && ldModified === null) checks.push(check('ld.modified', 'Article sans dateModified', 'warn', 'Le bloc Article ne dit pas quand il a été revu.', 'Ajoutez dateModified (format AAAA-MM-JJ) au bloc JSON-LD, en même temps que la date visible.'));
  if (ldModified !== null && visLatest !== null && ldModified - visLatest > 30 * DAY) checks.push(check('mismatch', 'Les dates se contredisent', 'warn', `JSON-LD : ${isoDay(ldModified)} ; texte : ${isoDay(visLatest)}.`, 'Gardez les deux dates d’accord. Ne changez jamais une date sans changement réel du contenu : Google le déconseille expressément.'));
  const candidates = [ldModified, ldPublished, visLatest].filter((x): x is number => x !== null && x <= nowMs + 2 * DAY);
  const latest = candidates.length ? Math.max(...candidates) : null;
  const ageDays = latest !== null ? Math.max(0, Math.floor((nowMs - latest) / DAY)) : null;
  if (ageDays !== null && ageDays > 730) checks.push(check('old', `Dernière date il y a ${Math.floor(ageDays / 365)} ans`, 'warn', `La date la plus récente est le ${isoDay(latest!)}.`, 'Relisez la page : si les informations (prix, horaires, offre) ont changé, mettez-la à jour et changez la date ; sinon, laissez-la telle quelle.'));
  else if (ageDays !== null) checks.push(check('recent', ageDays <= 365 ? 'Date de moins d’un an' : 'Date de un à deux ans', 'ok', `Dernière date : ${isoDay(latest!)}.`));
  const year = new Date(nowMs).getUTCFullYear();
  const copy = [...(parsed.bodyText.matchAll(/(?:©|&copy;|copyright)\s*(?:(?:19|20)\d{2}\s*[-–]\s*)?((?:19|20)\d{2})/gi))].map((m) => Number(m[1]));
  if (copy.length && Math.max(...copy) < year - 1) checks.push(check('copyright', `Mention © ${Math.max(...copy)} en pied de page`, 'warn', 'Un pied de page figé donne l’impression d’un site à l’abandon.', 'Mettez l’année à jour (la plupart des thèmes l’écrivent automatiquement).'));
  const stale = [...(parsed.mainText || parsed.bodyText).matchAll(STALE_YEAR)].filter((m) => Number(m[2]) < year);
  if (stale.length) checks.push(check('stale', `« ${stale[0][0]} » affiché`, 'warn', 'Une page de prix ou de programme datée d’une année passée fait douter de toute la page.', 'Mettez à jour la grille (ou retirez l’année si les prix n’ont pas changé).'));
  if (lmT !== null && Math.abs(lmT - nowMs) < 10 * 60_000) checks.push(check('lastmod.now', 'Last-Modified = maintenant', 'ok', 'Le serveur génère la page à chaque visite : cet en-tête ne dit rien de la vraie date de mise à jour.', '', true));
  const verdict = verdictOf(checks, { ok: 'La page dit clairement quand elle a été mise à jour', warn: latest === null ? 'Rien n’indique quand la page a été mise à jour' : 'Dates présentes, à clarifier', fail: 'Les dates de la page sont incohérentes' });
  return { ...base(p, checks, verdict, access), dates, latest: latest !== null ? isoDay(latest) : null, ageDays };
}

/* ------------------------------------------------------------------ */
/* Résultats enrichis Google                                           */
/* ------------------------------------------------------------------ */

export function analyzeRich(p: PageFetch, access: AccessInfo | null = null): RichReport {
  const empty = { blocks: 0, parseErrors: [], types: [], items: [], microdata: [] };
  if (access?.blocked) return { ...blockedBase(p, access), ...empty };
  const html = p.html ?? '';
  const ex = extractPage(html, p.finalUrl);
  const microdata = microdataTypes(html);
  const r = richResults(ex.jsonLd, ex.jsonLdErrors, microdata);
  const checks = [...r.checks];
  if (access && !access.blocked && access.state === 'js_only') checks.unshift(check('js', 'Page construite en JavaScript', 'warn', 'Le JSON-LD ajouté par script n’est pas lu ici ; Google peut le lire après rendu, la plupart des robots d’IA non.', 'Placez le bloc JSON-LD dans le HTML envoyé par le serveur.'));
  return { ...base(p, checks, checks.length === r.checks.length ? r.verdict : verdictOf(checks, { ok: r.verdict.title, warn: r.verdict.title, fail: r.verdict.title }), access), blocks: ex.jsonLd.length + ex.jsonLdErrors.length, parseErrors: ex.jsonLdErrors, types: r.types, items: r.items, microdata };
}
