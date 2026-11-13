/**
 * GET  /api/local/reviews?businessId=…  → { ok, data: { report } } (dernière analyse)
 * POST /api/local/reviews { businessId, reviews: [{ text, rating? }] | "texte collé", fromPlaces?, llm?, replies? }
 *   → { ok, data: { report } } : thèmes positifs/négatifs par règles (+ synthèse LLM en option), brouillons de
 *   réponse (draftReviewReply). `fromPlaces` : 5 avis via l'API Places si clé et place_id connus, jamais stockés.
 */
import { buildLocalDemo, fetchPlaceDetails, parseReviews, placesEnabled, reviewsFromPlaces } from '@/lib/local';
import { errorResponse, HttpError } from '@/lib/local/auth';
import { access, businessIdFrom, limit, ok, readJson } from '@/lib/local/http';
import { assertEntitled, getEntitlements } from '@/lib/entitlements';
import { getLocalSettings, latestThemes, saveThemes } from '@/lib/local/repo';
import { themesFor } from '@/lib/local/service';
import type { ReviewText } from '@/lib/local/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const businessId = businessIdFrom(new URL(req.url).searchParams.get('businessId'));
    const { demo } = await access(req, businessId, 'read');
    if (demo) return ok({ report: (await buildLocalDemo(businessId))?.themes ?? null }, { demo: true });
    return ok({ report: await latestThemes(businessId) });
  } catch (e) {
    return errorResponse(e, 'reviews');
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const businessId = businessIdFrom(body.businessId);
    const { business, demo } = await access(req, businessId, 'compute');
    const replies = typeof body.replies === 'number' ? body.replies : 5;
    let reviews: ReviewText[] = parseReviews(body.reviews);
    let source: 'pasted' | 'places' = 'pasted';
    if (!reviews.length && body.fromPlaces === true && !demo) {
      const placeId = (await getLocalSettings(businessId)).placeId;
      if (!placeId || !placesEnabled()) throw new HttpError(400, 'Lecture des avis Google non disponible : collez vos avis.');
      await limit(req, 'reviews', businessId, 10);
      reviews = reviewsFromPlaces(await fetchPlaceDetails(placeId));
      source = 'places';
    }
    if (!reviews.length) throw new HttpError(400, 'Collez au moins un avis.');
    const llm = body.llm === true && !demo;
    if (llm) assertEntitled(getEntitlements(business), 'execution'); // rédaction LLM : offre Essentiel et plus
    if (llm) await limit(req, 'reviews-llm', businessId, 10);
    const report = await themesFor(business, reviews, demo ? 'demo' : source, { llm, replies });
    if (demo) return ok({ report, saved: false }, { demo: true });
    await saveThemes(report);
    return ok({ report, saved: true });
  } catch (e) {
    return errorResponse(e, 'reviews');
  }
}
