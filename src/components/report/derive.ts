// Helpers purs du rapport (aucun effet de bord, testables).
// Spécification : docs/11-rapport.md §12 ; tranches : docs/01-marque.md §3.6 ; phrases : docs/08-copy.md §3.3.
import type {
  ActionItem,
  AuditResult,
  ProviderAnswer,
  ProviderId,
  QuerySpec,
} from '@/lib/engine/types';
import { auditStats } from '@/lib/digest/stats';

/* ---------- Fournisseurs ---------- */

export const PROVIDER_ORDER: ProviderId[] = ['chatgpt', 'perplexity', 'gemini', 'claude', 'mistral'];

export const PROVIDER_META: Record<ProviderId, { label: string; short: string; color: string; about: string }> = {
  chatgpt: { label: 'ChatGPT', short: 'C', color: '#10A37F', about: "L'assistant le plus utilisé par le grand public." },
  perplexity: { label: 'Perplexity', short: 'P', color: '#1F7A8C', about: 'Un moteur de réponse qui cite ses sources.' },
  gemini: { label: 'Gemini', short: 'G', color: '#4C6EF5', about: "L'assistant de Google, présent sur Android et dans la recherche." },
  claude: { label: 'Claude', short: 'Cl', color: '#C1663B', about: "L'assistant d'Anthropic." },
  mistral: { label: 'Mistral (Le Chat)', short: 'M', color: '#B45309', about: "L'assistant français de Mistral AI." },
};

export function providersUsed(r: AuditResult): ProviderId[] {
  const declared = r.providersUsed?.length ? r.providersUsed : null;
  const fromScores = PROVIDER_ORDER.filter((p) => r.subScores?.[p] !== null && r.subScores?.[p] !== undefined);
  const list = declared ?? fromScores;
  return PROVIDER_ORDER.filter((p) => list.includes(p));
}

export function providerList(ps: ProviderId[]): string {
  const names = ps.map((p) => PROVIDER_META[p].label);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
}

/* ---------- Tranches et verdicts ---------- */

export interface Band { min: number; max: number; label: string; color: string; bg: string; ink: string; tone: 'danger' | 'warning' | 'success' }

export const SCORE_BANDS: Band[] = [
  { min: 0, max: 39, label: 'Invisible', color: '#B91C1C', bg: '#FCEAEA', ink: '#991B1B', tone: 'danger' },
  { min: 40, max: 69, label: 'Peu visible', color: '#B45309', bg: '#FDF1E3', ink: '#92400E', tone: 'warning' },
  { min: 70, max: 100, label: 'Bien recommandé', color: '#15803D', bg: '#E7F5EC', ink: '#166534', tone: 'success' },
];

export function bandFor(score: number): Band {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return SCORE_BANDS.find((b) => s >= b.min && s <= b.max) ?? SCORE_BANDS[0];
}

export function place(r: AuditResult): string {
  const d = r.input.district?.trim();
  if (!d) return r.input.city;
  return /^\d/.test(d) ? `${r.input.city} ${d}` : d;
}

export function verdictText(r: AuditResult, leaders: string[]): string {
  const s = r.score;
  const metier = r.input.trade.toLowerCase();
  const c1 = leaders[0];
  const c2 = leaders[1];
  // Seuils alignés sur les bandes de score (40 et 70), qa/contenu.md L18.
  if (s < 40) {
    const who = c1 ? (c2 ? `${c1} ou ${c2}` : c1) : "d'autres commerces";
    return `Pour l'instant, les IA vous citent rarement. Quand un client demande un ${metier} à ${place(r)}, elles citent plutôt ${who}. C'est fréquent, et c'est aussi la situation où il y a le plus de marge de progression.`;
  }
  if (s < 70) {
    return `Les IA vous connaissent, mais vous n'êtes pas leur premier réflexe. Vous apparaissez dans certaines réponses${c1 ? `, souvent derrière ${c1}` : ''}. Quelques ajustements bien choisis peuvent améliorer votre position.`;
  }
  if (s < 85) {
    return 'Bonne nouvelle : les IA vous recommandent régulièrement. Vous faites partie des noms qui reviennent pour votre métier dans votre quartier. L\'enjeu est maintenant de consolider cette place et de surveiller vos concurrents.';
  }
  return 'Bravo, vous faites partie des recommandations de référence des IA dans votre quartier. Ce type de position peut évoluer quand les IA se mettent à jour : un suivi régulier vous évitera les mauvaises surprises.';
}

export const CONFIDENCE_TEXT: Record<AuditResult['confidence'], string> = {
  bonne: 'Les IA ont répondu de façon cohérente. Le résultat est solide.',
  moyenne: 'Les réponses varient un peu d\'une fois sur l\'autre. Prenez le score comme un ordre de grandeur.',
  faible: 'Les réponses varient beaucoup ou une IA n\'a pas répondu. Un nouvel audit dans quelques jours permettra de confirmer.',
};

/* ---------- Dates ---------- */

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }).format(d);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = formatDate(iso);
  const parts = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).formatToParts(d);
  const h = parts.find((p) => p.type === 'hour')?.value ?? '';
  const m = parts.find((p) => p.type === 'minute')?.value ?? '';
  return `${day} à ${h} h ${m}`;
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Europe/Paris' }).format(d);
}

/* ---------- Concurrents ---------- */

const DIRECTORY_PATTERNS = [
  'pagesjaunes', 'pages jaunes', 'google maps', 'google', 'yelp', 'tripadvisor', 'doctolib', 'thefork', 'the fork', 'lafourchette',
  'la fourchette', 'treatwell', 'planity', 'facebook', 'instagram', 'houzz', 'habitatpresto', 'starofservice', 'mappy', 'justacote',
  'avis verifies', 'trustpilot', 'leboncoin', 'allo-artisan', 'travaux.com', 'quotatis', 'wikipedia', 'uber eats', 'deliveroo',
];

export function fold(s: string): string {
  // Même longueur que l'entrée : chaque caractère est remplacé par sa forme de base en minuscule.
  let out = '';
  for (const ch of s) {
    const base = ch.normalize('NFD')[0] ?? ch;
    const low = base.toLowerCase();
    out += low.length === base.length ? low : base;
  }
  return out;
}

export function isDirectory(name: string): boolean {
  const n = fold(name).replace(/[^a-z0-9 .-]/g, '').trim();
  const compact = n.replace(/[ .-]/g, '');
  return DIRECTORY_PATTERNS.some((p) => {
    const pc = p.replace(/[ .-]/g, '');
    return n === p || n.startsWith(p + ' ') || n.startsWith(p + '.') || compact === pc || compact === pc + 'fr' || compact === pc + 'com';
  });
}

export interface CompetitorRow { name: string; share: number; mentions: number; isYou: boolean }

/**
 * Classement du rapport : MÊMES lignes que l'espace client (`auditStats`, src/lib/digest/stats.ts).
 * `share` = part de voix (citations / total des citations) ; `mentions` = réponses qui citent l'acteur ;
 * `answers` = réponses exploitables (base du taux de mention).
 */
export function competitorRanking(r: AuditResult, top = 5): { rows: CompetitorRow[]; directories: CompetitorRow[]; youIndex: number; leader: CompetitorRow | null; answers: number } {
  const s = auditStats(r);
  const directories = [...(r.competitors ?? [])].filter((c) => isDirectory(c.name)).sort((a, b) => b.share - a.share).map((c) => ({ ...c, isYou: false }));
  const businesses = s.rows.filter((x) => !x.isMe && !isDirectory(x.name)).map((x) => ({ name: x.name, share: x.share, mentions: x.mentions, isYou: false }));
  const me = s.rows.find((x) => x.isMe);
  const you: CompetitorRow = { name: r.input.businessName, share: me?.share ?? 0, mentions: me?.mentions ?? 0, isYou: true };
  const rows: CompetitorRow[] = businesses.slice(0, top);
  let idx = rows.findIndex((c) => you.mentions > c.mentions);
  if (you.mentions <= 0) idx = -1;
  if (idx === -1) rows.push(you);
  else rows.splice(idx, 0, you);
  const youIndex = rows.findIndex((x) => x.isYou);
  const leader = businesses[0] ?? null;
  return { rows, directories, youIndex, leader, answers: s.answers };
}

export function leaderNames(r: AuditResult): string[] {
  return [...(r.competitors ?? [])]
    .filter((c) => !isDirectory(c.name))
    .sort((a, b) => b.share - a.share)
    .map((c) => c.name);
}

/** Part des réponses (en %) : accepte share en 0–1 ou en 0–100. */
export function pct(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.round(v <= 1 ? v * 100 : v);
}

/* ---------- Par fournisseur ---------- */

export interface ProviderStat { provider: ProviderId; score: number | null; cited: number; total: number; avgRank: number | null; leader: string | null; youFirst: boolean }

export function byProvider(r: AuditResult): ProviderStat[] {
  return providersUsed(r).map((p) => {
    const ms = r.mentions.filter((m) => m.provider === p);
    const cited = ms.filter((m) => m.mentioned);
    const ranks = cited.map((m) => m.rank).filter((x): x is number => typeof x === 'number');
    const firstCount = new Map<string, number>();
    for (const m of ms) {
      const first = m.competitors.find((c) => !isDirectory(c));
      if (first) firstCount.set(first, (firstCount.get(first) ?? 0) + 1);
    }
    let leader: string | null = null;
    let best = 0;
    for (const [name, n] of firstCount) if (n > best) { best = n; leader = name; }
    return {
      provider: p,
      score: r.subScores?.[p] ?? null,
      cited: cited.length,
      total: ms.length,
      avgRank: ranks.length ? Math.round((ranks.reduce((a, b) => a + b, 0) / ranks.length) * 10) / 10 : null,
      leader,
      youFirst: cited.some((m) => m.rank === 1),
    };
  });
}

/* ---------- Matrice requête × IA ---------- */

export interface Cell { mentioned: boolean; bestRank: number | null; k: number; n: number; tested: boolean }
export interface MatrixRow { query: QuerySpec; cells: Record<string, Cell>; citedCount: number }

export function queryMatrix(r: AuditResult): MatrixRow[] {
  const ps = providersUsed(r);
  const rows = r.queries.map((q) => {
    const cells: Record<string, Cell> = {};
    let citedCount = 0;
    for (const p of ps) {
      const ms = r.mentions.filter((m) => m.queryId === q.id && m.provider === p);
      const errs = r.answers.filter((a) => a.queryId === q.id && a.provider === p && a.error);
      const k = ms.filter((m) => m.mentioned).length;
      const ranks = ms.filter((m) => m.mentioned && m.rank != null).map((m) => m.rank as number);
      const tested = ms.length > 0 && errs.length < Math.max(1, ms.length);
      cells[p] = { mentioned: k > 0, bestRank: ranks.length ? Math.min(...ranks) : null, k, n: ms.length, tested };
      if (k > 0) citedCount += 1;
    }
    return { query: q, cells, citedCount };
  });
  return rows.sort((a, b) => a.citedCount - b.citedCount);
}

export const INTENT_LABEL: Record<QuerySpec['intent'], string> = {
  best: 'Meilleur',
  nearby: 'Près de moi',
  urgent: 'Urgence',
  specific: 'Précis',
  review: 'Avis',
};

export function answerFor(r: AuditResult, queryId: string, provider: ProviderId): ProviderAnswer | null {
  const list = r.answers.filter((a) => a.queryId === queryId && a.provider === provider);
  return list.find((a) => !a.error && a.text) ?? list[0] ?? null;
}

export function competitorsFor(r: AuditResult, queryId: string, provider: ProviderId): string[] {
  const set = new Set<string>();
  for (const m of r.mentions) if (m.queryId === queryId && m.provider === provider) m.competitors.forEach((c) => set.add(c));
  return [...set];
}

/* ---------- Domaines cités ---------- */

export function topCitedDomains(r: AuditResult, n = 5): { domain: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const a of r.answers) {
    for (const c of a.citations ?? []) {
      let d = c;
      try { d = new URL(c.startsWith('http') ? c : `https://${c}`).hostname; } catch { /* garde la chaîne */ }
      d = d.replace(/^www\./, '');
      if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([domain, count]) => ({ domain, count }));
}

/* ---------- Surlignage sûr (segments, pas d'HTML) ---------- */

export type Segment = { text: string; kind: 'plain' | 'competitor' | 'you'; rank?: number };

export function segmentText(text: string, competitors: string[], businessName: string): Segment[] {
  const folded = fold(text);
  type Hit = { start: number; end: number; kind: 'competitor' | 'you'; name: string };
  const hits: Hit[] = [];
  const needles: { name: string; kind: 'competitor' | 'you' }[] = [
    { name: businessName, kind: 'you' },
    ...competitors.filter((c) => fold(c) !== fold(businessName)).map((name) => ({ name, kind: 'competitor' as const })),
  ];
  for (const { name, kind } of needles) {
    const f = fold(name.trim());
    if (f.length < 2) continue;
    let from = 0;
    while (from < folded.length) {
      const i = folded.indexOf(f, from);
      if (i === -1) break;
      const before = i === 0 ? ' ' : folded[i - 1];
      const after = folded[i + f.length] ?? ' ';
      const boundary = !/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after);
      if (boundary) hits.push({ start: i, end: i + f.length, kind, name });
      from = i + f.length;
    }
  }
  hits.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const kept: Hit[] = [];
  for (const h of hits) if (!kept.length || h.start >= kept[kept.length - 1].end) kept.push(h);
  const rankOf = new Map<string, number>();
  for (const h of kept) if (h.kind === 'competitor' && !rankOf.has(h.name)) rankOf.set(h.name, rankOf.size + 1);
  const segs: Segment[] = [];
  let pos = 0;
  for (const h of kept) {
    if (h.start > pos) segs.push({ text: text.slice(pos, h.start), kind: 'plain' });
    segs.push({ text: text.slice(h.start, h.end), kind: h.kind, rank: h.kind === 'competitor' ? rankOf.get(h.name) : undefined });
    pos = h.end;
  }
  if (pos < text.length) segs.push({ text: text.slice(pos), kind: 'plain' });
  return segs;
}

/** Tronque à ~max caractères autour de la première mention d'un nom, sans couper de mot. */
export function excerptAround(text: string, names: string[], max = 280): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const f = fold(clean);
  let first = -1;
  for (const n of names) {
    const i = f.indexOf(fold(n));
    if (i !== -1 && (first === -1 || i < first)) first = i;
  }
  let start = first === -1 ? 0 : Math.max(0, first - Math.floor(max / 3));
  let end = Math.min(clean.length, start + max);
  start = Math.max(0, end - max);
  if (start > 0) { const sp = clean.indexOf(' ', start); if (sp !== -1 && sp < start + 30) start = sp + 1; }
  if (end < clean.length) { const sp = clean.lastIndexOf(' ', end); if (sp > start + 50) end = sp; }
  return `${start > 0 ? '… ' : ''}${clean.slice(start, end).trim()}${end < clean.length ? ' …' : ''}`;
}

/* ---------- Extraits (pickShowcase) ---------- */

export interface Showcase {
  provider: ProviderId;
  query: string;
  excerpt: string;
  full: string;
  competitors: string[];
  mentioned: boolean;
  demo: boolean;
}

const PROVIDER_FAME: ProviderId[] = ['chatgpt', 'gemini', 'perplexity', 'claude'];

export function pickShowcase(r: AuditResult): Showcase[] {
  const qText = (id: string) => r.queries.find((q) => q.id === id)?.text ?? '';
  const qByText = (t: string) => r.queries.find((q) => q.text === t);
  const out: Showcase[] = [];

  if (r.excerpts?.length) {
    for (const e of r.excerpts.slice(0, 3)) {
      const q = qByText(e.query);
      const ans = q ? answerFor(r, q.id, e.provider) : null;
      const full = ans?.text && ans.text.length >= e.text.length ? ans.text : e.text;
      const comps = e.competitorsHighlighted?.length ? e.competitorsHighlighted : q ? competitorsFor(r, q.id, e.provider) : [];
      out.push({
        provider: e.provider,
        query: e.query,
        excerpt: excerptAround(e.text, [...comps, r.input.businessName]),
        full,
        competitors: comps,
        mentioned: e.mentioned,
        demo: r.demo || !!ans?.demo,
      });
    }
    return out;
  }

  const fame = (p: ProviderId) => PROVIDER_FAME.indexOf(p);
  const candidates = r.mentions
    .map((m) => ({ m, a: answerFor(r, m.queryId, m.provider), q: r.queries.find((q) => q.id === m.queryId) }))
    .filter((x) => x.a && !x.a.error && x.a.text && x.m.run === (x.a?.run ?? x.m.run));
  const used = new Set<string>();
  const key = (x: (typeof candidates)[number]) => `${x.m.queryId}:${x.m.provider}`;
  const toShow = (x: (typeof candidates)[number]): Showcase => {
    const comps = x.m.competitors.filter((c) => !isDirectory(c));
    return {
      provider: x.m.provider,
      query: x.q?.text ?? qText(x.m.queryId),
      excerpt: excerptAround(x.a!.text, [...comps, r.input.businessName]),
      full: x.a!.text,
      competitors: x.m.competitors,
      mentioned: x.m.mentioned,
      demo: r.demo || x.a!.demo,
    };
  };
  const take = (pred: (x: (typeof candidates)[number]) => boolean, sort: (a: (typeof candidates)[number], b: (typeof candidates)[number]) => number) => {
    const pick = candidates.filter((x) => !used.has(key(x)) && pred(x)).sort(sort)[0];
    if (pick) { used.add(key(pick)); out.push(toShow(pick)); }
    return pick;
  };
  const intentScore = (x: (typeof candidates)[number]) => (x.q?.intent === 'best' ? 0 : 1);
  const a = take((x) => !x.m.mentioned && x.m.competitors.length >= 2, (p, q) => intentScore(p) - intentScore(q) || fame(p.m.provider) - fame(q.m.provider));
  take(
    (x) => x.m.competitors.length >= 1 && x.m.rank !== 1,
    (p, q) => Number(p.m.provider === a?.m.provider) - Number(q.m.provider === a?.m.provider) || fame(p.m.provider) - fame(q.m.provider),
  );
  if (!take((x) => x.m.mentioned, (p, q) => (p.m.rank ?? 99) - (q.m.rank ?? 99))) {
    take((x) => !x.m.mentioned && (x.q?.intent === 'nearby' || x.q?.intent === 'urgent'), (p, q) => fame(p.m.provider) - fame(q.m.provider));
  }
  if (!out.length && candidates[0]) out.push(toShow(candidates[0]));
  return out;
}

/* ---------- Actions gratuites (repli) ---------- */

export function fallbackActions(r: AuditResult): ActionItem[] {
  const metier = r.input.trade.toLowerCase();
  const lieu = place(r);
  return [
    {
      id: 'free-gbp',
      title: 'Compléter votre fiche Google',
      why: 'Les IA s\'appuient beaucoup sur les données locales publiques : une fiche complète leur donne de quoi vous citer.',
      how: ['Vérifiez horaires, téléphone et adresse.', `Ajoutez vos services et une description avec « ${metier} » et « ${lieu} ».`, 'Publiez 5 photos récentes.'],
      effort: 'S',
      impact: 3,
    },
    {
      id: 'free-reviews',
      title: 'Obtenir 5 avis récents',
      why: 'Des avis récents qui citent votre métier et votre quartier rassurent les clients et les IA.',
      how: ['Choisissez 10 clients satisfaits du dernier mois.', 'Envoyez-leur le message ci-dessous par SMS ou WhatsApp.', 'Répondez à chaque avis reçu.'],
      effort: 'S',
      impact: 3,
    },
    {
      id: 'free-page',
      title: r.input.website ? `Ajouter une page « ${r.input.trade} à ${lieu} » sur votre site` : 'Créer votre présence sur un annuaire de référence',
      why: r.input.website
        ? 'Les IA reprennent volontiers les pages qui répondent clairement à la question posée.'
        : 'Sans site, les IA ont peu de sources fiables à votre sujet.',
      how: r.input.website
        ? ['Titre : votre métier et votre quartier.', 'Ajoutez 5 questions-réponses que vos clients posent.', 'Indiquez adresse, horaires et téléphone.']
        : ['Choisissez l\'annuaire le plus cité pour votre métier.', 'Remplissez la fiche à l\'identique de votre fiche Google.', 'Ajoutez photos et description.'],
      effort: 'M',
      impact: 2,
    },
  ];
}

export const EFFORT_LABEL: Record<ActionItem['effort'], string> = { S: '≈ 15 min', M: '≈ 1 h', L: '≈ ½ journée' };
export const IMPACT_LABEL: Record<ActionItem['impact'], string> = { 3: 'Impact fort', 2: 'Impact moyen', 1: 'Impact modéré' };

export function reviewMessage(r: AuditResult): string {
  return `Bonjour, merci encore pour votre confiance ! Si vous avez une minute, un avis sur notre fiche Google nous aiderait beaucoup. Dites simplement ce que nous avons fait pour vous (${r.input.trade.toLowerCase()} à ${place(r)}). Merci ! ${r.input.businessName}`;
}

/* ---------- Divers ---------- */

export function runsCount(r: AuditResult): number {
  return r.mentions.reduce((m, x) => Math.max(m, x.run), 0) || 1;
}

export function validAnswers(r: AuditResult): number {
  return r.answers.filter((a) => !a.error).length;
}

export function scoreRange(r: AuditResult): { low: number; high: number } {
  if (r.range && Number.isFinite(r.range.low) && Number.isFinite(r.range.high)) {
    return { low: Math.round(r.range.low), high: Math.round(r.range.high) };
  }
  const hw = r.confidence === 'bonne' ? 6 : r.confidence === 'moyenne' ? 10 : 15;
  return { low: Math.max(0, Math.round(r.score - hw)), high: Math.min(100, Math.round(r.score + hw)) };
}

/** Chaînes factices de longueur variable pour le teaser flouté (jamais le vrai plan). */
export function fakeLines(n: number, seed: string): string[] {
  const words = ['lorem', 'vitae', 'fiche', 'texte', 'quartier', 'avis', 'page', 'local', 'service', 'horaire', 'photo', 'liste', 'site', 'contact', 'question'];
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 2 ** 32; };
  return Array.from({ length: n }, () => {
    const len = 5 + Math.floor(rnd() * 6);
    const w = Array.from({ length: len }, () => words[Math.floor(rnd() * words.length)]).join(' ');
    return w.charAt(0).toUpperCase() + w.slice(1);
  });
}
