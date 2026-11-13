/**
 * Orchestration côté serveur des fonctions LOCAL (utilisée par les routes /api/local/*).
 */
import type { Business } from '@/lib/db';
import { getEntitlements } from '@/lib/entitlements';
import { getFacts } from '@/lib/facts';
import { HttpError, type LocalTier, localTier } from './auth';
import { directoriesFor } from './directories';
import { auditGbp, profileFromManual } from './gbp';
import { MAP_CAPS, planMap, runVisibilityMap } from './map';
import { auditNap, type NapReference, type PageFetcher } from './nap';
import { fetchPlaceDetails, PLACE_ID_RE, placesEnabled, profileFromPlaces, reviewsFromPlaces } from './places';
import type { GbpAudit, ManualGbpInput, NapAudit, NapEntryInput, ReviewText, ReviewThemesReport, VisibilityMap } from './types';
import { analyzeReviewThemesAsync } from './reviews';
import { mapsThisMonth } from './repo';

type Biz = Business & { contactEmail?: string; isActive?: boolean };

export async function factsOf(b: Pick<Business, 'id'>) {
  return (await getFacts(b.id)).facts ?? {};
}

export interface GbpRunResult {
  audit: GbpAudit;
  /** avis renvoyés par Places (en mémoire seulement), pour l'analyse de thèmes dans la même requête */
  placesReviews?: ReviewText[];
  warning?: string;
}

/** Audit de fiche : Places si clé + place_id, sinon saisie guidée. */
export async function runGbpAudit(b: Biz, input: { placeId?: string; manual?: ManualGbpInput }, deps: { fetchImpl?: typeof fetch; now?: Date } = {}): Promise<GbpRunResult> {
  const now = deps.now ?? new Date();
  const facts = await factsOf(b);
  const ctx = { businessId: b.id, businessName: b.name, trade: b.trade, facts, now };
  let warning: string | undefined;
  if (input.placeId && PLACE_ID_RE.test(input.placeId) && placesEnabled()) {
    try {
      const raw = await fetchPlaceDetails(input.placeId, { fetchImpl: deps.fetchImpl });
      const fromPlaces = profileFromPlaces(raw, input.placeId);
      // La saisie guidée complète ce que Places ne lit pas (description, services, posts, taux de réponse).
      const m = input.manual ? profileFromManual(input.manual, now) : null;
      const merged = m ? { ...fromPlaces, ...Object.fromEntries(Object.entries(m).filter(([k, v]) => v !== undefined && (fromPlaces as unknown as Record<string, unknown>)[k] === undefined && k !== 'source')) } : fromPlaces;
      return { audit: auditGbp(merged, ctx), placesReviews: reviewsFromPlaces(raw) };
    } catch (e) {
      console.warn('[local/gbp] Places indisponible :', (e as Error).message);
      warning = 'La lecture de la fiche par l’API Google a échoué : audit calculé sur votre saisie guidée.';
    }
  } else if (input.placeId && !placesEnabled()) {
    warning = 'Lecture automatique de la fiche non configurée : audit calculé sur votre saisie guidée.';
  }
  return { audit: auditGbp(profileFromManual(input.manual ?? {}, now), ctx), ...(warning ? { warning } : {}) };
}

/** Carte de visibilité : plafonds de l'offre + nombre de cartes par mois. */
export async function runMapFor(
  b: Biz,
  body: { questions?: unknown; zones?: number; providers?: string[]; district?: string },
  deps: { now?: Date; signal?: AbortSignal; run?: Parameters<typeof runVisibilityMap>[2]['run']; forceMock?: boolean } = {},
): Promise<VisibilityMap> {
  const now = deps.now ?? new Date();
  const tier: LocalTier = localTier(b);
  const caps = MAP_CAPS[tier];
  const used = await mapsThisMonth(b.id, now);
  if (used >= caps.perMonth) {
    throw new HttpError(tier === 'decouverte' ? 402 : 429, tier === 'decouverte' ? 'Votre offre comprend 1 carte par mois. Passez à l’offre Essentiel pour en lancer davantage.' : `Votre offre comprend ${caps.perMonth} cartes par mois : vous les avez utilisées.`, tier === 'decouverte' ? 'upgrade_required' : 'quota_exceeded');
  }
  const engines = getEntitlements(b).engines;
  const district = typeof body.district === 'string' ? body.district.slice(0, 60) : b.district;
  const plan = planMap({ city: b.city, district, trade: b.trade }, tier, {
    engines,
    questions: body.questions,
    zones: typeof body.zones === 'number' ? body.zones : undefined,
    providers: Array.isArray(body.providers) ? (body.providers.filter((p) => engines.includes(p as never)) as typeof engines) : undefined,
  });
  const budgetEur = Number(process.env.LOCAL_MAP_BUDGET_EUR) > 0 ? Math.min(Number(process.env.LOCAL_MAP_BUDGET_EUR), caps.budgetEur * 2) : caps.budgetEur;
  const { map } = await runVisibilityMap({ businessId: b.id, businessName: b.name, trade: b.trade, city: b.city, district, website: b.website }, plan, { budgetEur, now, signal: deps.signal, run: deps.run, forceMock: deps.forceMock });
  return map;
}

export async function runNapFor(b: Biz, entries: NapEntryInput[], opts: { verify?: boolean; fetcher?: PageFetcher; now?: Date } = {}): Promise<NapAudit> {
  const facts = await factsOf(b);
  const ref: NapReference = { name: b.name, address: facts.adresse, phone: facts.telephone, website: facts.site ?? b.website };
  return auditNap(directoriesFor(b.trade, b.id), entries, ref, { businessId: b.id, verify: opts.verify, fetcher: opts.fetcher, now: opts.now });
}

export async function themesFor(b: Biz, reviews: ReviewText[], source: ReviewThemesReport['source'], opts: { llm?: boolean; replies?: number } = {}): Promise<ReviewThemesReport> {
  const facts = await factsOf(b);
  return analyzeReviewThemesAsync(reviews, { businessId: b.id, businessName: b.name, contact: facts.telephone, source, llm: opts.llm, replies: opts.replies });
}
