/**
 * Outils V7 : calculs sans réseau, utilisables dans le navigateur comme sur le serveur.
 * - résultats enrichis Google (règles de src/lib/seoaudit/schema.ts) à partir de blocs JSON-LD déjà lus ;
 * - similarité de deux textes (suites de 5 mots) ;
 * - cohérence NAP (nom, adresse, téléphone) entre plusieurs fiches saisies ;
 * - générateur de liens UTM (et canal GA4 estimé d'après les règles publiées par Google) ;
 * - fiche « faits clés » (HTML visible et Markdown pour llms.txt / page À propos).
 * Rien n'est inventé : chaque sortie ne reprend que ce qui a été saisi ou lu.
 */
import { DEPRECATED, RULES, ruleFor, validateNodes, type SdIssue } from '@/lib/seoaudit/schema';
import { check, count, pl, worst } from '../v6/pure';
import type {
  FactsInput,
  FactsResult,
  NapEntry,
  NapMatch,
  NapReport,
  NapRow,
  RichItem,
  RichStatus,
  UtmInput,
  UtmResult,
  V6Check,
  Verdict,
} from './types';

export { check, count, pl, worst };

/** Verdict à partir des contrôles : ton le plus grave, phrase-résultat selon le ton. */
export function verdictOf(checks: V6Check[], titles: Record<'ok' | 'warn' | 'fail', string>, text?: string): Verdict {
  const tone = worst(checks);
  const f = count(checks, 'fail');
  const w = count(checks, 'warn');
  return {
    tone,
    title: titles[tone],
    text: text ?? (tone === 'ok' ? 'Aucun point bloquant.' : [f ? pl(f, 'point à corriger', 'points à corriger') : '', w ? pl(w, 'point à améliorer', 'points à améliorer') : ''].filter(Boolean).join(', ') + '.'),
  };
}

/** Minuscules, sans accents, ponctuation réduite à des espaces. */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const tokens = (s: string) => fold(s).split(' ').filter(Boolean);

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/* ------------------------------------------------------------------ */
/* Résultats enrichis Google                                           */
/* ------------------------------------------------------------------ */

const FR_PROP: Record<string, string> = { name: 'nom', address: 'adresse', image: 'image', offers: 'offre (prix)', price: 'prix', priceCurrency: 'devise' };
const propLabel = (p: string) => p.split(' ou ').map((x) => (FR_PROP[x] ? `${x} (${FR_PROP[x]})` : x)).join(' ou ');

/** Types sans résultat enrichi Google, mais utiles aux moteurs et aux IA pour comprendre la page. */
const NO_FEATURE: Record<string, string> = {
  WebSite: 'Nom du site dans les résultats (name, url)',
  WebPage: 'Aucun affichage enrichi : décrit la page',
  Service: 'Aucun affichage enrichi : décrit une prestation',
  Person: 'Aucun affichage enrichi : décrit une personne (auteur)',
  Place: 'Aucun affichage enrichi',
  PostalAddress: 'Partie d’une adresse',
  ContactPoint: 'Partie d’une organisation',
  ImageObject: 'Partie d’un autre élément',
  ListItem: 'Partie d’une liste',
  Question: 'Partie d’une FAQ',
  Answer: 'Partie d’une FAQ',
  Rating: 'Partie d’un avis',
  Brand: 'Partie d’un produit',
  OpeningHoursSpecification: 'Partie d’un établissement',
  GeoCoordinates: 'Partie d’un établissement',
  ItemList: 'Liste (carrousel seulement avec certains types)',
};

export interface RichAnalysis {
  types: string[];
  items: RichItem[];
  checks: V6Check[];
  verdict: Verdict;
}

/** Évalue des blocs JSON-LD lus (valeurs) contre les exigences de Google, type par type. */
export function richResults(values: unknown[], parseErrors: string[] = [], microdata: string[] = []): RichAnalysis {
  const { types, issues } = values.length ? validateNodes(values) : { types: [] as string[], issues: [] as SdIssue[] };
  const keyOf = (t: string) => ruleFor(t)?.as ?? t;
  const byKey = new Map<string, RichItem>();
  for (const t of types) {
    const k = keyOf(t);
    if (byKey.has(k)) continue;
    const r = ruleFor(t);
    byKey.set(k, {
      type: k === t ? t : `${t} (règles ${k})`,
      feature: r ? r.rule.feature : (NO_FEATURE[t] ?? 'Aucun résultat enrichi Google pour ce type'),
      doc: r ? r.rule.doc : null,
      status: r ? 'eligible' : 'none',
      required: [],
      recommended: [],
      invalid: [],
      notes: [],
    });
  }
  const context: string[] = [];
  for (const i of issues) {
    if (i.level === 'context') {
      context.push(i.message);
      continue;
    }
    const it = byKey.get(keyOf(i.type));
    if (!it) continue;
    if (i.level === 'required' && i.prop && !it.required.includes(i.prop)) it.required.push(i.prop);
    else if (i.level === 'recommended' && i.prop && !it.recommended.includes(i.prop)) it.recommended.push(i.prop);
    else if (i.level === 'invalid') it.invalid.push(i.message);
    else if (i.level === 'deprecated') it.notes.push(i.message);
    else if (i.level === 'self_serving') it.notes.push(i.message);
  }
  for (const it of byKey.values()) {
    const base = it.type.split(' ')[0];
    const st: RichStatus = DEPRECATED[base] ? 'deprecated' : it.status === 'none' ? 'none' : it.invalid.length ? 'invalid' : it.required.length ? 'incomplete' : 'eligible';
    it.status = st;
  }
  // Les types principaux (ceux qui ont une règle) d'abord, les parties (ListItem, PostalAddress…) ensuite.
  const items = [...byKey.values()].sort((a, b) => Number(a.status === 'none') - Number(b.status === 'none'));
  const checks: V6Check[] = [];
  if (parseErrors.length) checks.push(check('rich.parse', pl(parseErrors.length, 'bloc JSON-LD illisible', 'blocs JSON-LD illisibles'), 'fail', parseErrors.slice(0, 3).join(' '), 'Un bloc mal formé est ignoré en entier par Google : corrigez la virgule ou le guillemet en cause (validez le code dans le mode « Coller du code »).'));
  if (!values.length && !parseErrors.length) {
    checks.push(
      check(
        'rich.none',
        'Aucune donnée structurée JSON-LD sur la page',
        'warn',
        microdata.length ? `Balisage microdonnées repéré (${microdata.slice(0, 4).join(', ')}) : Google le lit, mais le JSON-LD est le format qu’il recommande.` : 'Sans balisage, Google et les IA déduisent qui vous êtes du seul texte.',
        'Ajoutez au moins un bloc qui décrit votre activité (LocalBusiness ou Organization) : le générateur JSON-LD de Repéré le prépare.',
      ),
    );
  }
  for (const c of context) checks.push(check('rich.context', '@context absent ou incorrect', 'fail', c, 'Commencez chaque bloc par "@context": "https://schema.org".'));
  for (const it of items) {
    if (it.status === 'none') continue;
    const id = `rich.${it.type.split(' ')[0]}`;
    if (it.status === 'deprecated') checks.push(check(`${id}.deprecated`, `${it.type} : plus affiché par Google`, 'warn', it.notes[0] ?? '', 'Rien d’urgent : le balisage ne nuit pas. N’en attendez pas d’affichage enrichi ; gardez-le s’il décrit fidèlement la page.', true));
    else if (it.status === 'invalid') checks.push(check(`${id}.invalid`, `${it.type} : valeur au mauvais format`, 'fail', it.invalid.slice(0, 3).join(' · '), 'Corrigez le format indiqué : Google ignore une valeur qu’il ne sait pas lire.'));
    else if (it.status === 'incomplete') checks.push(check(`${id}.required`, `${it.type} : il manque ${pl(it.required.length, 'propriété obligatoire', 'propriétés obligatoires')}`, 'fail', `Manque : ${it.required.map(propLabel).join(', ')}. Sans elle, pas de « ${it.feature} » dans Google.`, `Ajoutez ${it.required.map(propLabel).join(', ')} au bloc ${it.type.split(' ')[0]}, avec des valeurs visibles sur la page.`));
    else checks.push(check(`${id}.ok`, `${it.type} : obligatoires présentes`, 'ok', `Éligible à « ${it.feature} » (sans garantie d’affichage : Google décide).`));
    if (it.status !== 'deprecated' && it.recommended.length)
      checks.push(check(`${id}.recommended`, `${it.type} : ${pl(it.recommended.length, 'propriété recommandée absente', 'propriétés recommandées absentes')}`, 'warn', it.recommended.map(propLabel).join(', '), 'Facultatif, mais chaque propriété recommandée rend l’affichage plus complet et l’entreprise moins ambiguë.'));
    for (const n of it.notes) if (/auto-attribués/.test(n)) checks.push(check(`${id}.self`, `${it.type} : avis sur sa propre fiche`, 'warn', n, 'Retirez aggregateRating/review du bloc de l’entreprise ; balisez les avis sur un Product ou un Service.'));
  }
  const featured = items.filter((i) => i.status !== 'none');
  if (values.length && !featured.length) checks.push(check('rich.nofeature', 'Aucun type donnant droit à un résultat enrichi', 'ok', `Types lus : ${types.slice(0, 6).join(', ')}. Utiles pour décrire la page, sans affichage enrichi.`, '', true));
  const ok = featured.filter((i) => i.status === 'eligible').length;
  const verdict = verdictOf(
    checks,
    {
      ok: ok ? `${pl(ok, 'élément éligible', 'éléments éligibles')} aux résultats enrichis de Google` : 'Données structurées lisibles, sans erreur',
      warn: values.length ? 'Données structurées lisibles, à compléter' : 'Aucune donnée structurée sur cette page',
      fail: 'Données structurées à corriger avant que Google les utilise',
    },
  );
  return { types, items, checks, verdict };
}

/** Lit du code collé : JSON brut, ou HTML contenant des blocs <script type="application/ld+json">. */
export function parseJsonLdInput(input: string): { values: unknown[]; errors: string[] } {
  const s = input.trim();
  if (!s) return { values: [], errors: [] };
  const blocks = [...s.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const raws = blocks.length ? blocks : /^[[{]/.test(s) ? [s] : [];
  if (!raws.length) return { values: [], errors: ['Aucun JSON-LD reconnu : collez le bloc <script type="application/ld+json">…</script> ou le JSON lui-même.'] };
  const values: unknown[] = [];
  const errors: string[] = [];
  raws.forEach((r, i) => {
    const t = r.replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, '').trim();
    try {
      values.push(JSON.parse(t));
    } catch (e) {
      errors.push(`Bloc n° ${i + 1} illisible : ${(e as Error).message.slice(0, 120)}.`);
    }
  });
  return { values, errors };
}

export const RICH_TYPES_COUNT = Object.keys(RULES).length;

/* ------------------------------------------------------------------ */
/* Similarité de deux textes                                           */
/* ------------------------------------------------------------------ */

/** Suites de `n` mots (après normalisation). */
export function shingles(text: string, n = 5): string[] {
  const w = tokens(text);
  if (w.length < n) return w.length ? [w.join(' ')] : [];
  const out: string[] = [];
  for (let i = 0; i + n <= w.length; i++) out.push(w.slice(i, i + n).join(' '));
  return out;
}

/** Part du texte commune, de 0 à 100 (Jaccard sur des suites de 5 mots). */
export function similarity(a: string, b: string): number {
  const A = shingles(a);
  const B = shingles(b);
  if (!A.length || !B.length) return 0;
  return Math.round(jaccard(A, B) * 100);
}

/** Phrases (8 mots et plus) présentes dans les deux textes, les plus longues d'abord. */
export function sharedSentences(a: string, b: string, max = 5): string[] {
  const split = (t: string) =>
    t
      .split(/(?<=[.!?])\s+|\n+/)
      .map((x) => x.trim())
      .filter((x) => x.split(/\s+/).length >= 8);
  const inB = new Set(split(b).map(fold));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of split(a).sort((x, y) => y.length - x.length)) {
    const f = fold(s);
    if (inB.has(f) && !seen.has(f)) {
      seen.add(f);
      out.push(s.length > 220 ? `${s.slice(0, 219)}…` : s);
    }
    if (out.length >= max) break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Cohérence NAP                                                       */
/* ------------------------------------------------------------------ */

const LEGAL = new Set(['sarl', 'sas', 'sasu', 'eurl', 'sa', 'sci', 'snc', 'ei', 'eirl', 'ets', 'etablissements', 'etablissement', 'societe', 'ste', 'cie', 'et', 'le', 'la', 'les', 'l', 'de', 'du', 'des', 'd']);

export function normName(s: string): string {
  return tokens(s.replace(/&/g, ' et '))
    .filter((t) => !LEGAL.has(t))
    .join(' ');
}

const ABBR: Record<string, string> = {
  bd: 'boulevard', bld: 'boulevard', boul: 'boulevard', blvd: 'boulevard', av: 'avenue', ave: 'avenue', r: 'rue', pl: 'place', imp: 'impasse', all: 'allee', ch: 'chemin', chem: 'chemin', rte: 'route', fbg: 'faubourg', faub: 'faubourg', st: 'saint', ste: 'sainte', qu: 'quai', sq: 'square', crs: 'cours', pass: 'passage', res: 'residence', zi: 'zone industrielle', za: 'zone artisanale', zac: 'zone activite', cedex: '',
};

export function normAddress(s: string): string {
  return tokens(s)
    .map((t) => (t in ABBR ? ABBR[t] : t))
    .filter((t) => t && t !== 'france')
    .join(' ');
}

export function postcodeOf(s: string): string | null {
  return /\b(?:0[1-9]|[1-8]\d|9[0-8])\d{3}\b/.exec(s)?.[0] ?? null;
}

const streetNumber = (s: string) => /(?:^|[\s,])(\d{1,4})(?:\s?(?:bis|ter|quater))?(?=[\s,])/i.exec(` ${s} `)?.[1] ?? null;

/** Téléphone français normalisé (0XXXXXXXXX) ; autre format : chiffres seuls. */
export function normPhoneFr(s: string): string {
  let d = s.replace(/\(0\)/g, '').replace(/[^\d+]/g, '');
  if (d.startsWith('+33')) d = `0${d.slice(3)}`;
  else if (d.startsWith('0033')) d = `0${d.slice(4)}`;
  return d.replace(/\+/g, '');
}

function compareName(a: string, b: string): NapMatch {
  if (!b.trim()) return 'empty';
  const x = normName(a);
  const y = normName(b);
  if (x === y) return 'same';
  if (x && y && (x.includes(y) || y.includes(x) || jaccard(x.split(' '), y.split(' ')) >= 0.5)) return 'variant';
  return 'different';
}

function compareAddress(a: string, b: string, notes: string[]): NapMatch {
  if (!b.trim()) return 'empty';
  const x = normAddress(a);
  const y = normAddress(b);
  if (x === y) return 'same';
  const pa = postcodeOf(a);
  const pb = postcodeOf(b);
  const na = streetNumber(a);
  const nb = streetNumber(b);
  if (pa && pb && pa !== pb) notes.push(`code postal ${pb} au lieu de ${pa}`);
  if (na && nb && na !== nb) notes.push(`numéro ${nb} au lieu de ${na}`);
  if ((pa && pb && pa !== pb) || (na && nb && na !== nb)) return 'different';
  return jaccard(x.split(' '), y.split(' ')) >= 0.5 ? 'variant' : 'different';
}

function comparePhone(a: string, b: string, notes: string[]): NapMatch {
  if (!b.trim()) return 'empty';
  const x = normPhoneFr(a);
  const y = normPhoneFr(b);
  if (x === y) return 'same';
  if (y.length !== 10 && /^0/.test(y)) notes.push(`numéro « ${b.trim()} » incomplet`);
  return 'different';
}

const MATCH_LABEL: Record<NapMatch, string> = { same: 'identique', variant: 'variante', different: 'différent', empty: 'absent' };
export { MATCH_LABEL };

/** Compare chaque fiche à la référence (votre site, en général). */
export function napConsistency(reference: NapEntry, others: NapEntry[]): NapReport {
  const ref = { ...reference, source: reference.source.trim() || 'Référence' };
  const rows: NapRow[] = others
    .filter((o) => o.name.trim() || o.address.trim() || o.phone.trim())
    .map((o, i) => {
      const notes: string[] = [];
      const row: NapRow = {
        source: o.source.trim() || `Fiche ${i + 1}`,
        name: compareName(ref.name, o.name),
        address: compareAddress(ref.address, o.address, notes),
        phone: comparePhone(ref.phone, o.phone, notes),
        notes,
      };
      return row;
    });
  const checks: V6Check[] = [];
  const refMissing = (['name', 'address', 'phone'] as const).filter((k) => !ref[k].trim());
  if (refMissing.length) checks.push(check('nap.ref', 'Référence incomplète', 'warn', `Il manque : ${refMissing.map((k) => ({ name: 'le nom', address: 'l’adresse', phone: 'le téléphone' })[k]).join(', ')}.`, 'Remplissez la référence avec les informations exactes, telles que vous voulez les voir partout.'));
  if (!rows.length) checks.push(check('nap.empty', 'Aucune autre fiche à comparer', 'warn', 'Ajoutez au moins une fiche (Google, Pages Jaunes, Facebook, annuaire…).', 'Copiez le nom, l’adresse et le téléphone affichés sur chaque fiche.'));
  for (const field of ['name', 'address', 'phone'] as const) {
    const label = { name: 'Nom', address: 'Adresse', phone: 'Téléphone' }[field];
    const fem = field === 'address';
    const e = fem ? 'e' : '';
    const diff = rows.filter((r) => r[field] === 'different');
    const variant = rows.filter((r) => r[field] === 'variant');
    const empty = rows.filter((r) => r[field] === 'empty');
    if (!rows.length) continue;
    if (diff.length)
      checks.push(
        check(
          `nap.${field}.diff`,
          `${label} différent${e} sur ${pl(diff.length, 'fiche', 'fiches')}`,
          'fail',
          diff.map((r) => `${r.source}${r.notes.length && field !== 'name' ? ` (${r.notes.join(', ')})` : ''}`).join(' · '),
          field === 'phone' ? 'Corrigez le numéro sur ces fiches : un client (ou une IA) qui le recopie tombe sur une ligne fausse.' : 'Corrigez ces fiches pour qu’elles reprennent exactement la référence : des informations qui se contredisent rendent l’entreprise ambiguë pour Google et les IA.',
        ),
      );
    if (variant.length) checks.push(check(`nap.${field}.variant`, `${label} écrit${e} autrement sur ${pl(variant.length, 'fiche', 'fiches')}`, 'warn', variant.map((r) => r.source).join(' · '), 'Ce n’est pas une erreur, mais une écriture unique (mêmes abréviations, même nom commercial) évite toute confusion.'));
    if (empty.length) checks.push(check(`nap.${field}.empty`, `${label} absent${e} sur ${pl(empty.length, 'fiche', 'fiches')}`, 'warn', empty.map((r) => r.source).join(' · '), 'Complétez ces fiches si la plateforme le permet.'));
    if (!diff.length && !variant.length && !empty.length) checks.push(check(`nap.${field}.ok`, `${label} identique partout`, 'ok', `${pl(rows.length, 'fiche comparée', 'fiches comparées')}.`));
  }
  const verdict = verdictOf(checks, {
    ok: 'Nom, adresse et téléphone identiques sur toutes vos fiches',
    warn: 'Vos fiches concordent, avec des écarts d’écriture',
    fail: 'Vos fiches se contredisent : à corriger',
  });
  return { reference: ref, rows, verdict, checks };
}

/* ------------------------------------------------------------------ */
/* Générateur UTM                                                      */
/* ------------------------------------------------------------------ */

const SEARCH_SOURCES = /^(google|bing|yahoo|duckduckgo|ecosia|qwant|baidu|yandex|brave|startpage|lilo)$/;
const SOCIAL_SOURCES = /^(facebook|fb|instagram|ig|linkedin|lnkd\.in|twitter|x|t\.co|pinterest|tiktok|snapchat|threads|reddit|messenger|whatsapp)$/;
const VIDEO_SOURCES = /^(youtube|vimeo|dailymotion|twitch)$/;
const PAID = /^(.*cp.*|ppc|retargeting|paid.*)$/;

/**
 * Canal GA4 estimé, d'après les règles du « regroupement de canaux par défaut » publiées par Google (ordre simplifié,
 * sans campagnes Shopping ni listes de sites de Google). Indicatif.
 */
export function ga4Channel(source: string, medium: string): string {
  const s = source.toLowerCase();
  const m = medium.toLowerCase();
  if (SEARCH_SOURCES.test(s) && PAID.test(m)) return 'Recherche payante (Paid Search)';
  if (SOCIAL_SOURCES.test(s) && PAID.test(m)) return 'Réseaux sociaux payants (Paid Social)';
  if (VIDEO_SOURCES.test(s) && PAID.test(m)) return 'Vidéo payante (Paid Video)';
  if (/^(display|banner|expandable|interstitial|cpm)$/.test(m)) return 'Display';
  if (PAID.test(m)) return 'Autre payant (Paid Other)';
  if (SOCIAL_SOURCES.test(s) || /^(social|social-network|social-media|sm|social network|social media)$/.test(m)) return 'Réseaux sociaux (Organic Social)';
  if (VIDEO_SOURCES.test(s) || /^(.*video.*)$/.test(m)) return 'Vidéo (Organic Video)';
  if (SEARCH_SOURCES.test(s) || m === 'organic') return 'Recherche naturelle (Organic Search)';
  if (/^(referral|app|link)$/.test(m)) return 'Site référent (Referral)';
  if (/^(email|e-mail|e_mail|e mail)$/.test(s) || /^(email|e-mail|e_mail|e mail)$/.test(m)) return 'E-mail (Email)';
  if (m === 'affiliate') return 'Affiliation (Affiliates)';
  if (m === 'audio') return 'Audio';
  if (s === 'sms' || m === 'sms') return 'SMS';
  if (/push$/.test(m) || /mobile|notification/.test(m)) return 'Notification mobile (Mobile Push)';
  return 'Non attribué (Unassigned)';
}

export const UTM_PRESETS: { id: string; label: string; hint: string; source: string; medium: string; campaign: string }[] = [
  { id: 'gbp', label: 'Bouton « Site web » de la fiche Google', hint: 'Distingue dans GA4 les visites venues de votre fiche de celles de la recherche classique.', source: 'google', medium: 'organic', campaign: 'fiche-google' },
  { id: 'gbp-rdv', label: 'Lien de prise de rendez-vous de la fiche', hint: 'À coller dans le champ « Lien de réservation » de la fiche.', source: 'google', medium: 'organic', campaign: 'fiche-google-rdv' },
  { id: 'gbp-post', label: 'Publication sur la fiche Google', hint: 'Une campagne par publication si vous voulez comparer.', source: 'google', medium: 'organic', campaign: 'fiche-google-posts' },
  { id: 'newsletter', label: 'Lettre d’information', hint: 'Remplacez la campagne par le mois ou le sujet de l’envoi.', source: 'newsletter', medium: 'email', campaign: 'lettre-mensuelle' },
  { id: 'social', label: 'Publication sur un réseau social', hint: 'Mettez le nom du réseau en source (facebook, instagram, linkedin).', source: 'facebook', medium: 'social', campaign: 'publication' },
  { id: 'qr', label: 'QR code imprimé (affiche, carte, flyer)', hint: 'GA4 range ce support en « Non attribué » : c’est normal pour du papier, filtrez sur la source.', source: 'qr-code', medium: 'print', campaign: 'comptoir' },
];

const clean = (v: string | undefined) => (v ?? '').trim();
const slug = (v: string) => v.trim().toLowerCase().replace(/\s+/g, '-');

/** Construit le lien UTM ; signale les erreurs (adresse, source, support) et les pièges (majuscules, espaces). */
export function buildUtm(input: UtmInput): UtmResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let u: URL | null = null;
  const raw = clean(input.url);
  if (!raw) errors.push('Indiquez l’adresse de la page de destination.');
  else {
    try {
      u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) throw new Error('x');
    } catch {
      u = null;
      errors.push('Cette adresse n’est pas valide. Exemple : https://votre-site.fr/contact');
    }
  }
  const fields: [keyof UtmInput, string][] = [
    ['source', 'utm_source'],
    ['medium', 'utm_medium'],
    ['campaign', 'utm_campaign'],
    ['term', 'utm_term'],
    ['content', 'utm_content'],
  ];
  if (!clean(input.source)) errors.push('La source (utm_source) est obligatoire : d’où vient le visiteur (google, newsletter…).');
  if (!clean(input.medium)) errors.push('Le support (utm_medium) est obligatoire : quel type de lien (organic, email, social…).');
  if (!clean(input.campaign)) warnings.push('Sans nom de campagne (utm_campaign), vous ne pourrez pas distinguer deux opérations de même source.');
  for (const [k] of fields) {
    const v = clean(input[k] as string | undefined);
    if (!v) continue;
    if (/[A-Z]/.test(v)) warnings.push(`« ${v} » contient des majuscules : GA4 distingue « Google » de « google ». Nous l’écrivons en minuscules.`);
    if (/\s/.test(v)) warnings.push(`« ${v} » contient des espaces : remplacés par des tirets.`);
  }
  if (u) {
    if ([...u.searchParams.keys()].some((k) => /^utm_/i.test(k))) warnings.push('L’adresse contenait déjà des paramètres utm_ : ils sont remplacés.');
    if (u.protocol === 'http:') warnings.push('L’adresse est en http : préférez la version https de votre page.');
  }
  let link: string | null = null;
  if (u && !errors.length) {
    for (const k of [...u.searchParams.keys()]) if (/^utm_/i.test(k)) u.searchParams.delete(k);
    for (const [k, p] of fields) {
      const v = clean(input[k] as string | undefined);
      if (v) u.searchParams.set(p, slug(v));
    }
    link = u.toString();
  }
  const channel = ga4Channel(slug(clean(input.source)), slug(clean(input.medium)));
  const verdict: Verdict = errors.length
    ? { tone: 'fail', title: 'Lien incomplet', text: errors[0] }
    : warnings.length
      ? { tone: 'warn', title: 'Lien prêt, avec une remarque', text: `Canal GA4 estimé : ${channel}.` }
      : { tone: 'ok', title: 'Lien de suivi prêt à coller', text: `Canal GA4 estimé : ${channel}.` };
  return { link, channel, errors, warnings, verdict };
}

/* ------------------------------------------------------------------ */
/* Fiche « faits clés »                                                */
/* ------------------------------------------------------------------ */

const SUPERLATIVE = /\b(meilleur(e|s|es)?|n°\s?1|numéro un|numero un|leader|incontournable|le plus (grand|rapide|fiable|sérieux)|imbattable|unique en france|garanti à 100)\b/i;
const HAS_FACT = /\d/;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const lines = (s: string) =>
  s
    .split(/\n+/)
    .map((l) => l.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);

function frDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso.trim();
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return `${Number(m[3]) === 1 ? '1er' : Number(m[3])} ${months[Number(m[2]) - 1] ?? ''} ${m[1]}`;
}

/** Bloc « L'essentiel » visible (HTML) et version Markdown (llms.txt, page À propos). */
export function buildFacts(f: FactsInput): FactsResult {
  const v = (k: keyof FactsInput) => f[k].trim();
  const rows: [string, string][] = (
    [
      ['Activité', v('activity')],
      ['Zone servie', v('area')],
      ['Adresse', v('address')],
      ['Téléphone', v('phone')],
      ['Horaires', v('hours')],
      ['En activité depuis', v('since')],
      ['Prix indicatifs', v('prices')],
      ['Site', v('site')],
    ] as [string, string][]
  ).filter(([, x]) => x);
  const facts = lines(f.facts);
  const name = v('name') || 'Votre entreprise';
  const updated = v('updated');
  const html = [
    '<section id="essentiel" aria-labelledby="essentiel-titre">',
    `  <h2 id="essentiel-titre">L’essentiel sur ${esc(name)}</h2>`,
    ...(rows.length ? ['  <dl>', ...rows.map(([k, x]) => `    <dt>${esc(k)}</dt><dd>${esc(x)}</dd>`), '  </dl>'] : []),
    ...(facts.length ? ['  <ul>', ...facts.map((x) => `    <li>${esc(x)}</li>`), '  </ul>'] : []),
    ...(updated ? [`  <p><small>Informations vérifiées le <time datetime="${esc(updated)}">${esc(frDate(updated))}</time>.</small></p>`] : []),
    '</section>',
  ].join('\n');
  const markdown = [
    `# ${name}`,
    '',
    ...(v('activity') ? [`> ${v('activity')}${v('area') ? ` — ${v('area')}` : ''}`, ''] : []),
    '## L’essentiel',
    '',
    ...rows.map(([k, x]) => `- ${k} : ${x}`),
    ...(facts.length ? ['', '## Faits vérifiables', '', ...facts.map((x) => `- ${x}`)] : []),
    ...(updated ? ['', `Informations vérifiées le ${frDate(updated)}.`] : []),
    '',
  ].join('\n');
  const checks: V6Check[] = [];
  if (!v('name')) checks.push(check('facts.name', 'Nom de l’entreprise manquant', 'fail', 'Sans nom, le bloc ne dit pas de qui il parle.', 'Indiquez le nom tel qu’il apparaît sur votre fiche Google et votre site.'));
  if (!v('activity')) checks.push(check('facts.activity', 'Activité manquante', 'fail', 'C’est la première chose qu’une IA cherche : que faites-vous ?', 'Une phrase simple : « Plombier chauffagiste », « Boutique de thés en vrac ».'));
  const missing = (
    [
      ['area', 'la zone servie'],
      ['hours', 'les horaires'],
      ['prices', 'des prix indicatifs'],
    ] as [keyof FactsInput, string][]
  ).filter(([k]) => !v(k));
  if (!v('address') && !v('phone')) missing.unshift(['phone', 'un moyen de contact (adresse ou téléphone)']);
  if (missing.length) checks.push(check('facts.missing', `Il manque ${missing.map(([, l]) => l).join(', ')}`, 'warn', 'Ce sont les questions que les clients posent le plus aux IA (« ouvert le samedi ? », « combien ça coûte ? »).', 'Ajoutez-les si vous pouvez les tenir à jour ; sinon, laissez-les vides plutôt qu’approximatifs.'));
  else if (v('name') && v('activity')) checks.push(check('facts.complete', 'Fiche complète', 'ok', `${pl(rows.length, 'information', 'informations')} de base.`));
  const vague = facts.filter((x) => !HAS_FACT.test(x));
  if (facts.length && vague.length) checks.push(check('facts.vague', `${pl(vague.length, 'fait sans chiffre ni date', 'faits sans chiffre ni date')}`, 'warn', vague.slice(0, 3).map((x) => `« ${x.slice(0, 80)} »`).join(' · '), 'Un fait précis se cite tel quel : « 1 200 chaudières posées depuis 2011 » plutôt que « une grande expérience ».'));
  if (!facts.length) checks.push(check('facts.none', 'Aucun fait vérifiable', 'warn', 'Les informations de base sont là ; il manque ce qui vous distingue.', 'Ajoutez deux ou trois faits chiffrés et datés : certifications, délais, nombre d’interventions, garanties.'));
  else if (!vague.length) checks.push(check('facts.precise', 'Faits chiffrés ou datés', 'ok', `${pl(facts.length, 'fait', 'faits')}, chacun avec un élément vérifiable.`));
  const sup = [...rows.map(([, x]) => x), ...facts].filter((x) => SUPERLATIVE.test(x));
  if (sup.length) checks.push(check('facts.superlative', 'Formule invérifiable ou superlatif', 'warn', sup.slice(0, 2).map((x) => `« ${x.slice(0, 80)} »`).join(' · '), 'Remplacez-la par un fait prouvable : un superlatif sans preuve peut être une pratique commerciale trompeuse, et les IA le reprennent rarement.'));
  if (!updated) checks.push(check('facts.date', 'Pas de date de vérification', 'warn', 'Une information datée se reprend avec plus de confiance.', 'Indiquez la date à laquelle vous avez vérifié ces informations, et changez-la seulement quand vous les revérifiez.'));
  else checks.push(check('facts.dated', 'Bloc daté', 'ok', `Vérifié le ${frDate(updated)}.`));
  const verdict = verdictOf(checks, { ok: 'Vos faits clés sont prêts à publier', warn: 'Vos faits clés sont prêts, à compléter', fail: 'Il manque l’essentiel : qui vous êtes et ce que vous faites' });
  return { html, markdown, verdict, checks, count: rows.length + facts.length };
}
