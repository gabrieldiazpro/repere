/**
 * Types du simulateur de scénarios (SCENARIOS, V9) : « Et si je corrigeais ces points ? ».
 * Les scores « après » sont recalculés par les MÊMES fonctions d'audit que l'app (auditSeo / auditGeo) sur une copie
 * de l'exploration où les corrections ont été appliquées ; aucun gain n'est promis, aucun trafic n'est estimé.
 */
import type { Finding, Severity, SiteCrawl } from '@/lib/crawl/types';
import type { SeoReport } from '@/lib/seoaudit/types';
import type { GeoReport } from '@/lib/geo/types';

export type Origin = 'seo' | 'geo';

/** Qui fait le travail : Repéré prépare et applique après validation / Repéré prépare, vous relisez / vous. */
export type Who = 'auto' | 'guide' | 'vous';

export interface Reports {
  seo: SeoReport;
  geo: GeoReport;
}

/** Audit complet d'une exploration : DOIT être la fonction utilisée par l'app (auditBoth). */
export type Auditor = (crawl: SiteCrawl) => Reports;

export interface Candidate {
  /** `${origin}:${id}` */
  key: string;
  origin: Origin;
  id: string;
  title: string;
  fix: string;
  why: string;
  section: string;
  sectionLabel: string;
  severity: Severity;
  impact: 1 | 2 | 3;
  effort: 1 | 2 | 3;
  affectedCount: number;
  /** premières pages concernées */
  pages: string[];
  who: Who;
  /** temps estimé de votre côté (minutes), d'après l'effort du contrôle et qui fait le travail */
  minutes: number;
  autoFixKind?: string;
  /** null = simulable ; sinon raison de l'exclusion */
  unsimulable: string | null;
  /** effet seul, mesuré par les contrôles (rempli par `rankCandidates`) */
  alone?: { seo: number; geo: number; sections: number } | null;
}

export interface SectionDelta {
  origin: Origin;
  id: string;
  label: string;
  before: number;
  after: number;
}

export interface SimResult {
  /** clés demandées */
  selection: string[];
  /** constats effectivement simulés */
  applied: { key: string; title: string; items: number; notes: string[]; skipped: string[] }[];
  /** constats exclus de la simulation, avec la raison */
  excluded: { key: string; title: string; reason: string; who: Who }[];
  before: { seo: number; geo: number };
  after: { seo: number; geo: number };
  sections: SectionDelta[];
  /** constats simulés qui disparaissent */
  resolved: string[];
  /** constats simulés encore présents (moins de pages, ou inchangés) */
  remaining: { key: string; title: string; before: number; after: number }[];
  /** constats qui apparaîtraient ou s'aggraveraient (honnêteté : une correction peut en créer une autre) */
  appeared: { key: string; title: string }[];
  /** pages distinctes concernées par les constats choisis */
  pages: number;
  minutes: number;
  who: Record<Who, number>;
}

export type PresetId = 'rentables' | 'repere' | 'trente' | 'perso';

export interface Scenario {
  id: PresetId;
  title: string;
  lead: string;
  keys: string[];
  result: SimResult;
}

/** Lancement d'un scénario (suivi « prévu vs mesuré » à l'exploration suivante). */
export interface ScenarioLaunch {
  id: string;
  businessId: string;
  at: string;
  /** exploration de départ */
  runId: string;
  runAt: string;
  title: string;
  keys: string[];
  /** titres au moment du lancement (affichage même si le constat disparaît) */
  titles: Record<string, string>;
  predicted: { seo: number; geo: number; resolved: string[]; sections: SectionDelta[] };
  before: { seo: number; geo: number };
  changeSetIds: string[];
  taskIds: string[];
  demo?: boolean;
}

export interface LaunchFollowUp {
  status: 'waiting' | 'measured';
  measuredAt?: string;
  predicted: { seo: number; geo: number };
  measured?: { seo: number; geo: number };
  /** par constat : prévu réglé / mesuré réglé */
  findings: { key: string; title: string; predictedResolved: boolean; measuredResolved: boolean | null }[];
}

export type { Finding };
