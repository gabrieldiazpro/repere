// Liste « Bien démarrer » (Lundi) et onboarding guidé (/app/bienvenue) : logique pure, testée.
// Première valeur en moins de 5 minutes : site → questions → première mesure → fiche de vérité → suivi du trafic,
// puis la première action faite.

export type EtapeId = 'site' | 'questions' | 'mesure' | 'verite' | 'trafic' | 'action';

export interface Signaux {
  website: string | null | undefined;
  /** questions suivies actives */
  questions: number;
  /** mesures terminées */
  audits: number;
  /** champs renseignés dans la fiche de vérité */
  facts: number;
  /** visites ou passages de robots mesurés par le script de suivi */
  trafficHits: number;
  /** actions faites */
  tasksDone: number;
}

export interface EtapeDemarrage {
  id: EtapeId;
  titre: string;
  detail: string;
  minutes: number;
  /** écran où faire l'étape */
  href: string;
  done: boolean;
}

const DEF: Omit<EtapeDemarrage, 'done'>[] = [
  { id: 'site', titre: 'Votre site', detail: 'L’adresse que les IA devraient citer.', minutes: 1, href: '/app/bienvenue?etape=site' },
  { id: 'questions', titre: 'Vos questions suivies', detail: 'Les questions que vos clients posent aux IA.', minutes: 1, href: '/app/bienvenue?etape=questions' },
  { id: 'mesure', titre: 'Votre première mesure', detail: 'Repéré pose vos questions aux IA.', minutes: 1, href: '/app/bienvenue?etape=mesure' },
  { id: 'verite', titre: 'Votre fiche de vérité', detail: 'Horaires, prix, zone : la bonne information.', minutes: 2, href: '/app/verite' },
  { id: 'trafic', titre: 'Le suivi du trafic', detail: 'Une ligne à coller pour voir les visites venues des IA.', minutes: 2, href: '/app/trafic' },
  { id: 'action', titre: 'Votre première action', detail: 'La correction la plus utile de la semaine.', minutes: 15, href: '/app/actions' },
];

/** Seuil : au moins 3 champs de la fiche de vérité renseignés. */
export const FACTS_MIN = 3;

export function etapesDemarrage(s: Signaux, faitesALaMain: ReadonlySet<EtapeId> = new Set()): EtapeDemarrage[] {
  const auto: Record<EtapeId, boolean> = {
    site: Boolean(s.website && s.website.trim()),
    questions: s.questions > 0,
    mesure: s.audits > 0,
    verite: s.facts >= FACTS_MIN,
    trafic: s.trafficHits > 0,
    action: s.tasksDone > 0,
  };
  return DEF.map((d) => ({ ...d, done: auto[d.id] || faitesALaMain.has(d.id) }));
}

export function progression(etapes: EtapeDemarrage[]) {
  const faites = etapes.filter((e) => e.done).length;
  const suivante = etapes.find((e) => !e.done) ?? null;
  const reste = etapes.filter((e) => !e.done).reduce((m, e) => m + e.minutes, 0);
  return { faites, total: etapes.length, suivante, termine: faites === etapes.length, minutesRestantes: reste, label: `${faites} sur ${etapes.length}` };
}

/** Les 3 étapes de l'assistant /app/bienvenue (les suivantes vivent sur leur écran). */
export const ETAPES_ASSISTANT: EtapeId[] = ['site', 'questions', 'mesure'];

export function etapeAssistant(v: string | null | undefined, etapes: EtapeDemarrage[]): EtapeId {
  if (v && (ETAPES_ASSISTANT as string[]).includes(v)) return v as EtapeId;
  return (etapes.find((e) => !e.done && ETAPES_ASSISTANT.includes(e.id))?.id ?? 'mesure') as EtapeId;
}

export const DEMARRAGE_STORAGE = 'rp_demarrage';

/** Étapes cochées à la main et liste masquée (par commerce, sur l'appareil). */
export interface DemarrageLocal {
  manual: EtapeId[];
  hidden: boolean;
}

export function parseDemarrage(raw: string | null | undefined): DemarrageLocal {
  try {
    const v = JSON.parse(raw ?? '') as Partial<DemarrageLocal>;
    const ids = new Set(DEF.map((d) => d.id));
    return { manual: (Array.isArray(v.manual) ? v.manual : []).filter((x): x is EtapeId => ids.has(x as EtapeId)), hidden: Boolean(v.hidden) };
  } catch {
    return { manual: [], hidden: false };
  }
}

/** Normalise une adresse de site saisie (ajoute https://, refuse ce qui n'est pas un domaine). */
export function normaliserSite(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withProto);
    if (!/^[a-z0-9À-ɏ-]+(\.[a-z0-9À-ɏ-]+)*\.[a-z]{2,}$/i.test(u.hostname)) return null;
    return `${u.protocol}//${u.hostname}${u.pathname === '/' ? '' : u.pathname}`;
  } catch {
    return null;
  }
}
