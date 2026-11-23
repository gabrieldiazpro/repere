/**
 * Pilote automatique — récapitulatif du lundi (et rapport du mois le premier lundi du mois). PUR, testé.
 * Contenu : ce qui a été fait (séries, contenus), l'effet mesuré AVEC la marge (jamais présenté comme une preuve
 * quand la variation reste dans la marge), ce qui attend le client (contenus en relecture, propositions hors mandat).
 */
import type { AutopilotEmail } from '@/lib/email';
import { SCORE_DROP_MARGIN, type Mandate } from './mandate';
import type { AutopilotJournalEntry, AutopilotState, ContentSchedule, SeriesRecord } from './store';

const DAY = 86_400_000;

/** Récapitulatif dû : le lundi (heure de Paris), au plus une fois tous les 6 jours. */
export function isRecapDue(lastRecapAt: string | null | undefined, now: Date): boolean {
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'Europe/Paris' }).format(now);
  if (weekday !== 'Mon') return false;
  if (!lastRecapAt) return true;
  const t = Date.parse(lastRecapAt);
  return !Number.isFinite(t) || now.getTime() - t >= 6 * DAY;
}

export interface EffectLine {
  label: string;
  before: number;
  after: number;
  /** variation au-delà de la marge ? */
  beyondMargin: boolean;
  text: string;
}

export interface Recap {
  monthly: boolean;
  periodLabel: string;
  series: SeriesRecord[];
  undone: SeriesRecord[];
  published: ContentSchedule[];
  inReview: ContentSchedule[];
  effects: EffectLine[];
  waitingProposals: number;
  used: number;
  limits: { series: number; contents: number };
  mandateStatus: Mandate['status'] | 'none';
  guard: AutopilotState['guard'];
}

function effectOf(label: string, before: number | null | undefined, after: number | null | undefined, margin: number): EffectLine | null {
  if (typeof before !== 'number' || typeof after !== 'number') return null;
  const delta = after - before;
  const beyond = Math.abs(delta) > margin;
  const sign = delta > 0 ? `+${delta}` : `${delta}`;
  const text = beyond
    ? `${label} : ${before} → ${after} (${sign} points, au-delà de la marge de ±${margin}).`
    : `${label} : ${before} → ${after} (${sign} points, dans la marge de ±${margin} : pas de conclusion à en tirer).`;
  return { label, before, after, beyondMargin: beyond, text };
}

export function buildRecap(o: {
  state: AutopilotState;
  journal: AutopilotJournalEntry[];
  now: Date;
  used: number;
  limits: { series: number; contents: number };
  mandate: Pick<Mandate, 'status'> | null;
  waitingProposals?: number;
}): Recap {
  const monthly = !o.state.lastRecapAt || o.state.lastRecapAt.slice(0, 7) !== o.now.toISOString().slice(0, 7);
  const since = monthly && o.state.lastRecapAt ? Date.parse(o.state.lastRecapAt) : o.now.getTime() - 7 * DAY;
  const inPeriod = (iso?: string) => !!iso && Date.parse(iso) >= since && Date.parse(iso) <= o.now.getTime();
  const series = o.state.series.filter((s) => inPeriod(s.appliedAt) && s.status !== 'failed');
  const undone = o.state.series.filter((s) => inPeriod(s.undoneAt));
  const published = o.state.contents.filter((c) => c.status === 'published' && inPeriod(c.publishedAt));
  const inReview = o.state.contents.filter((c) => c.status === 'scheduled');
  // Effet : la série la plus ancienne de la période qui a une mesure avant/après (analyse suivante).
  const measured = o.state.series.filter((s) => s.baseline && s.after && inPeriod(s.checkedAt)).sort((a, b) => a.appliedAt.localeCompare(b.appliedAt));
  const effects: EffectLine[] = [];
  if (measured.length) {
    const first = measured[0];
    const last = measured.at(-1)!;
    const seo = effectOf('Score SEO du site', first.baseline!.seo, last.after!.seo, SCORE_DROP_MARGIN);
    const geo = effectOf('Score GEO (lisibilité par les IA)', first.baseline!.geo, last.after!.geo, SCORE_DROP_MARGIN);
    if (seo) effects.push(seo);
    if (geo) effects.push(geo);
  }
  const fmt = (t: number) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
  return {
    monthly,
    periodLabel: monthly ? `mois de ${new Date(since).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })}` : `semaine du ${fmt(since)} au ${fmt(o.now.getTime())}`,
    series,
    undone,
    published,
    inReview,
    effects,
    waitingProposals: o.waitingProposals ?? 0,
    used: o.used,
    limits: o.limits,
    mandateStatus: o.mandate?.status ?? 'none',
    guard: o.state.guard ?? null,
  };
}

const n = (k: number, one: string, many: string) => `${k} ${k > 1 ? many : one}`;

export function recapEmail(r: Recap, o: { name: string; businessId: string; app: string; actionUrl: (b: string, k: 'undo' | 'block' | 'pause', ref?: string) => string }): AutopilotEmail {
  const did = r.series.length + r.published.length;
  const paragraphs: string[] = [
    did
      ? `Pendant la ${r.periodLabel}, le pilote automatique a fait ${n(r.series.length, 'série de corrections', 'séries de corrections')} et mis en ligne ${n(r.published.length, 'contenu', 'contenus')} sur le site de ${o.name}.`
      : `Pendant la ${r.periodLabel}, le pilote automatique n’a rien eu à faire sur le site de ${o.name} dans le cadre de votre mandat.`,
    `Ce mois-ci : ${r.used} série${r.used > 1 ? 's' : ''} appliquée${r.used > 1 ? 's' : ''} sur ${r.limits.series} possibles.`,
  ];
  if (r.effects.length) paragraphs.push(`Effet mesuré par notre analyse du site (une mesure, pas une promesse) : ${r.effects.map((e) => e.text).join(' ')}`);
  else paragraphs.push('Effet mesuré : la prochaine analyse du site dira si ces changements se voient. Nous comparons toujours avec la marge d’erreur.');
  if (r.mandateStatus === 'paused') paragraphs.push(r.guard ? `Le pilote est arrêté depuis le ${r.guard.trippedAt.slice(0, 10)} : ${r.guard.detail}. Il ne reprendra qu’avec votre accord.` : 'Le pilote est en pause : rien n’est fait tant que vous ne le relancez pas.');
  if (r.waitingProposals) paragraphs.push(`${n(r.waitingProposals, 'proposition attend', 'propositions attendent')} votre validation : elle${r.waitingProposals > 1 ? 's' : ''} sor${r.waitingProposals > 1 ? 'tent' : 't'} du cadre de votre mandat (page juridique, prix, catégorie non cochée…).`);
  const items: AutopilotEmail['items'] = [
    ...r.series.map((s) => ({ text: `${s.title} — ${s.appliedAt.slice(0, 10)}${s.status === 'undone' ? ' (annulée)' : ''}`, link: s.status === 'undone' ? undefined : { label: 'Annuler', url: o.actionUrl(o.businessId, 'undo', s.csId) } })),
    ...r.published.map((c) => ({ text: `En ligne : ${c.title}${c.liveUrl ? ` (${c.liveUrl})` : ''}` })),
    ...r.inReview.map((c) => ({ text: `En relecture jusqu’au ${c.publishAt.slice(0, 10)} : ${c.title}`, link: { label: 'Bloquer', url: o.actionUrl(o.businessId, 'block', c.draftId) } })),
  ];
  return {
    tag: r.monthly ? 'autopilot_report' : 'autopilot_recap',
    subject: r.monthly ? `Rapport du mois — pilote automatique de ${o.name}` : `Votre semaine en pilote automatique — ${o.name}`,
    preheader: did ? `${n(did, 'action faite', 'actions faites')} pour vous, toutes annulables.` : 'Rien à signaler cette semaine.',
    paragraphs,
    items,
    cta: { label: 'Ouvrir le pilote automatique', url: `${o.app}/app/agent/pilote` },
  };
}
