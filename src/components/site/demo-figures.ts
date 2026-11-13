/**
 * Chiffres des comptes démo affichés sur le site (B9 et amélioration 13 de qa/v3/regard-client-v3.md) : calculés au
 * rendu depuis la MÊME source que les comptes démo (buildDemoWorkspace + auditStats, trafic démo de src/lib/tracking,
 * digest du lundi de src/lib/digest), jamais recopiés à la main. Côté serveur uniquement : les scènes animées
 * (composants client) reçoivent ces objets sérialisables en propriété.
 *
 * Définitions (qa/v3/a-corriger-AMELIO-SITE.md) : taux de mention = réponses qui citent / réponses exploitables ;
 * part de voix = citations de l'acteur / citations des acteurs classés, vous compris.
 */
import { buildDemoWorkspace, type DemoAudit } from "@/lib/demo-v2";
import { auditStats, isPlatformName, type AuditStats } from "@/lib/digest/stats";
import type { Segment } from "@/lib/engine/types-v2";
import type { ProviderId } from "@/lib/engine/types";
import type { AiEngine, AiTrafficSummary } from "@/lib/engine/types-v2";

export type DemoSegment = Segment;

const PROVIDER_LABEL: Record<ProviderId, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  perplexity: "Perplexity",
  claude: "Claude",
  mistral: "Mistral Le Chat",
};
const PROVIDER_ORDER: ProviderId[] = ["chatgpt", "gemini", "perplexity", "claude", "mistral"];

export interface DemoAnswer {
  ia: string;
  /** noms dans l'ordre de la réponse (au moins 3, ou jusqu'à votre rang) */
  names: string[];
  /** votre rang dans la réponse (1 = premier), 0 si absent */
  you: number;
}

export interface DemoSovRow {
  name: string;
  /** part de voix en % entier */
  v: number;
  mentions: number;
  you?: boolean;
}

export interface DemoMeasure {
  segment: DemoSegment;
  account: string;
  score: number;
  rank: number;
  of: number;
  /** « 3ᵉ sur 10 plombiers du 11ᵉ » */
  rankLabel: string;
  questions: number;
  answers: number;
  citations: number;
  /** % entiers */
  mentionRate: number;
  shareOfVoice: number;
  methodLabel: string;
  /** classement complet (part de voix) */
  rows: DemoSovRow[];
  /** une question suivie, vue IA par IA (premier passage) */
  question: { text: string; asked: number; answers: DemoAnswer[] };
  /** scores des mesures successives (plus ancienne d'abord) */
  history: number[];
}

const pct = (x: number) => Math.round(x * 100);

function latestAudit(segment: DemoSegment): { audit: DemoAudit; audits: DemoAudit[] } {
  const ws = buildDemoWorkspace(segment);
  const audits = ws.audits;
  return { audit: audits[audits.length - 1], audits };
}

/** Réponse d'une IA à une question, premier passage : noms cités dans l'ordre, vous inséré à votre rang. */
function answerOf(a: DemoAudit, s: AuditStats, queryId: string, p: ProviderId): DemoAnswer | null {
  const ms = a.mentions.filter((m) => m.queryId === queryId && m.provider === p && !m.noRec).sort((x, y) => x.run - y.run);
  const m = ms[0];
  if (!m) return null;
  const me = s.rows.find((r) => r.isMe)?.name ?? a.input.businessName;
  const others = m.competitors.filter((c) => !isPlatformName(c) && c !== me);
  const names = [...others];
  let you = 0;
  if (m.mentioned) {
    const at = Math.max(0, Math.min(names.length, (m.rank ?? names.length + 1) - 1));
    names.splice(at, 0, me);
    you = at + 1;
  }
  return { ia: PROVIDER_LABEL[p], names: names.slice(0, Math.max(3, you)), you };
}

/**
 * Question montrée dans les scènes : celle où le plus d'IA vous citent sans que toutes le fassent (le cas le plus
 * parlant), à défaut la plus citante. Choix déterministe, sur les vraies réponses du compte.
 */
function pickQuestion(a: DemoAudit, s: AuditStats, providers: ProviderId[]): string {
  const reco = a.queries.filter((q) => q.kind !== "brand");
  let best = reco[0]?.id ?? a.queries[0].id;
  let bestScore = -1;
  for (const q of reco) {
    const ans = providers.map((p) => answerOf(a, s, q.id, p)).filter(Boolean) as DemoAnswer[];
    if (ans.length < providers.length) continue;
    const cited = ans.filter((x) => x.you > 0 && x.you <= 3).length;
    // Une IA qui ne vous cite pas rend la scène parlante : « cité par 2 IA sur 3 » passe devant « 3 sur 3 ».
    const score = cited === ans.length ? cited - 1.5 : cited;
    if (score > bestScore) {
      bestScore = score;
      best = q.id;
    }
  }
  return best;
}

const measureCache = new Map<DemoSegment, DemoMeasure>();

/** Chiffres de mesure d'un compte démo (dernière mesure). */
export function demoMeasure(segment: DemoSegment, maxEngines = 3): DemoMeasure {
  const key = `${segment}:${maxEngines}` as DemoSegment;
  const hit = measureCache.get(key);
  if (hit) return hit;
  const { audit, audits } = latestAudit(segment);
  const s = auditStats(audit);
  const providers = PROVIDER_ORDER.filter((p) => s.providers.includes(p)).slice(0, maxEngines);
  const qid = pickQuestion(audit, s, providers);
  const q = audit.queries.find((x) => x.id === qid)!;
  const out: DemoMeasure = {
    segment,
    account: audit.input.businessName,
    score: audit.score,
    rank: s.rank,
    of: s.of,
    rankLabel: s.label,
    questions: s.questions,
    answers: s.answers,
    citations: s.citations,
    mentionRate: pct(s.mentionRate),
    shareOfVoice: pct(s.shareOfVoice),
    methodLabel: s.methodLabel,
    rows: s.rows.map((r) => ({ name: r.name, v: pct(r.share), mentions: r.mentions, you: r.isMe || undefined })),
    question: {
      text: q.text,
      asked: audit.mentions.filter((m) => m.queryId === qid && !m.noRec).length,
      answers: providers.map((p) => answerOf(audit, s, qid, p)).filter(Boolean) as DemoAnswer[],
    },
    history: audits.map((x) => x.score),
  };
  measureCache.set(key, out);
  return out;
}

/** Les `n` premiers du classement, plus vous si vous n'y êtes pas (part de voix). */
export function topRows(m: DemoMeasure, n = 5): DemoSovRow[] {
  const top = m.rows.slice(0, n);
  if (!top.some((r) => r.you)) {
    const me = m.rows.find((r) => r.you);
    if (me) top[top.length - 1] = me;
  }
  return top;
}

/* ------------------------------------------------------------------ */
/* Trafic et ventes (compte démo e-commerce), mêmes fenêtres que /app/trafic */
/* ------------------------------------------------------------------ */

export interface DemoTraffic {
  account: string;
  /** visites venues des IA par semaine, 12 dernières semaines (plus ancienne d'abord) */
  weekly: number[];
  /** visites IA des 30 derniers jours, et évolution en % sur les 30 jours précédents */
  visits30: number;
  growth30: number | null;
  /** part de chaque IA dans les visites des 30 derniers jours (% entiers) */
  engines: { n: string; v: number }[];
  /** commandes et CA attribués sur 30 jours (e-commerce), null sinon */
  orders30: number | null;
  revenue30: number | null;
  /** conversions suivies sur 30 jours (appels, demandes de contact) */
  conversions30: number;
  /** visites IA des 7 derniers jours (celles du digest du lundi) */
  visits7: number;
}

const ENGINE_NAME: Record<AiEngine, string> = {
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  gemini: "Gemini",
  copilot: "Copilot",
  claude: "Claude",
  other_ai: "Autres IA",
};

const sumVisits = (ds: AiTrafficSummary["days"]) => ds.reduce((s, d) => s + Object.values(d.visits).reduce((a, b) => a + (b ?? 0), 0), 0);

/** Trafic démo, calculé comme l'écran « Trafic et ventes » du compte (src/app/app/trafic). */
export async function demoTraffic(segment: DemoSegment): Promise<DemoTraffic> {
  const { getAiTraffic } = await import("@/lib/tracking");
  const id = segment === "local" ? "demo" : segment === "pme" ? "demo-pme" : "demo-ecom";
  const [t90, t30] = await Promise.all([getAiTraffic(id, 90), getAiTraffic(id, 30)]);
  const last30 = t90.days.slice(-30);
  const prev30 = t90.days.slice(-60, -30);
  const v30 = sumVisits(last30);
  const vPrev = sumVisits(prev30);
  const last84 = t90.days.slice(-84);
  const weekly = Array.from({ length: 12 }, (_, w) => sumVisits(last84.slice(w * 7, w * 7 + 7)));
  const byEngine = (Object.keys(ENGINE_NAME) as AiEngine[])
    .map((e) => ({ e, v: last30.reduce((s, d) => s + (d.visits[e] ?? 0), 0) }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v);
  // Parts entières dont la somme fait 100 (plus fort reste).
  const raw = byEngine.map((x) => (x.v * 100) / Math.max(1, v30));
  const ints = raw.map(Math.floor);
  let rest = 100 - ints.reduce((a, b) => a + b, 0);
  raw
    .map((r, i) => ({ i, f: r - Math.floor(r) }))
    .sort((a, b) => b.f - a.f)
    .forEach(({ i }) => {
      if (rest > 0) {
        ints[i]++;
        rest--;
      }
    });
  const engines = byEngine.slice(0, 4).map((x, i) => ({ n: ENGINE_NAME[x.e], v: ints[i] }));
  return {
    account: buildDemoWorkspace(segment).business.name,
    weekly,
    visits30: v30,
    growth30: vPrev ? Math.round(((v30 - vPrev) / vPrev) * 100) : null,
    engines,
    orders30: t30.commerce ? t30.commerce.orders : null,
    revenue30: t30.commerce ? t30.commerce.revenueEur : null,
    conversions30: last30.reduce((s, d) => s + Object.values(d.conversions).reduce((a, b) => a + (b ?? 0), 0), 0),
    visits7: sumVisits(t90.days.slice(-7)),
  };
}

/** « 675,90 € » */
export function eurosFr(n: number): string {
  return `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}\u00a0€`;
}

/* ------------------------------------------------------------------ */
/* Sources lues par les IA et « pourquoi il passe devant »              */
/* ------------------------------------------------------------------ */

const CATEGORY_LABEL: Record<string, string> = {
  annuaire: "Annuaire",
  avis: "Avis",
  media_national: "Média",
  media_local: "Média local",
  comparatif: "Comparatif",
  forum: "Forum",
  marketplace: "Marketplace",
  reseau_social: "Réseau social",
  concurrent: "Concurrent",
  client: "Votre site",
  wikipedia: "Wikipédia",
  institutionnel: "Institutionnel",
  autre: "Autre",
};

export interface DemoSources {
  account: string;
  /** IA qui renvoient des sources dans ce compte (« ChatGPT, Perplexity ») */
  engines: string;
  rows: { d: string; t: string; n: number; here: boolean }[];
  /** bulle du premier domaine : « Cité 21 fois par ChatGPT et Perplexity » */
  firstHint: string;
  /** concurrent juste devant vous (ou le premier si vous êtes 1er) */
  ahead: string;
  compare: { k: string; them: number; you: number; of?: number }[];
}

const sourcesCache = new Map<string, DemoSources>();

export function demoSources(segment: DemoSegment, n = 5): DemoSources {
  const hit = sourcesCache.get(`${segment}:${n}`);
  if (hit) return hit;
  const { audit } = latestAudit(segment);
  const s = auditStats(audit);
  const domains = audit.sources?.domains ?? [];
  const rows = domains.slice(0, n).map((d) => ({ d: d.domain, t: CATEGORY_LABEL[d.category] ?? "Autre", n: d.citations, here: d.clientPresence === "present" }));
  const grounded = PROVIDER_ORDER.filter((p) => domains.some((d) => d.providers.includes(p))).map((p) => PROVIDER_LABEL[p]);
  const first = domains[0];
  const firstHint = first
    ? `Cité ${first.citations} fois par ${PROVIDER_ORDER.filter((p) => first.providers.includes(p)).map((p) => PROVIDER_LABEL[p]).join(" et ")}`
    : "";
  const me = s.rows.find((r) => r.isMe);
  const aheadRow = s.ahead ?? s.rows.find((r) => !r.isMe) ?? null;
  const ahead = aheadRow?.name ?? "";
  const ms = audit.mentions.filter((m) => !m.noRec && audit.queries.some((q) => q.id === m.queryId && q.kind !== "brand"));
  const himFirst = ms.filter((m) => m.competitors.filter((c) => !isPlatformName(c))[0] === ahead && !(m.mentioned && m.rank === 1)).length;
  const meFirst = ms.filter((m) => m.mentioned && m.rank === 1).length;
  const out: DemoSources = {
    account: audit.input.businessName,
    engines: grounded.join(", "),
    rows,
    firstHint,
    ahead,
    compare: [
      { k: "Réponses qui le citent", them: aheadRow?.mentions ?? 0, you: me?.mentions ?? 0 },
      {
        k: "Sources citées où il figure",
        them: domains.filter((d) => d.competitorsPresent.includes(ahead)).length,
        you: domains.filter((d) => d.clientPresence === "present").length,
        of: domains.length,
      },
      { k: "Cité en premier", them: himFirst, you: meFirst },
    ],
  };
  sourcesCache.set(`${segment}:${n}`, out);
  return out;
}

/* ------------------------------------------------------------------ */
/* Digest du lundi et erreur des IA (même calcul que l'e-mail du lundi) */
/* ------------------------------------------------------------------ */

export interface DemoDigest {
  account: string;
  headline: string;
  headlineSub: string | null;
  rank: number;
  of: number;
  score: number;
  visits7: number | null;
  tasks: { title: string; minutes: number }[];
  /** première erreur relevée (fiche de vérité contre réponse d'une IA) */
  factError: { ia: string; label: string; stated: string; expected: string } | null;
  fixMinutes: number | null;
}

export async function demoDigest(segment: DemoSegment): Promise<DemoDigest> {
  const { getDemoWorkspace } = await import("@/lib/demo-v2");
  const { buildWeeklyDigest } = await import("@/lib/digest");
  const ws = await getDemoWorkspace(segment);
  const d = await buildWeeklyDigest(ws.business.id);
  const m = demoMeasure(segment);
  const fe = d.factErrorItems[0];
  return {
    account: d.businessName,
    headline: d.headline,
    headlineSub: d.headlineSub ?? null,
    rank: d.benchmark?.rank ?? m.rank,
    of: d.benchmark?.of ?? m.of,
    score: m.score,
    visits7: d.aiVisits ?? null,
    tasks: d.tasks.map((t) => ({ title: t.title, minutes: t.minutes })),
    factError: fe ? { ia: PROVIDER_LABEL[fe.provider], label: fe.label, stated: fe.stated.replace(/^[^:]{2,40}:\s*/, "").replace(/\.$/, ""), expected: fe.expected } : null,
    fixMinutes: d.fixTask?.minutes ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Réponse principale et scène du hero                                  */
/* ------------------------------------------------------------------ */

export interface DemoHeroAnswer {
  ia: string;
  question: string;
  intro: string;
  items: { name: string; note: string; you?: boolean }[];
  footer: [string, string];
  label: string;
}

/** Puces « **Nom** – note » d'une réponse d'IA du compte démo. */
function parseItems(text: string): { name: string; note: string }[] {
  const out: { name: string; note: string }[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/\*\*(.+?)\*\*\s*(?:\([^)]*\))?\s*(?:[–—:-])\s*(.+)$/);
    if (m) out.push({ name: m[1].trim(), note: m[2].trim() });
  }
  return out;
}

/** Réponse au premier plan du hero : une vraie réponse (premier passage) du compte démo, sur la question des scènes. */
export function demoHeroAnswer(segment: DemoSegment): DemoHeroAnswer {
  const m = demoMeasure(segment);
  const { audit } = latestAudit(segment);
  const qid = audit.queries.find((q) => q.text === m.question.text)?.id;
  // IA au premier plan : celle qui vous cite le plus haut, à défaut la première.
  const main = [...m.question.answers].filter((a) => a.you > 0).sort((a, b) => a.you - b.you)[0] ?? m.question.answers[0];
  const p = PROVIDER_ORDER.find((x) => PROVIDER_LABEL[x] === main.ia)!;
  const ans = (audit.answers ?? []).filter((x) => x.queryId === qid && x.provider === p && !x.error).sort((x, y) => x.run - y.run)[0];
  const text = ans?.text ?? "";
  const parsed = parseItems(text);
  const take = Math.max(3, main.you);
  const items = parsed
    .filter((it) => !isPlatformName(it.name))
    .slice(0, take)
    .map((it) => ({ name: it.name, note: it.note, you: it.name === m.account || undefined }));
  const intro = (text.split("\n")[0] ?? "").trim();
  return {
    ia: main.ia,
    question: m.question.text,
    intro,
    items,
    footer: [`Cité dans ${m.citations} réponses sur ${m.answers}`, `Part de voix : ${m.shareOfVoice} %`],
    label: `Démo : réponse de ${main.ia} à une question suivie du compte ${m.account}, où le nom ${m.account} est repéré`,
  };
}

export interface DemoHeroScene {
  segment: DemoSegment;
  business: string;
  main: DemoHeroAnswer;
  engines: { ia: string; names: string[]; rank: number | null }[];
  answers: string;
  confidence: string;
  score: number;
}

export function demoHeroScene(segment: DemoSegment): DemoHeroScene {
  const m = demoMeasure(segment);
  const main = demoHeroAnswer(segment);
  return {
    segment,
    business: m.account,
    main,
    engines: m.question.answers.map((a) => ({ ia: a.ia, names: a.names, rank: a.you > 0 ? a.you : null })),
    answers: `Cité dans ${m.citations} réponses sur ${m.answers}`,
    confidence: `${m.rankLabel}`,
    score: m.score,
  };
}

/* ------------------------------------------------------------------ */
/* Données prêtes pour les scènes animées (composants client)           */
/* ------------------------------------------------------------------ */

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Scène « Mesurer » : compte démo PME (Paysia). */
export function measureSceneData(segment: DemoSegment = "pme") {
  const m = demoMeasure(segment);
  return {
    account: m.account,
    question: m.question.text,
    asked: m.question.asked,
    answers: m.question.answers,
    sov: topRows(m, 5).map(({ name, v, you }) => ({ name, v, you })),
    questions: m.questions,
    analysed: m.answers,
  };
}

/** Scène « Comprendre » : sources du compte démo PME (Paysia). */
export function understandSceneData(segment: DemoSegment = "pme") {
  const s = demoSources(segment);
  return { account: s.account, engines: s.engines, rows: s.rows, firstHint: s.firstHint, ahead: s.ahead, compare: s.compare };
}

/** Scène « Prouver » : trafic et ventes du compte démo e-commerce (Maison Sora). */
export async function proveSceneData(segment: DemoSegment = "ecommerce") {
  const [t, m] = [await demoTraffic(segment), demoMeasure(segment)];
  const h = m.history;
  return {
    account: t.account,
    weekly: t.weekly,
    visits30: t.visits30,
    growth30: t.growth30,
    orders30: t.orders30,
    revenue30: t.revenue30 === null ? null : eurosFr(t.revenue30),
    engines: t.engines,
    month: MONTHS[new Date().getMonth()],
    score: m.score,
    scoreDelta: h.length > 1 ? h[h.length - 1] - h[h.length - 2] : null,
  };
}

/* ------------------------------------------------------------------ */
/* Aperçus des modules (/fonctionnalites)                               */
/* ------------------------------------------------------------------ */

/** Questions suivies : texte, thème, et pour chaque IA si au moins un passage vous cite. */
export function demoQuestions(segment: DemoSegment, n = 4) {
  const { audit } = latestAudit(segment);
  const s = auditStats(audit);
  const providers = PROVIDER_ORDER.filter((p) => s.providers.includes(p));
  const rows = audit.queries
    .filter((q) => q.kind !== "brand")
    .slice(0, n)
    .map((q) => ({
      q: q.text,
      theme: q.theme ?? null,
      res: providers.map((p) => audit.mentions.some((m) => m.queryId === q.id && m.provider === p && m.mentioned)),
    }));
  return { account: audit.input.businessName, engines: providers.map((p) => PROVIDER_LABEL[p]), rows };
}

/** Ventilation par IA sur les mêmes réponses que le classement : vous et le concurrent juste devant. */
export async function demoEngineSplit(segment: DemoSegment) {
  const { providerBreakdown } = await import("@/lib/digest/stats");
  const { audit } = latestAudit(segment);
  const s = auditStats(audit);
  const rival = (s.ahead ?? s.rows.find((r) => !r.isMe))?.name ?? "";
  return {
    account: audit.input.businessName,
    rival,
    rows: providerBreakdown(audit, rival).map((x) => ({ ia: PROVIDER_LABEL[x.provider], answers: x.answers, me: x.me, him: x.him })),
  };
}

/** Produits suivis du compte démo e-commerce, comme l'écran « Produits » du compte. */
export async function demoProducts() {
  const { productTracking } = await import("@/lib/ecommerce");
  const ws = buildDemoWorkspace("ecommerce");
  const r = await productTracking({ id: ws.business.id, name: ws.business.name, website: ws.business.website });
  const products = r.products.slice(0, 3).map((p) => ({ name: p.name, appearances: p.appearances, answers: p.answers }));
  const weakest = [...r.products].sort((a, b) => a.visibility - b.visibility)[0];
  return {
    account: ws.business.name,
    products,
    instead: weakest ? { product: weakest.name, rivals: weakest.recommendedInstead.slice(0, 3).map((x) => ({ label: x.label, count: x.count })) } : null,
  };
}

/** Fiche Google, annuaires et carte du compte démo local (src/lib/local, mêmes données que l'onglet Local). */
export async function demoLocal() {
  const { buildLocalDemo } = await import("@/lib/local");
  const d = await buildLocalDemo("demo");
  if (!d) return null;
  const missing = d.gbp.criteria.filter((c) => c.status === "fail" || c.status === "warn").slice(0, 2).map((c) => c.label.toLowerCase());
  const zones = d.map.zones
    .filter((z) => z.mentionRate !== null)
    .slice(0, 6)
    .map((z) => ({ n: z.label, rate: Math.round((z.mentionRate ?? 0) * 100), band: z.band }));
  return {
    account: d.gbp.businessId === "demo" ? buildDemoWorkspace("local").business.name : d.gbp.businessId,
    gbpScore: d.gbp.score,
    missing,
    nap: d.nap.rows.slice(0, 3).map((r) => ({ name: r.directory.name, status: r.status, issues: r.issues.length })),
    zones,
  };
}

/**
 * Un aperçu dont les chiffres ne peuvent pas être calculés (store indisponible au rendu) n'est pas affiché, plutôt
 * que de montrer un chiffre faux ou recopié : `const d = await orNull(demoDigest("pme")); if (!d) return null;`.
 */
export async function orNull<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    console.warn("[site] chiffres démo indisponibles", e);
    return null;
  }
}

export interface DemoAbsentAnswer {
  business: string;
  ia: string;
  question: string;
  intro: string;
  items: { name: string; note: string }[];
  outro: string;
}

/** Une vraie réponse du compte démo où l'entreprise n'est PAS citée (scène de conversation de /local). */
export function demoAbsentAnswer(segment: DemoSegment): DemoAbsentAnswer | null {
  const { audit } = latestAudit(segment);
  const reco = new Set(audit.queries.filter((q) => q.kind !== "brand").map((q) => q.id));
  const miss = audit.mentions
    .filter((m) => reco.has(m.queryId) && !m.mentioned && !m.noRec)
    .sort((a, b) => PROVIDER_ORDER.indexOf(a.provider) - PROVIDER_ORDER.indexOf(b.provider) || a.run - b.run);
  for (const m of miss) {
    const ans = (audit.answers ?? []).find((x) => x.queryId === m.queryId && x.provider === m.provider && x.run === m.run && !x.error);
    if (!ans) continue;
    const lines = ans.text.split("\n").map((l) => l.trim()).filter(Boolean);
    const items = parseItems(ans.text).filter((it) => !isPlatformName(it.name)).slice(0, 3);
    if (items.length < 3) continue;
    const last = lines[lines.length - 1];
    return {
      business: audit.input.businessName,
      ia: PROVIDER_LABEL[m.provider],
      question: audit.queries.find((q) => q.id === m.queryId)!.text,
      intro: lines[0],
      items,
      outro: /\*\*/.test(last) ? "" : last,
    };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* V4 : histoire du hero (absent à la 1re mesure, cité à la dernière)   */
/* ------------------------------------------------------------------ */

const MONTH_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const monthLabel = (iso: string) => {
  const d = new Date(iso);
  return `${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

export interface DemoStoryAnswer {
  /** « juin 2026 » */
  when: string;
  intro: string;
  items: { name: string; note: string; you?: boolean }[];
  /** rang de l'entreprise dans cette réponse, null si absente */
  rank: number | null;
  score: number;
}

export interface DemoHeroStory {
  segment: DemoSegment;
  business: string;
  ia: string;
  question: string;
  before: DemoStoryAnswer;
  after: DemoStoryAnswer;
  /** nombre de mesures entre les deux réponses (première et dernière comprises) */
  measures: number;
  /** IA du compte et verdict à la dernière mesure, sur la même question */
  engines: { ia: string; rank: number | null }[];
  /** « Cité dans 41 réponses sur 90 » (dernière mesure, toutes questions) */
  answers: string;
}

function storyAnswer(a: DemoAudit, qid: string, p: ProviderId, me: string): DemoStoryAnswer | null {
  const m = a.mentions.filter((x) => x.queryId === qid && x.provider === p && !x.noRec).sort((x, y) => x.run - y.run)[0];
  const ans = (a.answers ?? []).filter((x) => x.queryId === qid && x.provider === p && !x.error).sort((x, y) => x.run - y.run)[0];
  if (!m || !ans) return null;
  const items = parseItems(ans.text).filter((it) => !isPlatformName(it.name));
  const pos = items.findIndex((it) => it.name === me);
  const take = Math.max(3, pos + 1);
  if (items.length < 3) return null;
  return {
    when: monthLabel(a.createdAt),
    intro: (ans.text.split("\n")[0] ?? "").trim(),
    items: items.slice(0, take).map((it) => ({ ...it, you: it.name === me || undefined })),
    rank: pos >= 0 ? pos + 1 : null,
    score: a.score,
  };
}

const storyCache = new Map<DemoSegment, DemoHeroStory | null>();

/**
 * Scène du hero V4 : une vraie question du compte démo où l'entreprise était ABSENTE de la réponse d'une IA à la
 * première mesure et CITÉE par la même IA à la dernière (mêmes données que les comptes démo, rien d'écrit à la main).
 * Priorité à la question et à l'IA déjà montrées par `demoHeroAnswer`. null si aucun cas n'existe.
 */
export function demoHeroStory(segment: DemoSegment): DemoHeroStory | null {
  if (storyCache.has(segment)) return storyCache.get(segment)!;
  const { audit: last, audits } = latestAudit(segment);
  const first = audits[0];
  const s = auditStats(last);
  const me = s.rows.find((r) => r.isMe)?.name ?? last.input.businessName;
  const providers = PROVIDER_ORDER.filter((p) => s.providers.includes(p)).slice(0, 3);
  const hero = demoHeroAnswer(segment);
  const heroQ = last.queries.find((q) => q.text === hero.question)?.id;
  const heroP = PROVIDER_ORDER.find((x) => PROVIDER_LABEL[x] === hero.ia);
  const qids = [heroQ, ...last.queries.filter((q) => q.kind !== "brand").map((q) => q.id)].filter((x): x is string => !!x);
  const pids = [heroP, ...providers].filter((x): x is ProviderId => !!x);
  let out: DemoHeroStory | null = null;
  search: for (const qid of [...new Set(qids)]) {
    if (!first.queries.some((q) => q.id === qid)) continue;
    for (const p of [...new Set(pids)]) {
      const before = storyAnswer(first, qid, p, me);
      const after = storyAnswer(last, qid, p, me);
      if (!before || !after || before.rank !== null || after.rank === null || after.rank > 3) continue;
      const engines = providers.map((pp) => {
        const a = answerOf(last, s, qid, pp);
        return { ia: PROVIDER_LABEL[pp], rank: a && a.you > 0 ? a.you : null };
      });
      out = {
        segment,
        business: me,
        ia: PROVIDER_LABEL[p],
        question: last.queries.find((q) => q.id === qid)!.text,
        before,
        after,
        measures: audits.length,
        engines,
        answers: `Cité dans ${s.citations} réponses sur ${s.answers}`,
      };
      break search;
    }
  }
  storyCache.set(segment, out);
  return out;
}

export interface DemoMatrix {
  account: string;
  engines: string[];
  /** taux de mention (%) par IA, dans l'ordre de `engines` */
  rows: { name: string; you?: boolean; rates: number[]; total: number }[];
  answersPerEngine: number[];
}

/** Matrice concurrents × IA (dernière mesure du compte démo) : part des réponses de chaque IA qui citent chaque acteur. */
export function demoCompetitorMatrix(segment: DemoSegment = "pme", n = 5): DemoMatrix {
  const { audit } = latestAudit(segment);
  const s = auditStats(audit);
  const providers = PROVIDER_ORDER.filter((p) => s.providers.includes(p));
  const reco = new Set(audit.queries.filter((q) => q.kind !== "brand").map((q) => q.id));
  const ms = audit.mentions.filter((m) => reco.has(m.queryId) && !m.noRec);
  const per = providers.map((p) => ms.filter((m) => m.provider === p));
  const top = topRows(demoMeasure(segment), n);
  return {
    account: audit.input.businessName,
    engines: providers.map((p) => PROVIDER_LABEL[p]),
    answersPerEngine: per.map((l) => l.length),
    rows: top.map((r) => {
      const rates = per.map((l) =>
        l.length ? pct(l.filter((m) => (r.you ? m.mentioned : m.competitors.includes(r.name))).length / l.length) : 0,
      );
      return { name: r.name, you: r.you, rates, total: r.v };
    }),
  };
}

export interface DemoLocalMap {
  account: string;
  city: string;
  disclaimer: string;
  zones: { n: string; x: number; y: number; home?: boolean; rate: number | null; band: string; rival: string | null; answers: number }[];
}

/** Carte de quartier complète du compte démo local (mêmes données que l'onglet Local de l'app). */
export async function demoLocalMap(): Promise<DemoLocalMap | null> {
  const { buildLocalDemo } = await import("@/lib/local");
  const d = await buildLocalDemo("demo");
  if (!d) return null;
  return {
    account: buildDemoWorkspace("local").business.name,
    city: d.map.city,
    disclaimer: d.map.disclaimer,
    zones: d.map.zones.map((z) => ({
      n: z.label,
      x: z.x,
      y: z.y,
      home: z.home || undefined,
      rate: z.mentionRate === null ? null : Math.round(z.mentionRate * 100),
      band: z.band,
      rival: z.dominantCompetitor?.name ?? null,
      answers: z.answers,
    })),
  };
}
