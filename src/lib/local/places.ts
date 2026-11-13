/**
 * Client minimal de l'API Places (New) — Place Details, activé seulement si `GOOGLE_PLACES_KEY` est présente.
 *
 * RÈGLES DE STOCKAGE (vérifiées le 9 novembre 2026, voir PLACES_POLICY) :
 * - le place_id est stockable sans limite de durée ;
 * - latitude/longitude : cache de 30 jours maximum (nous ne les demandons pas) ;
 * - tout autre contenu (nom, adresse, téléphone, note, nombre d'avis, avis, photos, horaires) : ni pré-collecte,
 *   ni cache, ni stockage. Il n'est utilisé qu'en mémoire, le temps de calculer l'audit et de répondre ;
 * - nous stockons uniquement : le place_id, nos statuts et points par critère (calcul Repéré), la date du calcul.
 *   Les `detail` des critères qui reprennent du contenu Google sont remplacés avant stockage (voir `toStorableAudit`).
 * - les avis renvoyés (5 au maximum) servent à l'extraction de thèmes en mémoire ; s'ils sont affichés : auteur crédité,
 *   lien googleMapsUri, date de visite (`visitDate`) pour la France, mention de l'ordre (pertinence).
 * Zone grise signalée par le teardown (§ 3) : le « contenu dérivé ». Nos scores sont une évaluation de complétude,
 * pas une copie ; à faire valider par Google avant d'ouvrir l'historique de scores issus de Places.
 */
import type { GbpProfile, ReviewText } from './types';

export const PLACES_POLICY = {
  checkedAt: '2026-11-09',
  storable: ['place_id (sans limite)', 'latitude/longitude (30 jours maximum, non demandées ici)'],
  notStored: ['nom', 'adresse', 'téléphone', 'site', 'note', 'nombre d’avis', 'avis', 'photos', 'horaires', 'catégories'],
  weStore: ['place_id', 'scores et statuts par critère calculés par Repéré', 'date du calcul'],
  display: [
    'Afficher l’attribution Google à côté de toute donnée Places affichée.',
    'Avis : créditer l’auteur, lien vers l’avis sur Google Maps (googleMapsUri), date de visite pour les lieux en France, mention de l’ordre (pertinence).',
    'Résumés IA de Google : texte de divulgation (disclosureText) affiché tel quel.',
  ],
  limits: ['5 avis au maximum par fiche', '10 photos au maximum par fiche', 'pas de posts, pas de description du propriétaire, pas de taux de réponse aux avis'],
  pricing:
    'Facturation par SKU depuis le 1er mars 2025 (plus de crédit mensuel de 200 $) : gratuité mensuelle par SKU de 10 000 appels (Essentials), 5 000 (Pro), 1 000 (Enterprise). Note, nombre d’avis, horaires, site et téléphone relèvent du SKU Enterprise ; avis, résumé éditorial et options de paiement / stationnement du SKU Enterprise + Atmosphere.',
  sources: [
    'https://developers.google.com/maps/documentation/places/web-service/policies',
    'https://developers.google.com/maps/documentation/places/web-service/place-details',
    'https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places',
    'https://developers.google.com/maps/billing/overview/',
    'https://cloud.google.com/archive/maps-platform/terms/maps-service-terms-20260422',
  ],
} as const;

/** Champs demandés (masque obligatoire ; uniquement ce que l'audit utilise). */
export const PLACES_FIELD_MASK = [
  'id',
  'displayName',
  'primaryType',
  'primaryTypeDisplayName',
  'types',
  'formattedAddress',
  'nationalPhoneNumber',
  'websiteUri',
  'regularOpeningHours',
  'currentOpeningHours',
  'rating',
  'userRatingCount',
  'photos',
  'reviews',
  'accessibilityOptions',
  'paymentOptions',
  'parkingOptions',
  'googleMapsUri',
  'businessStatus',
].join(',');

export function placesEnabled(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_KEY) && !process.env.VITEST;
}

export const PLACE_ID_RE = /^[A-Za-z0-9_-]{10,300}$/;

/** Réponse brute (partielle) de Place Details (New). Jamais persistée. */
export interface PlaceDetailsRaw {
  id?: string;
  displayName?: { text?: string };
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[]; periods?: unknown[] };
  currentOpeningHours?: { specialDays?: unknown[] };
  rating?: number;
  userRatingCount?: number;
  photos?: { name?: string }[];
  reviews?: { rating?: number; text?: { text?: string }; originalText?: { text?: string }; publishTime?: string; authorAttribution?: { displayName?: string } }[];
  accessibilityOptions?: Record<string, boolean>;
  paymentOptions?: Record<string, boolean>;
  parkingOptions?: Record<string, boolean>;
  googleMapsUri?: string;
  businessStatus?: string;
}

const GENERIC_TYPES = new Set(['point_of_interest', 'establishment', 'store', 'service', 'food', 'health']);

/** Place Details (New). Lève en cas d'erreur (la route renvoie alors la saisie guidée). */
export async function fetchPlaceDetails(placeId: string, opts: { language?: string; fetchImpl?: typeof fetch } = {}): Promise<PlaceDetailsRaw> {
  const key = process.env.GOOGLE_PLACES_KEY;
  if (!key) throw new Error('GOOGLE_PLACES_KEY absente');
  if (!PLACE_ID_RE.test(placeId)) throw new Error('place_id invalide');
  const f = opts.fetchImpl ?? fetch;
  const res = await f(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=${opts.language ?? 'fr'}&regionCode=FR`, {
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': PLACES_FIELD_MASK },
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Places HTTP ${res.status}`);
  return (await res.json()) as PlaceDetailsRaw;
}

/**
 * Recherche du place_id par nom + ville (Text Search New, masque `places.id` seulement).
 * SKU « IDs Only » supposé gratuit : [non vérifié pour Text Search ; vérifié pour Place Details].
 */
export async function findPlaceId(query: string, opts: { fetchImpl?: typeof fetch } = {}): Promise<string | null> {
  const key = process.env.GOOGLE_PLACES_KEY;
  if (!key || !query.trim()) return null;
  const f = opts.fetchImpl ?? fetch;
  const res = await f('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id' },
    body: JSON.stringify({ textQuery: query.slice(0, 200), languageCode: 'fr', regionCode: 'FR', pageSize: 1 }),
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { places?: { id?: string }[] };
  return data.places?.[0]?.id ?? null;
}

/** Profil normalisé, en mémoire uniquement. Ce que Places ne fournit pas reste `undefined` (critère « non évalué »). */
export function profileFromPlaces(raw: PlaceDetailsRaw, placeId: string): GbpProfile {
  const types = (raw.types ?? []).filter((t) => !GENERIC_TYPES.has(t) && t !== raw.primaryType);
  const attrs = [raw.accessibilityOptions, raw.paymentOptions, raw.parkingOptions].reduce((n, o) => n + Object.values(o ?? {}).filter((v) => v === true).length, 0);
  const reviewDates = (raw.reviews ?? []).map((r) => r.publishTime).filter((d): d is string => Boolean(d)).sort();
  return {
    source: 'places',
    placeId,
    name: raw.displayName?.text,
    primaryCategory: raw.primaryTypeDisplayName?.text ?? raw.primaryType,
    secondaryCategories: types,
    descriptionLength: undefined, // description du propriétaire non exposée
    hasHours: raw.regularOpeningHours ? Boolean(raw.regularOpeningHours.periods?.length || raw.regularOpeningHours.weekdayDescriptions?.length) : false,
    hoursText: raw.regularOpeningHours?.weekdayDescriptions?.join(' ; '),
    // specialDays ne couvre que la fenêtre de 7 jours renvoyée : absence ≠ preuve d'absence
    hasSpecialHours: raw.currentOpeningHours?.specialDays?.length ? true : undefined,
    servicesCount: undefined,
    attributesCount: attrs,
    photosCount: raw.photos?.length ?? 0,
    lastPhotoAt: undefined,
    lastPostAt: undefined,
    website: raw.websiteUri,
    phone: raw.nationalPhoneNumber,
    address: raw.formattedAddress,
    reviewCount: raw.userRatingCount ?? 0,
    rating: raw.rating,
    lastReviewAt: reviewDates[reviewDates.length - 1],
    replyRate: undefined,
  };
}

/** Avis Places → texte pour l'analyse de thèmes (en mémoire, jamais stockés). */
export function reviewsFromPlaces(raw: PlaceDetailsRaw): ReviewText[] {
  return (raw.reviews ?? [])
    .map((r) => ({ rating: r.rating, text: r.originalText?.text ?? r.text?.text ?? '', date: r.publishTime }))
    .filter((r) => r.text.trim().length > 0);
}
