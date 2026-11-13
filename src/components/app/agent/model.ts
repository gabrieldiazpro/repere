/**
 * Agent de publication (V5, écran /app/agent) : logique pure, sans dépendance serveur, testée.
 * Libellés, tons, différences mot à mot, champs « [à compléter] », droits, simulation de la démo, réglages.
 * Les données viennent de @/lib/publish (types seulement ici : ce fichier est importé côté navigateur).
 */
import type { Change, ChangeKind, ChangeSet, ChangeSetStatus, Platform, Risk } from '@/lib/publish/types';
import type { JournalAction, JournalEntry } from '@/lib/publish/journal';
import type { TaskKind } from '@/lib/engine/types-v2';
import type { Tone } from '@/components/ui/tone';

export type { Change, ChangeKind, ChangeSet, ChangeSetStatus, JournalEntry, Platform, Risk };

/** Rôle de la personne qui regarde l'écran (« demo » : compte démo, simulation côté interface). */
export type ViewerRole = 'owner' | 'admin' | 'member' | 'viewer' | 'demo';

export const PLATFORM_NAME: Record<Platform, string> = {
  wordpress: 'WordPress',
  shopify: 'Shopify',
  webflow: 'Webflow',
  prestashop: 'PrestaShop',
  export: 'Export de fichiers',
  gbp: 'Fiche Google',
};

export const KIND_NAME: Record<ChangeKind, string> = {
  'meta.title': 'Titre de la page',
  'meta.description': 'Description dans Google',
  'image.alt': 'Texte alternatif d’image',
  jsonld: 'Données structurées',
  faq: 'Questions fréquentes balisées',
  redirect: 'Redirection',
  canonical: 'Adresse de référence (canonique)',
  'robots.txt': 'Fichier robots.txt',
  'llms.txt': 'Fichier llms.txt',
  rewrite: 'Passage réécrit',
  'gbp.description': 'Description de la fiche Google',
  'gbp.hours': 'Horaires de la fiche Google',
  'sitemap.xml': 'Plan du site',
  'meta.robots': 'Consigne d’indexation',
};

/** Contenus « fichier » ou code : affichés en chasse fixe, ligne par ligne. */
export const CODE_KINDS: ReadonlySet<ChangeKind> = new Set(['jsonld', 'faq', 'robots.txt', 'llms.txt', 'sitemap.xml']);

export const STATUS_VIEW: Record<ChangeSetStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Brouillon', tone: 'neutral' },
  proposed: { label: 'À valider', tone: 'warn' },
  validated: { label: 'Validé, à appliquer', tone: 'brand' },
  applying: { label: 'Application en cours', tone: 'brand' },
  applied: { label: 'Appliqué, vérification à refaire', tone: 'warn' },
  partially_applied: { label: 'Appliqué en partie', tone: 'warn' },
  verified: { label: 'Appliqué et vérifié', tone: 'up' },
  reverted: { label: 'Annulé', tone: 'neutral' },
  rejected: { label: 'Refusé', tone: 'neutral' },
  failed: { label: 'Échec', tone: 'down' },
};

export const RISK_VIEW: Record<Risk, { label: string; tone: Tone; help: string }> = {
  low: { label: 'Risque faible', tone: 'up', help: 'Texte visible dans Google ou par les IA ; ne change ni l’adresse ni l’affichage de vos pages.' },
  medium: { label: 'Risque moyen', tone: 'warn', help: 'Ajoute du contenu ou du balisage à une page : relisez-le avant de valider.' },
  high: { label: 'Risque élevé', tone: 'down', help: 'Peut retirer des pages de Google ou changer des adresses : à valider en connaissance de cause.' },
};

/** Ce que la modification aide à faire (jamais un résultat promis). */
export const KIND_GAIN: Record<ChangeKind, string> = {
  'meta.title': 'Un titre clair aide Google et les IA à comprendre de quoi parle la page.',
  'meta.description': 'Une description donne envie de cliquer dans les résultats de Google.',
  'image.alt': 'Décrit vos images à Google Images et aux lecteurs d’écran.',
  jsonld: 'Aide Google et les IA à identifier votre activité sans se tromper (nom, adresse, offre).',
  faq: 'Des réponses courtes et balisées sont plus faciles à citer pour une IA.',
  redirect: 'Évite les pages introuvables et conserve leurs liens.',
  canonical: 'Indique à Google la bonne version d’une page en double.',
  'robots.txt': 'Laisse les robots de recherche des IA lire vos pages.',
  'llms.txt': 'Donne aux IA un sommaire fiable de votre site.',
  rewrite: 'Un passage qui répond directement à la question est plus facile à citer.',
  'gbp.description': 'La description de la fiche est l’un des premiers textes lus par les IA.',
  'gbp.hours': 'Des horaires exacts évitent que les IA répètent une erreur.',
  'sitemap.xml': 'Aide Google à trouver toutes vos pages.',
  'meta.robots': 'Contrôle ce que Google peut afficher.',
};

export const SEVERITY_IMPACT: Record<string, { label: string; level: 1 | 2 | 3 }> = {
  critical: { label: 'Effet attendu : fort', level: 3 },
  high: { label: 'Effet attendu : fort', level: 3 },
  medium: { label: 'Effet attendu : moyen', level: 2 },
  low: { label: 'Effet attendu : faible', level: 1 },
  info: { label: 'Effet attendu : faible', level: 1 },
};

export function originOf(cs: Pick<ChangeSet, 'origin'>): { label: string; kind: 'seo' | 'geo' | 'autre' } {
  const id = cs.origin.findingId;
  if (id.startsWith('geo.')) return { label: 'Constat IA (GEO)', kind: 'geo' };
  if (id.startsWith('seo.')) return { label: 'Constat SEO', kind: 'seo' };
  return { label: 'Constat', kind: 'autre' };
}

export function impactOf(cs: Pick<ChangeSet, 'origin'>) {
  return SEVERITY_IMPACT[cs.origin.severity ?? 'medium'] ?? SEVERITY_IMPACT.medium;
}

/** Titre lisible sans le préfixe « [Démo] » (la démo est signalée par le bandeau et une étiquette). */
export function cleanTitle(title: string): string {
  return title.replace(/^\[\s*démo\s*\]\s*/i, '');
}

// ---------------------------------------------------------------------------
// Droits
// ---------------------------------------------------------------------------
const RANK: Record<ViewerRole, number> = { viewer: 1, member: 2, admin: 3, owner: 4, demo: 4 };

/** Valider, appliquer, annuler : administrateur ou propriétaire (la démo simule un propriétaire). */
export const canPublish = (role: ViewerRole) => RANK[role] >= 3;
/** Modifier un texte proposé : contributeur et plus. */
export const canEdit = (role: ViewerRole) => RANK[role] >= 2;

export const ROLE_NAME: Record<ViewerRole, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  member: 'Contributeur',
  viewer: 'Lecteur',
  demo: 'Compte démo',
};

export function actorName(a: { id: string; email?: string; role?: string } | undefined, meId?: string | null): string {
  if (!a) return 'inconnu';
  if (a.id === 'agent') return 'l’agent Repéré';
  if (a.id === 'system') return 'Repéré';
  if (a.id === 'demo' || a.id === 'demo-user') return 'vous (démo)';
  if (meId && a.id === meId) return 'vous';
  return a.email ?? 'un membre de l’équipe';
}

// ---------------------------------------------------------------------------
// « [à compléter] »
// ---------------------------------------------------------------------------
export const TO_COMPLETE_RE = /\[\s*à compléter\s*\]/i;
export const TO_COMPLETE_SPLIT = /(\[\s*à compléter\s*\])/i;

export function needsCompletion(c: Pick<Change, 'after'>): boolean {
  return typeof c.after === 'string' && TO_COMPLETE_RE.test(c.after);
}

/** Changements qui bloquent la validation (hors ceux que la personne a écartés). */
export function blockers(cs: Pick<ChangeSet, 'changes'>, excluded: ReadonlySet<string> = new Set()): Change[] {
  return cs.changes.filter((c) => !excluded.has(c.id) && c.status !== 'skipped' && needsCompletion(c));
}

// ---------------------------------------------------------------------------
// Différences mot à mot (AVANT / APRÈS)
// ---------------------------------------------------------------------------
export interface Seg {
  t: 'same' | 'del' | 'add';
  s: string;
}

function tokens(s: string): string[] {
  return s.match(/\s+|[^\s]+/g) ?? [];
}

function merge(out: Seg[], t: Seg['t'], s: string) {
  const last = out[out.length - 1];
  if (last && last.t === t) last.s += s;
  else out.push({ t, s });
}

/**
 * Différence mot à mot (plus longue sous-suite commune). Au-delà de ~160 000 cellules, repli ligne à ligne, puis
 * remplacement complet : l'affichage reste juste, seul le surlignage devient plus grossier.
 */
export function diffWords(before: string | null, after: string | null, budget = 160_000): Seg[] {
  const a0 = before ?? '';
  const b0 = after ?? '';
  if (a0 === b0) return a0 ? [{ t: 'same', s: a0 }] : [];
  if (!a0) return [{ t: 'add', s: b0 }];
  if (!b0) return [{ t: 'del', s: a0 }];
  let a = tokens(a0);
  let b = tokens(b0);
  if (a.length * b.length > budget) {
    a = a0.split(/(?<=\n)/);
    b = b0.split(/(?<=\n)/);
    if (a.length * b.length > budget) return [{ t: 'del', s: a0 }, { t: 'add', s: b0 }];
  }
  // préfixe et suffixe communs (le cas courant : un mot changé au milieu)
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let q = 0;
  while (q < a.length - p && q < b.length - p && a[a.length - 1 - q] === b[b.length - 1 - q]) q++;
  const A = a.slice(p, a.length - q);
  const B = b.slice(p, b.length - q);
  const n = A.length;
  const m = B.length;
  const L: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: Seg[] = [];
  if (p) merge(out, 'same', a.slice(0, p).join(''));
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      merge(out, 'same', A[i]);
      i++;
      j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) merge(out, 'del', A[i++]);
    else merge(out, 'add', B[j++]);
  }
  while (i < n) merge(out, 'del', A[i++]);
  while (j < m) merge(out, 'add', B[j++]);
  if (q) merge(out, 'same', a.slice(a.length - q).join(''));
  // un blanc isolé entre deux changements se lit mieux rattaché aux deux côtés
  return out.flatMap((sg, k) => (sg.t === 'same' && /^\s+$/.test(sg.s) && out[k - 1] && out[k + 1] && out[k - 1].t !== 'same' && out[k + 1].t !== 'same' ? [{ t: 'del' as const, s: sg.s }, { t: 'add' as const, s: sg.s }] : [sg]));
}

/** Nombre de mots ajoutés / retirés (résumé sous la comparaison). */
export function diffStats(segs: Seg[]): { added: number; removed: number } {
  const words = (s: string) => (s.match(/[^\s]+/g) ?? []).length;
  return {
    added: segs.filter((x) => x.t === 'add').reduce((n, x) => n + words(x.s), 0),
    removed: segs.filter((x) => x.t === 'del').reduce((n, x) => n + words(x.s), 0),
  };
}

// ---------------------------------------------------------------------------
// Application : étapes du relais (affichage de la progression)
// ---------------------------------------------------------------------------
export interface ApplyStep {
  id: 'read' | 'write' | 'reread' | 'page';
  label: string;
  done: string;
}

export function applySteps(platform: Platform): ApplyStep[] {
  const name = PLATFORM_NAME[platform];
  if (platform === 'export') {
    return [
      { id: 'read', label: 'Relecture des valeurs actuelles', done: 'Valeurs actuelles relues' },
      { id: 'write', label: 'Préparation des fichiers', done: 'Fichiers prêts à déposer' },
      { id: 'page', label: 'Vérification de la page publique', done: 'Page publique relue' },
    ];
  }
  return [
    { id: 'read', label: `Lecture de l’état actuel chez ${name}`, done: 'État actuel identique à la proposition' },
    { id: 'write', label: `Écriture chez ${name}`, done: `Écrit chez ${name}` },
    { id: 'reread', label: `Relecture chez ${name}`, done: `Relu chez ${name} : conforme` },
    { id: 'page', label: 'Relecture de la page publique', done: 'Page publique relue : en ligne' },
  ];
}

// ---------------------------------------------------------------------------
// Journal : libellés
// ---------------------------------------------------------------------------
export const JOURNAL_LABEL: Record<JournalAction, { label: string; tone: Tone }> = {
  created: { label: 'Proposition préparée', tone: 'neutral' },
  proposed: { label: 'Proposée (valeurs actuelles relues)', tone: 'neutral' },
  edited: { label: 'Texte modifié', tone: 'neutral' },
  validated: { label: 'Validée', tone: 'brand' },
  rejected: { label: 'Refusée', tone: 'neutral' },
  'apply.started': { label: 'Application lancée', tone: 'brand' },
  'change.applied': { label: 'Modification écrite', tone: 'brand' },
  'change.unchanged': { label: 'Déjà en place', tone: 'neutral' },
  'change.failed': { label: 'Écriture échouée', tone: 'down' },
  'change.verified': { label: 'Vérifiée en ligne', tone: 'up' },
  'change.unverified': { label: 'Pas encore visible en ligne', tone: 'warn' },
  'change.reverted': { label: 'Annulée (retour à l’avant)', tone: 'neutral' },
  'change.revert_failed': { label: 'Annulation échouée', tone: 'down' },
  applied: { label: 'Appliquée', tone: 'brand' },
  verified: { label: 'Appliquée et vérifiée', tone: 'up' },
  reverted: { label: 'Annulée', tone: 'neutral' },
  'remeasure.scheduled': { label: 'Remesure programmée', tone: 'neutral' },
  'connection.added': { label: 'Plateforme connectée', tone: 'brand' },
  'connection.tested': { label: 'Connexion testée', tone: 'neutral' },
  'connection.removed': { label: 'Plateforme déconnectée', tone: 'neutral' },
};

// ---------------------------------------------------------------------------
// Centre d'actions → agent
// ---------------------------------------------------------------------------
const TASK_AGENT: Partial<Record<TaskKind, ChangeKind>> = {
  schema: 'jsonld',
  faq_page: 'faq',
  fact_fix: 'jsonld',
};

/** Type de correction que l'agent sait faire pour une action du Centre d'actions (null : pas d'autoFix). */
export function agentKindForTask(kind: TaskKind): ChangeKind | null {
  return TASK_AGENT[kind] ?? null;
}

/**
 * Compte réel : relie chaque action du Centre d'actions corrigeable par l'agent à la proposition ouverte la plus
 * récente qui contient ce type de modification (les actions viennent du moteur IA, les propositions des constats :
 * le lien se fait par type, comme en démo). Les propositions terminées ou annulées ne sont pas reliées.
 */
export function linkTasksToChangeSets(tasks: { id: string; kind: TaskKind }[], changeSets: Pick<ChangeSet, 'id' | 'status' | 'changes' | 'createdAt'>[]): Record<string, string> {
  const open = changeSets
    .filter((c) => c.status === 'draft' || c.status === 'proposed' || c.status === 'validated' || c.status === 'partially_applied' || c.status === 'failed')
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const out: Record<string, string> = {};
  for (const t of tasks) {
    const k = agentKindForTask(t.kind);
    if (!k) continue;
    const cs = open.find((c) => c.changes.some((ch) => ch.kind === k));
    if (cs) out[t.id] = cs.id;
  }
  return out;
}

export function agentHrefForTask(taskId: string): string {
  return `/app/agent?tache=${encodeURIComponent(taskId)}`;
}

// ---------------------------------------------------------------------------
// Réglages de l'agent
// ---------------------------------------------------------------------------
export type Frequency = 'weekly' | 'monthly' | 'manual';
export type NotifyChannel = 'email' | 'app' | 'off';

export interface AgentSettings {
  /** types de modification que l'agent a le droit de proposer */
  kinds: ChangeKind[];
  frequency: Frequency;
  notify: NotifyChannel;
  updatedAt?: string;
  updatedBy?: string;
}

/** Ce que l'agent peut proposer, regroupé par risque (les fiches Google arriveront avec l'accès API). */
export const SETTINGS_KINDS: { risk: Risk; kinds: ChangeKind[] }[] = [
  { risk: 'low', kinds: ['meta.title', 'meta.description', 'image.alt', 'llms.txt'] },
  { risk: 'medium', kinds: ['jsonld', 'faq', 'rewrite', 'sitemap.xml'] },
  { risk: 'high', kinds: ['robots.txt', 'redirect', 'canonical', 'meta.robots'] },
];

export const DEFAULT_SETTINGS: AgentSettings = {
  kinds: ['meta.title', 'meta.description', 'image.alt', 'llms.txt', 'jsonld', 'faq', 'rewrite', 'sitemap.xml', 'robots.txt'],
  frequency: 'weekly',
  notify: 'email',
};

const ALL_SETTING_KINDS = new Set<string>(SETTINGS_KINDS.flatMap((g) => g.kinds));

export function sanitizeSettings(v: unknown): AgentSettings {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  const kinds = Array.isArray(o.kinds) ? [...new Set(o.kinds.filter((k): k is ChangeKind => typeof k === 'string' && ALL_SETTING_KINDS.has(k)))] : DEFAULT_SETTINGS.kinds;
  const frequency: Frequency = o.frequency === 'monthly' || o.frequency === 'manual' || o.frequency === 'weekly' ? o.frequency : DEFAULT_SETTINGS.frequency;
  const notify: NotifyChannel = o.notify === 'app' || o.notify === 'off' || o.notify === 'email' ? o.notify : DEFAULT_SETTINGS.notify;
  return {
    kinds,
    frequency,
    notify,
    ...(typeof o.updatedAt === 'string' ? { updatedAt: o.updatedAt } : {}),
    ...(typeof o.updatedBy === 'string' ? { updatedBy: o.updatedBy.slice(0, 200) } : {}),
  };
}

// ---------------------------------------------------------------------------
// Démo : simulation côté interface (aucun appel serveur, lecture seule côté serveur)
// ---------------------------------------------------------------------------
export const DEMO_ACTOR = { id: 'demo', role: 'owner' } as const;

function clone(cs: ChangeSet): ChangeSet {
  return JSON.parse(JSON.stringify(cs)) as ChangeSet;
}

export function simEdit(cs: ChangeSet, changeId: string, value: string, now: Date): ChangeSet {
  const n = clone(cs);
  const ch = n.changes.find((c) => c.id === changeId);
  if (!ch) return cs;
  ch.after = value;
  ch.patch = { ...ch.patch, value };
  ch.generatedBy = 'user';
  if (n.status === 'validated') {
    n.status = 'proposed';
    delete n.validation;
  }
  n.updatedAt = now.toISOString();
  n.version += 1;
  return n;
}

export function simValidate(cs: ChangeSet, excluded: ReadonlySet<string>, now: Date, note?: string): ChangeSet {
  if (cs.status !== 'proposed' || blockers(cs, excluded).length) return cs;
  const n = clone(cs);
  for (const c of n.changes) if (excluded.has(c.id)) c.status = 'skipped';
  n.status = 'validated';
  n.validation = { by: { ...DEMO_ACTOR }, at: now.toISOString(), ...(note ? { note } : {}) };
  n.updatedAt = now.toISOString();
  n.version += 1;
  return n;
}

export function simReject(cs: ChangeSet, now: Date): ChangeSet {
  const n = clone(cs);
  n.status = 'rejected';
  n.rejection = { by: { ...DEMO_ACTOR }, at: now.toISOString() };
  n.updatedAt = now.toISOString();
  return n;
}

export function simApply(cs: ChangeSet, now: Date): ChangeSet {
  if (cs.status !== 'validated') return cs;
  const n = clone(cs);
  const at = now.toISOString();
  for (const c of n.changes) {
    if (c.status === 'skipped') continue;
    c.status = 'verified';
    c.appliedAt = at;
    c.verification = [
      ...(n.platform === 'export' ? [] : [{ ok: true, method: 'api' as const, detail: `Simulation : relu chez ${PLATFORM_NAME[n.platform]}, conforme.`, at }]),
      { ok: true, method: 'page' as const, detail: 'Simulation : page publique relue, modification visible.', at },
    ];
  }
  n.status = 'verified';
  n.appliedAt = at;
  n.verifiedAt = at;
  n.updatedAt = at;
  n.version += 1;
  return n;
}

export function simRevert(cs: ChangeSet, now: Date): ChangeSet {
  if (!['applied', 'partially_applied', 'verified'].includes(cs.status)) return cs;
  const n = clone(cs);
  const at = now.toISOString();
  for (const c of n.changes) {
    if (c.status === 'applied' || c.status === 'verified') {
      c.status = 'reverted';
      c.revertedAt = at;
    }
  }
  n.status = 'reverted';
  n.revertedAt = at;
  n.updatedAt = at;
  n.version += 1;
  return n;
}

/** Entrées de journal simulées (démo) : même forme que le vrai journal, sans empreinte. */
export function simEntry(cs: Pick<ChangeSet, 'id' | 'businessId'>, action: JournalAction, now: Date, extra: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: `${cs.id}.sim.${now.getTime()}.${action}`,
    businessId: cs.businessId,
    subject: cs.id,
    seq: 0,
    at: now.toISOString(),
    actor: { ...DEMO_ACTOR },
    action,
    prevHash: 'simulation',
    hash: 'simulation',
    ...extra,
  };
}

/** Ordre de la liste : à valider d'abord, puis validées, puis le reste (le plus récent d'abord). */
const ORDER: Record<ChangeSetStatus, number> = { proposed: 0, draft: 1, validated: 2, failed: 3, partially_applied: 4, applying: 5, applied: 6, verified: 7, reverted: 8, rejected: 9 };

export function sortChangeSets(list: ChangeSet[]): ChangeSet[] {
  return [...list].sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.createdAt.localeCompare(a.createdAt));
}

export const OPEN_STATUSES: ChangeSetStatus[] = ['draft', 'proposed', 'validated', 'applying', 'partially_applied', 'failed', 'applied'];
export const isOpen = (cs: Pick<ChangeSet, 'status'>) => OPEN_STATUSES.includes(cs.status);
