/**
 * Démo EXÉCUTION : complète les audits démo avec des données V2 réalistes (si le moteur ne les fournit pas
 * encore) et amorce 8 à 12 tâches variées, dont 2 terminées, pour `demo`, `demo-pme`, `demo-ecom`.
 */
import type { CompetitorGap, FactCheckReport, Segment, SourceOpportunity } from '@/lib/engine/types-v2';
import { buildDemoWorkspaceById, isDemoBusinessId } from '@/lib/demo-v2';
import { generateTasks } from './tasks';
import { listStoredTasks, putTask, saveSettings, getSettings, TASKS_COLLECTION } from './repo';
import { deleteDoc, getDoc, putDoc } from '@/lib/store';

/** Version des gabarits démo : à incrémenter quand generateTasks change, pour régénérer les comptes démo. */
export const DEMO_EXEC_VERSION = '2026-11-10.amelio-donnees.1';
const DEMO_VERSION_COLLECTION = 'exec.demo_version';
import type { AuditV2, StoredTask } from './types';
import { addWeeks, isoMonday } from './util';

const opp = (domain: string, label: string, category: SourceOpportunity['category'], score: number, effort: 'S' | 'M' | 'L', impact: 1 | 2 | 3, why: string, competitorsPresent: string[]): SourceOpportunity => ({
  domain,
  label,
  category,
  score,
  why,
  action: '',
  howTo: [],
  effort,
  impact,
  competitorsPresent,
});

const DEMO_V2: Record<Segment, { opportunities: SourceOpportunity[]; gaps: CompetitorGap[]; error: FactCheckReport['items'][number] }> = {
  local: {
    opportunities: [
      opp('pagesjaunes.fr', 'PagesJaunes', 'annuaire', 82, 'S', 3, 'Cité dans 11 réponses sur 46 (24 %), par ChatGPT et Perplexity, pour « meilleur plombier Paris 11e ».', ['Dupont & Fils', 'SOS Plomberie Bastille']),
      opp('leparisien.fr', 'Le Parisien', 'media_local', 54, 'L', 2, 'Article « Les bons artisans du 11e » cité 4 fois par Perplexity.', ['Dupont & Fils']),
      opp('reddit.com', 'Reddit (r/paris)', 'forum', 41, 'M', 1, 'Fil « plombier honnête Paris ? » cité 3 fois par ChatGPT.', ['SOS Plomberie Bastille']),
    ],
    gaps: [{ competitor: 'Dupont & Fils', mentions: 9, share: 0.21, presentOn: ['pagesjaunes.fr', 'leparisien.fr'], reasons: ['Sa page « Recherche de fuite Paris 11 » est citée 5 fois.', '142 avis Google contre 38.'] }],
    error: { field: 'horaires', expected: 'Du lundi au vendredi 8 h – 19 h, samedi 9 h – 13 h ; urgences 7 j/7', stated: 'fermé le samedi', provider: 'chatgpt', quote: 'Plomberie Martin est ouvert du lundi au vendredi, fermé le samedi.', verdict: 'faux', severity: 'haute' },
  },
  pme: {
    opportunities: [
      opp('capterra.fr', 'Capterra', 'comparatif', 88, 'M', 3, 'Page « Meilleurs logiciels de paie » citée 14 fois sur 52 réponses.', ['Paylo', 'Netpaie', 'Salaria']),
      opp('appvizer.fr', 'Appvizer', 'comparatif', 71, 'M', 2, 'Comparatif « logiciel de paie PME » cité par ChatGPT et Perplexity.', ['Paylo', 'Clairpaie']),
      opp('lesechos.fr', 'Les Echos Entrepreneurs', 'media_national', 46, 'L', 2, 'Dossier « paie externalisée ou logiciel » cité 3 fois.', ['Paylo']),
      opp('reddit.com', 'Reddit (r/vosfinances)', 'forum', 38, 'M', 1, 'Fil « quel logiciel de paie pour 30 salariés » cité 2 fois.', ['Salaria']),
    ],
    gaps: [{ competitor: 'Paylo', mentions: 21, share: 0.34, presentOn: ['capterra.fr', 'appvizer.fr', 'lesechos.fr'], reasons: ['Présent sur 3 des 5 comparatifs les plus cités.', 'Page « Alternatives à Netpaie » citée par Perplexity.'] }],
    error: { field: 'prix', expected: 'À partir de 8 € HT par bulletin et par mois, sans frais de mise en place', stated: 'à partir de 15 € par salarié', provider: 'perplexity', quote: 'Paysia propose des tarifs à partir de 15 € par salarié et par mois.', verdict: 'faux', severity: 'haute' },
  },
  ecommerce: {
    opportunities: [
      opp('trustpilot.com', 'Trustpilot', 'avis', 76, 'M', 3, 'Avis cités pour « marque de shampoing solide fiable ».', ['Savonnerie Alba', 'Pain de Lune']),
      opp('marieclaire.fr', 'Marie Claire', 'media_national', 63, 'L', 2, 'Sélection « meilleurs shampoings solides » citée 6 fois.', ['Savonnerie Alba', 'Atelier Brume']),
      opp('reddit.com', 'Reddit (r/ZeroWasteFR)', 'forum', 44, 'M', 1, 'Fil « déodorant solide qui marche vraiment » cité 3 fois.', ['Pain de Lune']),
      opp('amazon.fr', 'Amazon', 'marketplace', 40, 'L', 2, 'Fiches produits concurrentes citées pour « déodorant solide ».', ['Pain de Lune']),
    ],
    gaps: [{ competitor: 'Savonnerie Alba', mentions: 17, share: 0.29, presentOn: ['marieclaire.fr', 'trustpilot.com'], reasons: ['Cité dans 4 sélections presse.', 'Fiches produits avec composition détaillée et FAQ.'] }],
    error: { field: 'livraison', expected: 'France et Belgique ; offerte dès 39 € ; expédition sous 48 h', stated: 'livraison uniquement en France', provider: 'gemini', quote: 'Maison Sora livre uniquement en France métropolitaine.', verdict: 'faux', severity: 'moyenne' },
  },
};

/** Ajoute aux audits démo les données V2 manquantes (sources, écarts, erreur factuelle). */
export function withDemoV2(audit: AuditV2, segment: Segment): AuditV2 {
  const d = DEMO_V2[segment];
  const at = audit.measuredAt ?? audit.createdAt;
  return {
    ...audit,
    segment,
    sources:
      audit.sources?.opportunities?.length
        ? audit.sources
        : { totalCitations: 0, domains: [], byCategory: {}, opportunities: d.opportunities, clientCitedCount: 0, note: 'Données de démonstration' },
    gaps: audit.gaps?.length ? audit.gaps : d.gaps,
    factCheck: audit.factCheck?.items?.length ? audit.factCheck : { checkedAt: at, items: [d.error], errors: 1 },
  };
}

/** Contrat : amorce les tâches d'un compte démo (idempotent ; `force` pour réinitialiser). */
export async function seedDemoExec(businessId: string, opts: { force?: boolean; now?: Date } = {}): Promise<StoredTask[]> {
  if (!isDemoBusinessId(businessId)) return [];
  const existing = await listStoredTasks(businessId);
  // Les comptes démo sont en lecture seule : on les régénère quand les gabarits changent (version ci-dessous).
  const version = await getDoc<{ v: string }>(DEMO_VERSION_COLLECTION, businessId);
  if (existing.length && !opts.force && version?.data.v === DEMO_EXEC_VERSION) return existing;
  for (const t of existing) await deleteDoc(TASKS_COLLECTION, t.id).catch(() => undefined);
  const ws = buildDemoWorkspaceById(businessId);
  if (!ws) return [];
  const segment = ws.business.segment;
  const prevSettings = await getSettings(businessId, ws.business.name);
  const settings = await saveSettings(businessId, { ...prevSettings, segment });
  const audit = withDemoV2(ws.audits[ws.audits.length - 1] as AuditV2, segment);
  const now = opts.now ?? new Date();
  // E-commerce : fiches au niveau du PRODUIT (catalogue démo suivi), pas de la catégorie.
  const catalog = segment === 'ecommerce' ? (await import('@/lib/ecommerce/demo')).DEMO_PRODUCTS : undefined;
  const tasks = generateTasks(audit, ws.facts, { businessId, segment, settings, now, max: 12, catalog });
  // 2 tâches terminées la semaine dernière (les plus rapides hors erreur factuelle), le reste à faire.
  const lastWeek = addWeeks(isoMonday(now), -1);
  const doneIds = new Set(
    [...tasks]
      .filter((t) => t.kind !== 'fact_fix')
      .sort((a, b) => a.minutes - b.minutes)
      .slice(0, 2)
      .map((t) => t.id),
  );
  const doneAt = new Date(`${lastWeek}T10:00:00Z`);
  doneAt.setUTCDate(doneAt.getUTCDate() + 2);
  for (const t of tasks) {
    if (doneIds.has(t.id)) Object.assign(t, { status: 'done', week: lastWeek, doneAt: doneAt.toISOString() });
    await putTask(t);
  }
  await putDoc(DEMO_VERSION_COLLECTION, businessId, { v: DEMO_EXEC_VERSION }, businessId);
  return tasks;
}
