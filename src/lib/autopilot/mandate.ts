/**
 * Pilote automatique (V10, PILOTE-AUTO) — le mandat de publication.
 *
 * Garde-fou central : l'accord du client reste obligatoire, mais il est donné UNE FOIS, par écrit, à l'inscription :
 * un mandat explicite, catégorie par catégorie, révocable à tout moment. Ensuite Repéré applique sans redemander,
 * prévient après coup avec une annulation en un clic, et ne touche jamais à ce que le mandat n'autorise pas.
 *
 * Ce fichier est PUR (texte, catégories, empreinte) : importable côté navigateur. Le stockage est dans store.ts.
 * Texte du mandat : modèle rédigé par Repéré, À RELIRE PAR UN AVOCAT avant la mise en vente.
 */
import type { ChangeKind } from '@/lib/publish/types';

/** Version du texte : change à chaque modification du texte (la preuve garde la version signée). */
export const MANDATE_VERSION = 'mandat-pilote-v1-2026-11-23';
export const MANDATE_REVIEW_NOTE = 'Modèle rédigé par Repéré, à relire par un avocat avant la mise en vente.';

/** Délai de relecture d'un contenu (page ou article) avant sa mise en ligne automatique. */
export const CONTENT_REVIEW_HOURS = 72;
/** Baisse d'un score SEO ou GEO (points sur 100) au-delà de laquelle le pilote s'arrête seul. */
export const SCORE_DROP_MARGIN = 5;
/** Séries de corrections appliquées au plus par passage (le plafond mensuel de l'offre s'applique en plus). */
export const MAX_SERIES_PER_RUN = 5;

export const MANDATE_CATEGORIES = ['titres', 'descriptions', 'alt', 'donnees_structurees', 'llms', 'robots_ia', 'redirections', 'contenus'] as const;
export type MandateCategory = (typeof MANDATE_CATEGORIES)[number];
export const isMandateCategory = (v: unknown): v is MandateCategory => typeof v === 'string' && (MANDATE_CATEGORIES as readonly string[]).includes(v);

export interface CategoryDef {
  id: MandateCategory;
  label: string;
  /** ce que Repéré fait, en une phrase */
  help: string;
  /** types de modification de l'agent de publication couverts (vide : contenus de l'agent de contenu) */
  kinds: readonly ChangeKind[];
  /** coché par défaut (défauts prudents : ce qui est bénin et se défait à l'identique) */
  byDefault: boolean;
  /** exclue pour un métier réglementé (src/lib/regulated.ts) : textes juridiques ou médicaux jamais écrits seuls */
  textual: boolean;
}

export const CATEGORY_DEFS: readonly CategoryDef[] = [
  { id: 'titres', label: 'Titres des pages', help: 'Le titre affiché dans Google et les IA, réécrit avec vos faits quand il manque, est trop long ou en double.', kinds: ['meta.title'], byDefault: true, textual: true },
  { id: 'descriptions', label: 'Descriptions des pages', help: 'Le court texte sous le titre dans Google, rédigé à partir du contenu de la page.', kinds: ['meta.description'], byDefault: true, textual: true },
  { id: 'alt', label: 'Textes alternatifs des images', help: 'La description des images pour Google, les IA et les lecteurs d’écran.', kinds: ['image.alt'], byDefault: true, textual: false },
  { id: 'donnees_structurees', label: 'Données structurées issues de votre fiche officielle', help: 'Le balisage (nom, adresse, horaires, téléphone…) lu par Google et les IA, seulement avec les faits de votre fiche officielle confirmée. Jamais de prix ni d’avis.', kinds: ['jsonld'], byDefault: true, textual: false },
  { id: 'llms', label: 'Fichier llms.txt', help: 'Le résumé de votre site destiné aux IA, construit avec vos pages et votre fiche.', kinds: ['llms.txt'], byDefault: true, textual: false },
  { id: 'robots_ia', label: 'robots.txt : accès des robots d’IA', help: 'Autoriser les robots des IA (GPTBot, ClaudeBot, PerplexityBot…) à lire votre site. Le reste du fichier n’est jamais modifié.', kinds: ['robots.txt'], byDefault: false, textual: false },
  { id: 'redirections', label: 'Redirections 301 des pages cassées', help: 'Une adresse en erreur 404 liée depuis votre site est redirigée vers la page la plus proche. Jamais une page qui fonctionne.', kinds: ['redirect'], byDefault: false, textual: false },
  { id: 'contenus', label: 'Pages et articles de l’agent de contenu', help: `Seulement si tous les faits viennent de votre fiche officielle confirmée et que tous les contrôles passent. Créés en brouillon chez vous, mis en ligne après ${CONTENT_REVIEW_HOURS} h si vous ne les bloquez pas.`, kinds: [], byDefault: true, textual: true },
];

export const DEFAULT_CATEGORIES: MandateCategory[] = CATEGORY_DEFS.filter((c) => c.byDefault).map((c) => c.id);

/** Ce que le pilote ne fait JAMAIS, quel que soit le mandat (affiché tel quel dans l'app, sur le site et dans les CGV). */
export const NEVER_DONE: readonly string[] = [
  'supprimer une page, un produit ou un article',
  'modifier un prix, une promotion ou une condition de vente',
  'modifier vos mentions légales, CGV, politique de confidentialité ou tout autre texte juridique',
  'écrire, modifier ou répondre à des avis clients, ou baliser des avis',
  'rédiger un texte juridique, médical ou de santé (métiers réglementés : jamais de texte écrit seul)',
  'changer les consignes d’indexation (noindex, canonique), le plan du site ou votre fiche Google',
  'réécrire un passage d’une page existante (cela reste soumis à votre validation, une par une)',
  'dépasser les plafonds mensuels de votre offre',
];

/** Catégories permises pour une activité (réglementée : rien de rédactionnel). */
export function allowedCategories(regulated: boolean): MandateCategory[] {
  return CATEGORY_DEFS.filter((c) => !(regulated && c.textual)).map((c) => c.id);
}

/** Nettoie une liste de catégories (inconnues, doublons, interdites pour l'activité). Ordre de CATEGORY_DEFS. */
export function sanitizeCategories(input: unknown, regulated = false): MandateCategory[] {
  const allowed = new Set(allowedCategories(regulated));
  const set = new Set(Array.isArray(input) ? input.filter(isMandateCategory) : []);
  return MANDATE_CATEGORIES.filter((c) => set.has(c) && allowed.has(c));
}

/** Types de modification autorisés par un mandat. */
export function mandateKinds(categories: readonly MandateCategory[]): ChangeKind[] {
  return [...new Set(CATEGORY_DEFS.filter((c) => categories.includes(c.id)).flatMap((c) => c.kinds))];
}

/** Catégorie d'un type de modification (null : jamais couvert par un mandat). */
export function categoryOfKind(kind: ChangeKind): MandateCategory | null {
  return CATEGORY_DEFS.find((c) => c.kinds.includes(kind))?.id ?? null;
}

const frDateTime = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' });

/**
 * Texte exact signé (sa empreinte SHA-256 est la preuve). Il cite l'entreprise, le site, les catégories cochées, les
 * interdits, les plafonds, l'annulation et la révocation. Toute modification des catégories = nouveau mandat signé.
 */
export function mandateText(o: { businessName: string; site: string; categories: readonly MandateCategory[]; signerEmail: string; at: string; limits: { series: number; contents: number } }): string {
  const cats = CATEGORY_DEFS.filter((c) => o.categories.includes(c.id));
  const lines = [
    `MANDAT DE PUBLICATION « PILOTE AUTOMATIQUE » — version ${MANDATE_VERSION}`,
    `(${MANDATE_REVIEW_NOTE})`,
    '',
    `Entreprise : ${o.businessName}`,
    `Site concerné : ${o.site || 'non renseigné'}`,
    `Signataire : ${o.signerEmail}, qui déclare être habilité à engager l’entreprise pour ce site.`,
    `Date : ${frDateTime(o.at)} (heure de Paris, horodatage du serveur de Repéré).`,
    '',
    '1. Objet. L’entreprise autorise Repéré à appliquer elle-même, sur le site ci-dessus et au moyen de la connexion que l’entreprise a fournie, les modifications des catégories suivantes, sans lui redemander son accord à chaque fois :',
    ...cats.map((c) => `   - ${c.label} : ${c.help}`),
    '',
    `2. Contenus. Une page ou un article n’est créé que si tous ses faits viennent de la fiche officielle confirmée par l’entreprise, sans « [à compléter] », et si tous les contrôles de Repéré passent. Il est d’abord créé en brouillon (non visible du public), puis mis en ligne après ${CONTENT_REVIEW_HOURS} heures si l’entreprise ne l’a pas bloqué (lien dans l’e-mail ou dans l’application).`,
    '',
    '3. Ce que Repéré ne fait jamais, même avec ce mandat :',
    ...NEVER_DONE.map((n) => `   - ${n} ;`),
    '',
    `4. Plafonds. Au plus ${o.limits.series} séries de corrections et ${o.limits.contents} contenus par mois (plafonds de l’offre).`,
    '',
    '5. Information et annulation. Chaque modification est journalisée (valeur avant, valeur après, date) dans un journal infalsifiable. L’entreprise est prévenue après coup ; chaque série peut être annulée en un clic, Repéré remettant alors la valeur d’avant à l’identique. Un récapitulatif est envoyé chaque semaine.',
    '',
    `6. Arrêt automatique. Si, après une série de modifications, un score SEO ou GEO du site baisse de plus de ${SCORE_DROP_MARGIN} points, le pilote s’arrête seul, prévient l’entreprise et lui propose le retour arrière. Il ne reprend qu’avec son accord.`,
    '',
    '7. Durée, pause et révocation. Le mandat vaut tant que l’abonnement Pilote automatique est actif. L’entreprise peut le mettre en pause, en modifier les catégories ou le révoquer à tout moment, en un clic, sans frais ; la révocation prend effet immédiatement et n’annule pas les modifications déjà faites (qui restent annulables une par une).',
    '',
    '8. Aucune promesse de résultat. Repéré s’engage sur le travail fait et sur une mesure honnête, pas sur une position dans Google ni sur une citation par une IA.',
  ];
  return lines.join('\n');
}

export interface MandateSigner {
  userId: string;
  email: string;
}

export interface MandateProof {
  version: string;
  /** SHA-256 (hex) du texte exact signé */
  textHash: string;
  /** horodatage SERVEUR (jamais celui du navigateur) */
  serverAt: string;
  /** empreinte de l'adresse IP (jamais l'adresse en clair) */
  ipHash?: string;
  userAgent?: string;
}

export type MandateStatus = 'active' | 'paused' | 'revoked';

export interface Mandate {
  id: string;
  businessId: string;
  categories: MandateCategory[];
  status: MandateStatus;
  signedAt: string;
  signedBy: MandateSigner;
  proof: MandateProof;
  /** texte exact signé (conservé avec la preuve) */
  text: string;
  pausedAt?: string;
  /** client : pause demandée ; guard : arrêt automatique (baisse de score) */
  pauseReason?: 'client' | 'guard';
  pauseDetail?: string;
  revokedAt?: string;
  updatedAt: string;
}

/** Acteur des écritures faites sous mandat (jamais une personne : la validation est celle du mandat signé). */
export interface MandateActor {
  id: string;
  email?: string;
  role: 'mandate';
}

export function mandateActor(m: Pick<Mandate, 'id' | 'signedBy'>): MandateActor {
  return { id: `mandat:${m.id}`, email: m.signedBy.email, role: 'mandate' };
}

export function isMandateActor(a: { id?: string; role?: string } | null | undefined): boolean {
  return !!a && a.role === 'mandate' && typeof a.id === 'string' && /^mandat:mdt_[A-Za-z0-9_-]{6,40}$/.test(a.id);
}

/** Le mandat permet-il d'agir maintenant, pour cette catégorie ? */
export function mandateAllows(m: Pick<Mandate, 'status' | 'categories'> | null | undefined, category: MandateCategory): boolean {
  return !!m && m.status === 'active' && m.categories.includes(category);
}
