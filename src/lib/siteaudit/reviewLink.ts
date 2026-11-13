/**
 * Lien d'avis Google + QR code (outil gratuit). Réutilise `reviewKit` du module d'exécution.
 * Sans clé Places, nous ne pouvons pas retrouver le Place ID à partir d'un nom : nous le disons et guidons.
 */
import { googleReviewUrl, reviewKit } from '@/lib/execution/reviews';
import type { ReviewKit } from '@/lib/execution/types';

export const PLACE_ID_FINDER = 'https://developers.google.com/maps/documentation/places/web-service/place-id';

export const REVIEW_LINK_NOTE =
  'Vos avis pèsent dans ce que les IA disent de vous (corrélation observée, pas garantie). Demandez un avis à tous vos clients, sans tri ni contrepartie.';

/** Extrait un Place ID d'une saisie : Place ID brut ou lien Google Maps qui le contient. */
export function extractPlaceId(input: string | undefined | null): string | null {
  const s = (input ?? '').trim();
  if (!s) return null;
  const inUrl = /(?:place_id[:=]|query_place_id=|placeid=)([A-Za-z0-9_-]{10,300})/i.exec(s);
  if (inUrl) return inUrl[1];
  const chij = /\b(ChIJ[A-Za-z0-9_-]{10,300})\b/.exec(s);
  if (chij) return chij[1];
  return /^[A-Za-z0-9_-]{10,300}$/.test(s) && !/^\d+$/.test(s) ? s : null;
}

export interface ReviewLinkInput {
  placeId?: string;
  name?: string;
  city?: string;
  /** Couleur du QR (#RRGGBB). */
  color?: string;
}

export interface ReviewLinkResult {
  placeId: string | null;
  reviewUrl: string | null;
  qrSvg: string | null;
  qrServiceUrl: string | null;
  kit: ReviewKit;
  /** Recherche Google Maps pour retrouver la fiche quand le Place ID est inconnu. */
  mapsSearchUrl: string | null;
  placeIdFinderUrl: string;
  steps: string[];
  limit: string | null;
  note: string;
}

export function buildReviewLink(input: ReviewLinkInput): ReviewLinkResult {
  const placeId = extractPlaceId(input.placeId);
  const name = (input.name ?? '').trim().slice(0, 120) || 'votre établissement';
  const color = input.color && /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : undefined;
  const kit = reviewKit({ name }, { placeId: placeId ?? undefined, brandColor: color });
  const query = [input.name, input.city].filter((x) => x && x.trim()).join(' ').trim();
  const reviewUrl = placeId ? googleReviewUrl(placeId) : null;
  return {
    placeId,
    reviewUrl,
    qrSvg: kit.qrSvg,
    qrServiceUrl: kit.qrServiceUrl,
    kit,
    mapsSearchUrl: query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null,
    placeIdFinderUrl: PLACE_ID_FINDER,
    steps: reviewUrl
      ? ['Copiez le lien dans vos e-mails, SMS et factures.', 'Imprimez le QR code (affiche en caisse, carte de visite).', 'Demandez un avis à tous vos clients, satisfaits ou non.']
      : [
          'Ouvrez l’outil officiel « Place ID Finder » de Google (lien ci-dessous).',
          'Tapez le nom de votre établissement et choisissez-le dans la liste.',
          'Copiez le Place ID affiché (il commence souvent par « ChIJ ») et collez-le ici.',
        ],
    limit: reviewUrl ? null : 'Sans clé d’API Google Places, nous ne pouvons pas retrouver votre fiche à partir de son nom : le Place ID se récupère en une minute avec l’outil officiel de Google.',
    note: REVIEW_LINK_NOTE,
  };
}
