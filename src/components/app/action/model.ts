/**
 * Centre d'actions : classement, regroupement et preuve de chaque action (logique pure, testée).
 * Les chiffres viennent de l'audit (moteur) et ne sont jamais recalculés ailleurs que dans ces fonctions.
 */
import type { AuditResult } from '@/lib/engine';
import type { AuditResultV2Ext, ExecTask, TaskKind } from '@/lib/engine/types-v2';

export type ActionGroup = 'site' | 'web' | 'technique' | 'erreur';

export const GROUP_ORDER: ActionGroup[] = ['erreur', 'site', 'web', 'technique'];

export const GROUP_LABEL: Record<ActionGroup, { title: string; lead: string }> = {
  erreur: { title: 'Corriger une erreur', lead: 'Une IA donne une information fausse sur vous : à corriger en premier.' },
  site: { title: 'Sur votre site', lead: 'Pages et contenus que les IA peuvent citer.' },
  web: { title: 'Ailleurs sur le web', lead: 'Fiches, annuaires, avis et médias que les IA lisent.' },
  technique: { title: 'Technique', lead: 'Balisage et données qui aident les IA à vous comprendre.' },
};

const KIND_GROUP: Record<TaskKind, ActionGroup> = {
  fact_fix: 'erreur',
  faq_page: 'site',
  content: 'site',
  schema: 'technique',
  product_feed: 'technique',
  gbp_profile: 'web',
  bing_places: 'web',
  apple_business: 'web',
  directory: 'web',
  review_request: 'web',
  review_reply: 'web',
  source_outreach: 'web',
  other: 'web',
};

export function groupOf(kind: TaskKind): ActionGroup {
  return KIND_GROUP[kind] ?? 'web';
}

/** Facilité : 3 = rapide (≤ 30 min), 2 = moyen (≤ 2 h), 1 = long. */
export function easeOf(minutes: number): 1 | 2 | 3 {
  if (minutes <= 30) return 3;
  if (minutes <= 120) return 2;
  return 1;
}

export function effortOf(minutes: number): 'S' | 'M' | 'L' {
  const e = easeOf(minutes);
  return e === 3 ? 'S' : e === 2 ? 'M' : 'L';
}

/** Score de priorité = impact (1 à 3) × facilité (1 à 3), de 1 à 9. Une erreur factuelle passe d'un cran. */
export function actionScore(t: Pick<ExecTask, 'impact' | 'minutes' | 'kind'>): number {
  const base = t.impact * easeOf(t.minutes);
  return t.kind === 'fact_fix' ? Math.min(9, base + 1) : base;
}

/** Tri : score décroissant, puis le plus rapide, puis le titre (stable). */
export function sortActions<T extends Pick<ExecTask, 'impact' | 'minutes' | 'kind' | 'title'>>(list: T[]): T[] {
  return [...list].sort((a, b) => actionScore(b) - actionScore(a) || a.minutes - b.minutes || a.title.localeCompare(b.title, 'fr'));
}

export interface ActionProof {
  kind: 'question' | 'source' | 'error' | 'none';
  /** Phrase courte, factuelle, tirée de l'audit. */
  text: string;
  href?: string;
}

type Audit = Pick<AuditResult, 'queries' | 'mentions'> & Pick<AuditResultV2Ext, 'sources' | 'factCheck'>;

const PROVIDER: Record<string, string> = { chatgpt: 'ChatGPT', perplexity: 'Perplexity', gemini: 'Gemini', claude: 'Claude', mistral: 'Mistral (Le Chat)' };
const FIELD_WORDS: Record<string, RegExp> = {
  adresse: /adresse/i,
  telephone: /t[ée]l[ée]phone|num[ée]ro/i,
  horaires: /horaire|ouvert|dimanche/i,
  prix: /prix|tarif/i,
  zone: /zone|secteur/i,
  services: /service|prestation/i,
  dirigeant: /dirigeant|g[ée]rant|fondat/i,
  creation: /cr[ée]ation|fond[ée]/i,
  site: /site/i,
  statut: /ferm[ée]|statut/i,
  produits: /produit/i,
  livraison: /livraison/i,
  retours: /retour/i,
  ingredients: /ingr[ée]dient|composition|inci/i,
  certifications: /label|certif/i,
};

function plural(n: number, one: string, many: string) {
  return `${n} ${n > 1 ? many : one}`;
}

function listNames(names: string[]) {
  const n = names.slice(0, 2);
  if (!n.length) return '';
  return n.length === 1 ? n[0] : `${n[0]} et ${n[1]}`;
}

/** Question « perdue » : vous n'êtes cité dans aucune réponse, des concurrents le sont. La plus disputée d'abord. */
export function lostQuestions(audit: Audit): { id: string; text: string; answers: number; competitors: string[] }[] {
  const out: { id: string; text: string; answers: number; competitors: string[]; weight: number }[] = [];
  for (const q of audit.queries) {
    if (q.kind === 'brand') continue;
    const ms = audit.mentions.filter((m) => m.queryId === q.id && !m.noRec);
    if (!ms.length || ms.some((m) => m.mentioned)) continue;
    const count = new Map<string, number>();
    for (const m of ms) for (const c of m.competitors) count.set(c, (count.get(c) ?? 0) + 1);
    if (!count.size) continue;
    const competitors = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
    out.push({ id: q.id, text: q.text, answers: ms.length, competitors, weight: [...count.values()].reduce((s, v) => s + v, 0) });
  }
  return out.sort((a, b) => b.weight - a.weight).map(({ weight: _w, ...r }) => r);
}

export function proofFor(t: Pick<ExecTask, 'kind' | 'title' | 'why' | 'sourceDomain'>, audit: Audit | null, used: Set<string> = new Set()): ActionProof {
  if (!audit) return { kind: 'none', text: t.why };
  const g = groupOf(t.kind);
  if (g === 'erreur') {
    const wrong = (audit.factCheck?.items ?? []).filter((i) => i.verdict === 'faux');
    const hay = `${t.title} ${t.why}`;
    const item = wrong.find((i) => FIELD_WORDS[i.field]?.test(hay)) ?? wrong[0];
    if (item) {
      return {
        kind: 'error',
        text: `${PROVIDER[item.provider] ?? item.provider} répond « ${item.stated} » alors que votre fiche indique « ${item.expected} ».`,
        href: '/app/verite',
      };
    }
  }
  if (t.sourceDomain) {
    const d = audit.sources?.domains.find((x) => x.domain === t.sourceDomain || t.sourceDomain!.endsWith(`.${x.domain}`));
    if (d && d.citations > 0) {
      const absent = d.clientPresence === 'present' ? '' : ' ; vous n’y figurez pas';
      const who = d.competitorsPresent.length ? `, ${listNames(d.competitorsPresent)} oui` : '';
      return { kind: 'source', text: `${d.label} est cité ${plural(d.citations, 'fois', 'fois')} dans les réponses des IA${absent}${absent ? who : ''}.`, href: `/app/sources?d=${encodeURIComponent(d.domain)}` };
    }
  }
  if (g === 'site' || g === 'technique' || !t.sourceDomain) {
    const lost = lostQuestions(audit);
    const q = lost.find((x) => !used.has(x.id)) ?? lost[0];
    if (q) {
      used.add(q.id);
      return {
        kind: 'question',
        text: `« ${q.text} » : vous n’êtes cité dans aucune des ${q.answers} réponses ; ${listNames(q.competitors)} ${q.competitors.length > 1 ? 'le sont' : 'l’est'}.`,
        href: `/app/questions?q=${encodeURIComponent(q.id)}`,
      };
    }
  }
  return { kind: 'none', text: t.why };
}

// ---------------------------------------------------------------------------
// Vue calendrier : semaines (lundi) avec actions prévues et faites
// ---------------------------------------------------------------------------
export function mondayOf(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
}

export interface CalendarWeek<T> {
  monday: string;
  current: boolean;
  planned: T[];
  done: T[];
}

/**
 * `before` semaines passées, la semaine en cours, `after` semaines à venir. Une action ouverte sans semaine
 * (ou d'une semaine passée) est replacée dans la semaine en cours : rien ne disparaît du calendrier.
 */
export function calendarWeeks<T extends Pick<ExecTask, 'status' | 'week' | 'doneAt'>>(tasks: T[], today: Date, before = 2, after = 3): CalendarWeek<T>[] {
  const cur = mondayOf(today);
  const weeks: CalendarWeek<T>[] = [];
  for (let i = -before; i <= after; i++) {
    const d = new Date(`${cur}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i * 7);
    weeks.push({ monday: d.toISOString().slice(0, 10), current: i === 0, planned: [], done: [] });
  }
  const last = weeks[weeks.length - 1].monday;
  for (const t of tasks) {
    if (t.status === 'skipped') continue;
    if (t.status === 'done') {
      if (!t.doneAt) continue;
      const m = mondayOf(new Date(t.doneAt));
      weeks.find((w) => w.monday === m)?.done.push(t);
      continue;
    }
    let m = t.week && t.week >= cur ? t.week : cur;
    if (m > last) m = last;
    weeks.find((w) => w.monday === m)?.planned.push(t);
  }
  return weeks;
}
