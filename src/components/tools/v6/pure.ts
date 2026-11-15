/**
 * Logique pure des outils V6, utilisable dans le navigateur comme sur le serveur (aucun réseau, aucun module Node) :
 * largeur en pixels et troncature Google, lisibilité en français, générateur de robots.txt, codes hreflang, dates.
 */
import { AI_BOTS, ROLE_LABELS, SEARCH_CRITICAL } from '@/lib/siteaudit/bots';
import { decide, parseRobots } from '@/lib/siteaudit/robots';
import type {
  BotPolicy,
  CheckStatus,
  ReadabilityReport,
  RobotsGenInput,
  RobotsGenResult,
  RobotsProfile,
  SerpLine,
  SerpPreview,
  V6Check,
  Verdict,
} from './types';

/* ------------------------------------------------------------------ */
/* Verdict                                                             */
/* ------------------------------------------------------------------ */

const RANK: Record<CheckStatus, number> = { ok: 0, warn: 1, fail: 2 };

/** Le pire statut des contrôles non informatifs. */
export function worst(checks: V6Check[]): CheckStatus {
  let w: CheckStatus = 'ok';
  for (const c of checks) if (!c.informational && RANK[c.status] > RANK[w]) w = c.status;
  return w;
}

export function count(checks: V6Check[], status: CheckStatus): number {
  return checks.filter((c) => !c.informational && c.status === status).length;
}

export const pl = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export function check(id: string, label: string, status: CheckStatus, detail: string, fix = '', informational = false): V6Check {
  return { id, label, status, detail, fix: status === 'ok' && !informational ? '' : fix, ...(informational ? { informational: true } : {}) };
}

/* ------------------------------------------------------------------ */
/* Largeur en pixels (Arial, police des résultats Google)              */
/* ------------------------------------------------------------------ */

/** Chasses d'Arial en millièmes de cadratin (métriques AFM publiques). Inconnu : 556. */
const W: Record<string, number> = {
  ' ': 278, '!': 278, '"': 355, '#': 556, $: 556, '%': 889, '&': 667, "'": 191, '(': 333, ')': 333, '*': 389, '+': 584,
  ',': 278, '-': 333, '.': 278, '/': 278, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015,
  '[': 278, '\\': 278, ']': 278, '^': 469, _: 556, '`': 333, '{': 334, '|': 260, '}': 334, '~': 584,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833, N: 722,
  O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833, n: 556,
  o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  '’': 222, '‘': 222, '“': 333, '”': 333, '«': 556, '»': 556, '–': 556, '—': 1000, '…': 1000, '€': 556, '·': 278,
  '\u00a0': 278, '\u202f': 278, œ: 944, Œ: 1000, æ: 889, Æ: 1000, ß: 611,
};
for (let d = 0; d <= 9; d++) W[String(d)] = 556;

function charWidth(ch: string): number {
  const w = W[ch];
  if (w !== undefined) return w;
  const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return W[base] ?? 556;
}

/** Largeur estimée d'un texte en pixels pour une taille de police donnée. */
export function textWidth(s: string, fontPx: number): number {
  let total = 0;
  for (const ch of s) total += charWidth(ch);
  return Math.round((total * fontPx) / 1000);
}

/** Coupe au dernier mot entier qui tient avec « … », comme le fait l'affichage de Google. */
export function truncateToWidth(s: string, maxPx: number, fontPx: number): SerpLine {
  const full = s.replace(/\s+/g, ' ').trim();
  const width = textWidth(full, fontPx);
  const base = { full, width, chars: [...full].length, limit: maxPx };
  if (width <= maxPx) return { ...base, shown: full, truncated: false };
  const ell = textWidth(' …', fontPx);
  const words = full.split(' ');
  let shown = '';
  for (const w of words) {
    const next = shown ? `${shown} ${w}` : w;
    if (textWidth(next, fontPx) + ell > maxPx) break;
    shown = next;
  }
  if (!shown) {
    // Un seul mot trop long : coupe au caractère.
    for (const ch of full) {
      if (textWidth(shown + ch, fontPx) + ell > maxPx) break;
      shown += ch;
    }
  }
  return { ...base, shown: `${shown.replace(/[\s,;:–—-]+$/, '')} …`, truncated: true };
}

/** Repères d'affichage (estimations publiques, Google ne publie pas de limite : il coupe à la largeur). */
export const SERP = { titlePx: 600, titleFont: 20, descDesktopPx: 920, descMobilePx: 680, descFont: 14 } as const;

export function breadcrumbOf(url: string): { host: string; crumb: string } {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const parts = u.pathname.split('/').filter(Boolean).map((p) => decodeURIComponent(p).replace(/\.(html?|php|aspx?)$/i, ''));
    return { host, crumb: [u.hostname, ...parts.slice(0, 3)].join(' › ') };
  } catch {
    return { host: url, crumb: url };
  }
}

export function serpPreview(input: { title: string; description: string; url: string; pageText?: string }): SerpPreview {
  const hasDesc = input.description.trim().length > 0;
  const desc = hasDesc ? input.description : (input.pageText ?? '').slice(0, 320);
  const { host, crumb } = breadcrumbOf(input.url);
  return {
    title: truncateToWidth(input.title, SERP.titlePx, SERP.titleFont),
    descDesktop: truncateToWidth(desc, SERP.descDesktopPx, SERP.descFont),
    descMobile: truncateToWidth(desc, SERP.descMobilePx, SERP.descFont),
    breadcrumb: crumb,
    host,
    descriptionFromPage: !hasDesc && desc.length > 0,
  };
}

/** Contrôles du title et de la meta description (aperçu et vérificateur). */
export function titleDescriptionChecks(title: string, description: string): V6Check[] {
  const out: V6Check[] = [];
  const t = title.replace(/\s+/g, ' ').trim();
  const d = description.replace(/\s+/g, ' ').trim();
  const tw = textWidth(t, SERP.titleFont);
  if (!t) out.push(check('title.missing', 'La page n’a pas de titre', 'fail', 'Sans balise <title>, Google fabrique un titre à partir de la page, souvent peu parlant.', 'Ajoutez un titre de 50 à 60 caractères : ce que vous proposez, où, et votre nom.'));
  else if ([...t].length < 30) out.push(check('title.short', `Titre court : ${[...t].length} caractères`, 'warn', `« ${t} » laisse de la place inutilisée : Google affiche environ ${SERP.titlePx} pixels.`, 'Précisez l’offre et le lieu, par exemple « Plombier à Lyon 3 : dépannage en 2 h | Martin ».'));
  else if (tw > SERP.titlePx) out.push(check('title.long', `Titre coupé dans Google (${tw} px sur ${SERP.titlePx})`, 'warn', `Environ ${[...t].length} caractères : la fin sera remplacée par « … ».`, 'Placez l’essentiel au début et raccourcissez la fin (le nom de marque peut passer en dernier).'));
  else out.push(check('title.ok', `Titre de bonne longueur (${[...t].length} caractères, ${tw} px)`, 'ok', 'Il devrait s’afficher en entier en bureau.'));
  if (t && /^(accueil|home|page d.accueil|sans titre|untitled|document)$/i.test(t)) out.push(check('title.generic', 'Titre générique', 'fail', `« ${t} » ne dit pas ce que vous faites.`, 'Remplacez-le par votre activité, votre ville et votre nom.'));
  const dw = textWidth(d, SERP.descFont);
  if (!d) out.push(check('desc.missing', 'Pas de meta description', 'warn', 'Google choisira un extrait de la page, pas toujours le plus engageant.', 'Rédigez 140 à 155 caractères qui résument la page et donnent une raison de cliquer.'));
  else if ([...d].length < 70) out.push(check('desc.short', `Description courte : ${[...d].length} caractères`, 'warn', 'Elle occupe moins d’une ligne : Google la remplace plus souvent par un extrait de la page.', 'Visez 140 à 155 caractères : offre, preuve (délai, prix, zone), appel à l’action.'));
  else if (dw > SERP.descDesktopPx) out.push(check('desc.long', `Description coupée en bureau (${dw} px sur ${SERP.descDesktopPx})`, 'warn', `Environ ${[...d].length} caractères : la fin ne s’affichera pas.`, 'Gardez l’essentiel dans les 150 premiers caractères.'));
  else out.push(check('desc.ok', `Description de bonne longueur (${[...d].length} caractères)`, 'ok', 'Elle devrait s’afficher en entier en bureau.'));
  if (d && dw > SERP.descMobilePx && dw <= SERP.descDesktopPx) out.push(check('desc.mobile', 'Description raccourcie sur mobile', 'ok', `Sur téléphone, Google en montre environ ${SERP.descMobilePx} pixels : la fin sera coupée. C’est fréquent et sans gravité si le début est clair.`, '', true));
  if (t && d && t.toLowerCase() === d.toLowerCase()) out.push(check('desc.same', 'Description identique au titre', 'warn', 'La description répète le titre au lieu de le compléter.', 'Utilisez la description pour la preuve et l’appel à l’action.'));
  return out;
}

/* ------------------------------------------------------------------ */
/* Lisibilité en français (Kandel et Moles, 1958)                      */
/* ------------------------------------------------------------------ */

const VOWELS = /[aeiouyàâäéèêëîïôöùûüÿœæ]+/g;

/** Syllabes d'un mot français (approximation : groupes de voyelles, e muet final retiré). */
export function syllablesFr(word: string): number {
  const w = word.toLowerCase().replace(/^[a-z]['’]/, '').replace(/[^a-zàâäéèêëîïôöùûüÿœæç]/g, '');
  if (!w) return /\d/.test(word) ? 1 : 0;
  const groups = w.match(VOWELS)?.length ?? 0;
  let n = groups;
  // e muet final (« table », « tables ») : non prononcé quand le mot a une autre voyelle.
  if (n > 1 && /[^aeiouyàâäéèêëîïôöùûüÿ]es?$/.test(w)) n -= 1;
  // Terminaison verbale « ent » (« ils parlent ») : laissée telle quelle, elle est ambiguë (« souvent »).
  return Math.max(1, n);
}

const STOP = new Set(
  'les des une pour par sur dans avec cette ces qui que quoi dont est sont été être ont avoir mais donc car vous nous elle elles ils leur leurs son ses sa aux du de la le un et en au ou ne pas plus très tout tous toute toutes comme aussi bien sans sous entre vos votre notre nos mon mes ton tes ici cela ceci celui celle ceux aussi peut faire fait chez lors dès'.split(' '),
);

export const KM_BANDS: { min: number; label: string; tone: CheckStatus; audience: string }[] = [
  { min: 80, label: 'Très facile', tone: 'ok', audience: 'Lisible par tous, dès 11 ans.' },
  { min: 70, label: 'Facile', tone: 'ok', audience: 'Grand public, lecture rapide sur téléphone.' },
  { min: 60, label: 'Assez facile', tone: 'ok', audience: 'Grand public : le niveau visé pour une page de service.' },
  { min: 50, label: 'Standard', tone: 'warn', audience: 'Demande un peu d’attention ; raccourcir quelques phrases aide.' },
  { min: 40, label: 'Assez difficile', tone: 'warn', audience: 'Public averti ; trop dense pour une page d’offre.' },
  { min: 0, label: 'Difficile', tone: 'fail', audience: 'Texte de spécialiste : phrases longues et mots longs.' },
];

export function kmBand(score: number) {
  return KM_BANDS.find((b) => score >= b.min) ?? KM_BANDS[KM_BANDS.length - 1];
}

/** Découpe en phrases : ponctuation finale, ou fin de ligne (titres, puces). */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/(?<=[.!?…])\s+|\n+/u)
    .map((s) => s.trim())
    .filter((s) => /[\p{L}\p{N}]/u.test(s));
}

const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;

export function readability(input: string): ReadabilityReport {
  const text = input.replace(/ /g, ' ').trim();
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const sents = splitSentences(text);
  const wordsList = text.match(WORD_RE) ?? [];
  const words = wordsList.length;
  const syllables = wordsList.reduce((a, w) => a + syllablesFr(w), 0);
  const sentences = Math.max(1, sents.length);
  const wps = words ? words / sentences : 0;
  const spw = words ? syllables / words : 0;
  const raw = words ? 207 - 1.015 * wps - 73.6 * spw : 0;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const band = kmBand(score);
  const longSentences = sents.filter((s) => (s.match(WORD_RE) ?? []).length > 25);
  const longParagraphs = paragraphs.filter((p) => (p.match(WORD_RE) ?? []).length > 120).length;
  const freq = new Map<string, number>();
  for (const w of wordsList) {
    const k = w.toLowerCase().replace(/^[a-z]['’]/, '');
    if (k.length < 3 || STOP.has(k) || /^\d+$/.test(k)) continue;
    freq.set(k, (freq.get(k) ?? 0) + 1);
  }
  const topWords = [...freq.entries()]
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))
    .slice(0, 8)
    .map(([word, c]) => ({ word, count: c, share: words ? Math.round((c / words) * 1000) / 10 : 0 }));

  const checks: V6Check[] = [];
  const tooShort = words < 40;
  if (tooShort) checks.push(check('read.short', `Texte court : ${pl(words, 'mot', 'mots')}`, 'warn', 'Sous 40 mots, l’indice de lisibilité n’est pas fiable.', 'Collez un texte plus long, par exemple le contenu complet de la page.'));
  checks.push(
    check(
      'read.score',
      `Indice de lisibilité : ${score} sur 100 (${band.label.toLowerCase()})`,
      tooShort ? 'warn' : band.tone,
      `${band.audience} Moyenne : ${wps.toFixed(1).replace('.', ',')} mots par phrase, ${spw.toFixed(2).replace('.', ',')} syllabes par mot.`,
      'Raccourcissez les phrases (une idée par phrase) et préférez les mots courts et concrets.',
    ),
  );
  const longShare = sents.length ? longSentences.length / sents.length : 0;
  checks.push(
    check(
      'read.long',
      longSentences.length ? `${pl(longSentences.length, 'phrase dépasse', 'phrases dépassent')} 25 mots` : 'Aucune phrase de plus de 25 mots',
      longShare > 0.25 ? 'fail' : longSentences.length ? 'warn' : 'ok',
      longSentences.length ? `Soit ${Math.round(longShare * 100)} % des phrases. Ce sont les plus difficiles à suivre, et à reprendre telles quelles par une IA.` : 'Les phrases restent courtes.',
      'Coupez chaque phrase longue en deux au niveau d’un « et », d’un « qui » ou d’une virgule.',
    ),
  );
  if (paragraphs.length > 1 || words > 150) {
    checks.push(
      check(
        'read.para',
        longParagraphs ? `${pl(longParagraphs, 'paragraphe dépasse', 'paragraphes dépassent')} 120 mots` : 'Paragraphes aérés',
        longParagraphs ? 'warn' : 'ok',
        longParagraphs ? 'Un bloc de texte très long décourage la lecture sur téléphone.' : 'Aucun paragraphe ne dépasse 120 mots.',
        'Ajoutez un intertitre ou une liste tous les 3 à 4 paragraphes.',
      ),
    );
  }
  const heavy = topWords.find((t) => t.share >= 4 && words >= 150);
  if (heavy) checks.push(check('read.repeat', `« ${heavy.word} » revient souvent (${heavy.share.toString().replace('.', ',')} % des mots)`, 'warn', 'Une répétition forcée se lit mal et n’aide pas Google, qui comprend les synonymes.', 'Variez avec des synonymes ou des pronoms.'));

  const tone = worst(checks);
  const verdict: Verdict = !words
    ? { tone: 'warn', title: 'Aucun texte à analyser', text: 'Collez un texte en français.' }
    : {
        tone,
        title: tone === 'ok' ? `Texte facile à lire : ${score} sur 100` : tone === 'warn' ? `Texte lisible, mais perfectible : ${score} sur 100` : `Texte difficile à lire : ${score} sur 100`,
        text: `${pl(words, 'mot', 'mots')}, ${pl(sents.length, 'phrase', 'phrases')}, environ ${pl(Math.max(1, Math.round(words / 230)), 'minute', 'minutes')} de lecture.`,
      };
  return {
    words,
    sentences: sents.length,
    paragraphs: paragraphs.length,
    characters: [...text].length,
    syllables,
    score,
    band,
    wordsPerSentence: Math.round(wps * 10) / 10,
    syllablesPerWord: Math.round(spw * 100) / 100,
    readingMinutes: words ? Math.max(1, Math.round(words / 230)) : 0,
    longSentences: longSentences.slice(0, 5),
    longParagraphs,
    topWords,
    verdict,
    checks,
  };
}

/* ------------------------------------------------------------------ */
/* Générateur de robots.txt                                            */
/* ------------------------------------------------------------------ */

/** Moteurs de recherche classiques : autorisés par défaut, hors des profils IA. */
export const SEARCH_ENGINES = ['Googlebot', 'Bingbot', 'Applebot'];
export const GEN_BOTS = AI_BOTS.filter((b) => !SEARCH_ENGINES.includes(b.token));
export const ALL_GEN_BOTS = [...AI_BOTS.filter((b) => SEARCH_ENGINES.includes(b.token)), ...GEN_BOTS];

export function profileBots(p: Exclude<RobotsProfile, 'perso'>): Record<string, BotPolicy> {
  const out: Record<string, BotPolicy> = {};
  for (const b of ALL_GEN_BOTS) {
    if (SEARCH_ENGINES.includes(b.token)) out[b.token] = 'allow';
    else if (p === 'ouvert') out[b.token] = 'allow';
    else if (p === 'cite') out[b.token] = b.role === 'training' || b.role === 'control' ? 'block' : 'allow';
    else out[b.token] = 'block';
  }
  return out;
}

export function detectProfile(bots: Record<string, BotPolicy>): RobotsProfile {
  for (const p of ['ouvert', 'cite', 'ferme'] as const) {
    const ref = profileBots(p);
    if (ALL_GEN_BOTS.every((b) => (bots[b.token] ?? 'allow') === ref[b.token])) return p;
  }
  return 'perso';
}

/** Lignes saisies (une par ligne ou séparées par des virgules), nettoyées et dédoublonnées. */
export function splitList(s: string): string[] {
  return [...new Set(s.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean))];
}

export function generateRobots(input: RobotsGenInput, today = new Date().toISOString().slice(0, 10)): RobotsGenResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const disallow = input.disallow.filter((p) => {
    if (/^[/*]/.test(p) && !/\s/.test(p)) return true;
    errors.push(`« ${p} » n’est pas un chemin : il doit commencer par « / » (ex. /admin/).`);
    return false;
  });
  const sitemaps = input.sitemaps.filter((s) => {
    if (/^https?:\/\/[^\s/]+\.[^\s/]+\/\S*$/i.test(s)) return true;
    errors.push(`« ${s} » n’est pas une adresse complète de sitemap (ex. https://votre-site.fr/sitemap.xml).`);
    return false;
  });
  const blocked = ALL_GEN_BOTS.filter((b) => (input.bots[b.token] ?? 'allow') === 'block');
  const lines: string[] = [`# robots.txt proposé par l’outil gratuit de Repéré le ${today}.`, '# Relisez-le, puis déposez-le à la racine de votre site (https://votre-site.fr/robots.txt).', ''];
  lines.push('User-agent: *');
  if (disallow.includes('/')) warnings.push('« Disallow: / » pour tous les robots interdit tout votre site, y compris à Google.');
  if (disallow.length) for (const p of disallow) lines.push(`Disallow: ${p}`);
  else lines.push('Allow: /');
  const groups: [string, typeof blocked][] = [
    ['Moteurs de recherche bloqués (déconseillé)', blocked.filter((b) => SEARCH_ENGINES.includes(b.token))],
    ['Robots d’IA d’entraînement et jetons de contrôle bloqués', blocked.filter((b) => !SEARCH_ENGINES.includes(b.token) && (b.role === 'training' || b.role === 'control'))],
    ['Robots d’IA de recherche ou de lecture à la demande bloqués', blocked.filter((b) => !SEARCH_ENGINES.includes(b.token) && (b.role === 'search' || b.role === 'user'))],
  ];
  for (const [title, list] of groups) {
    if (!list.length) continue;
    lines.push('', `# ${title}`);
    for (const b of list) lines.push(`User-agent: ${b.token}`);
    lines.push('Disallow: /');
  }
  if (sitemaps.length) {
    lines.push('');
    for (const s of sitemaps) lines.push(`Sitemap: ${s}`);
  }
  const text = `${lines.join('\n')}\n`;

  // Vérification par notre propre lecteur RFC 9309 : ce que chaque robot pourra réellement lire.
  const parsed = parseRobots(text);
  const sample = disallow.find((p) => p !== '/' && p.startsWith('/'))?.replace(/\*.*$/, '') || null;
  const rows = ALL_GEN_BOTS.map((b) => ({
    token: b.token,
    operator: b.operator,
    roleLabel: SEARCH_ENGINES.includes(b.token) ? 'Moteur de recherche' : ROLE_LABELS[b.role],
    allowedHome: decide(parsed, b.token, '/').allowed,
    blockedSample: sample ? !decide(parsed, b.token, sample).allowed : null,
  }));
  const blockedCritical = rows.filter((r) => !r.allowedHome && SEARCH_CRITICAL.includes(r.token)).map((r) => r.token);
  const blockedSearchAi = blocked.filter((b) => !SEARCH_ENGINES.includes(b.token) && (b.role === 'search' || b.role === 'user')).map((b) => b.token);
  if (blockedCritical.length) warnings.push(`${blockedCritical.join(', ')} ${blockedCritical.length > 1 ? 'sont bloqués' : 'est bloqué'} : vos pages disparaîtront de ${blockedCritical.some((t) => t === 'Googlebot' || t === 'Bingbot') ? 'la recherche classique et ' : ''}des réponses d’IA avec sources.`);
  else if (blockedSearchAi.length) warnings.push(`${blockedSearchAi.join(', ')} : ces robots servent à lire ou citer vos pages dans les réponses ; les bloquer réduit vos chances d’être cité.`);
  if (!sitemaps.length) warnings.push('Ajoutez l’adresse de votre sitemap : c’est la ligne la plus utile du fichier pour les moteurs.');

  const tone: CheckStatus = errors.length || blockedCritical.length || disallow.includes('/') ? 'fail' : blockedSearchAi.length || !sitemaps.length ? 'warn' : 'ok';
  const trainingBlocked = blocked.filter((b) => b.role === 'training' || b.role === 'control').length;
  const verdict: Verdict = {
    tone,
    title:
      tone === 'fail'
        ? 'Ce robots.txt bloque des robots qui vous rendent visible'
        : blockedSearchAi.length
          ? 'Fichier valide, mais certaines IA ne pourront pas vous citer'
          : trainingBlocked
            ? 'Fichier prêt : cité par les IA, sans servir à leur entraînement'
            : 'Fichier prêt : moteurs et IA peuvent lire votre site',
    text: `${pl(blocked.length, 'robot bloqué', 'robots bloqués')}, ${pl(disallow.length, 'chemin interdit', 'chemins interdits')} à tous, ${pl(sitemaps.length, 'sitemap déclaré', 'sitemaps déclarés')}.`,
  };
  return { text, rows, verdict, warnings, errors };
}

/* ------------------------------------------------------------------ */
/* hreflang                                                            */
/* ------------------------------------------------------------------ */

const ISO639_1 = new Set(
  'aa ab ae af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu'.split(' '),
);
const ISO3166 = new Set(
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' '),
);

/** Valide un code hreflang (langue ISO 639-1, écriture facultative, région ISO 3166-1 ou 419). */
export function hreflangCode(code: string): { valid: boolean; issue?: string } {
  const c = code.trim();
  if (c.toLowerCase() === 'x-default') return { valid: true };
  if (c.includes('_')) return { valid: false, issue: `Le séparateur est un tiret : « ${c.replace(/_/g, '-')} », pas « ${c} ».` };
  const parts = c.split('-');
  const lang = parts[0].toLowerCase();
  if (!ISO639_1.has(lang)) {
    if (ISO3166.has(parts[0].toUpperCase()) && parts.length === 1) return { valid: false, issue: `« ${c} » ressemble à un pays : hreflang commence toujours par la langue (ex. fr-${parts[0].toUpperCase()}).` };
    return { valid: false, issue: `« ${parts[0]} » n’est pas un code de langue ISO 639-1.` };
  }
  let rest = parts.slice(1);
  if (rest[0] && /^[a-z]{4}$/i.test(rest[0])) rest = rest.slice(1); // écriture (zh-Hant)
  if (rest.length > 1) return { valid: false, issue: `Format attendu : langue-RÉGION (ex. fr-BE), pas « ${c} ».` };
  if (rest.length === 1) {
    const r = rest[0].toUpperCase();
    if (r === 'UK') return { valid: false, issue: 'Le Royaume-Uni s’écrit GB en ISO 3166-1 (en-GB), pas UK.' };
    if (r === 'EU' || r === 'UN') return { valid: false, issue: `« ${r} » n’est pas un pays : Google n’accepte pas les régions de ce type.` };
    if (r !== '419' && !ISO3166.has(r)) return { valid: false, issue: `« ${rest[0]} » n’est pas un code de pays ISO 3166-1.` };
  }
  return { valid: true };
}

/* ------------------------------------------------------------------ */
/* Dates de sitemap (format W3C)                                       */
/* ------------------------------------------------------------------ */

const W3C = /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?)?)?$/;

export function lastmodIssue(v: string, now = Date.now()): 'format' | 'future' | null {
  const s = v.trim();
  if (!W3C.test(s)) return 'format';
  const t = Date.parse(s.length === 4 ? `${s}-01-01` : s.length === 7 ? `${s}-01` : s);
  if (!Number.isFinite(t)) return 'format';
  if (t > now + 2 * 86_400_000) return 'future';
  return null;
}
