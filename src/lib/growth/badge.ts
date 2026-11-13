import { getDoc, putDoc } from '@/lib/store';
import { SITE_URL } from '@/lib/seo/site';
import { BADGE_MAX_AGE_DAYS, COLLECTIONS } from './constants';
import { ageInDays, latestRealMeasure, monthYearFr } from './measure';
import { clampScore } from './score';

export interface BadgeSettings {
  businessId: string;
  enabled: boolean;
  /** Afficher la note /100 sur le badge (choix du client, désactivé par défaut). */
  showScore: boolean;
  updatedAt: string;
}

export type BadgeState = 'valid' | 'expired';

/** Pure : un badge est valable tant que la mesure réelle a moins de 45 jours. */
export function badgeState(measuredAt: string | null | undefined, now: Date = new Date()): BadgeState {
  if (!measuredAt) return 'expired';
  return ageInDays(measuredAt, now) < BADGE_MAX_AGE_DAYS ? 'valid' : 'expired';
}

export async function getBadgeSettings(businessId: string): Promise<BadgeSettings | null> {
  return (await getDoc<BadgeSettings>(COLLECTIONS.badges, businessId))?.data ?? null;
}

export async function setBadgeSettings(businessId: string, patch: { enabled: boolean; showScore?: boolean }): Promise<BadgeSettings> {
  const prev = await getBadgeSettings(businessId);
  const next: BadgeSettings = {
    businessId,
    enabled: patch.enabled,
    showScore: patch.showScore ?? prev?.showScore ?? false,
    updatedAt: new Date().toISOString(),
  };
  await putDoc(COLLECTIONS.badges, businessId, next, businessId);
  return next;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface BadgeView {
  state: BadgeState;
  measuredAt?: string;
  /** Présent seulement si le client l'a demandé ET que la mesure est valable. */
  score?: number;
}

/**
 * SVG du badge (320 × 72). Le texte ne parle jamais de recommandation par une IA nommée : seulement
 * « Visibilité IA mesurée par Repéré — mois année », ou « Mesure expirée ».
 */
export function renderBadgeSvg(v: BadgeView): string {
  const valid = v.state === 'valid' && !!v.measuredAt;
  const month = valid ? monthYearFr(v.measuredAt as string) : '';
  const line1 = valid ? 'Visibilité IA mesurée par Repéré' : 'Visibilité IA · Repéré';
  const line2 = valid ? month : 'Mesure expirée';
  const title = valid ? `Visibilité IA mesurée par Repéré — ${month}` : 'Visibilité IA : mesure expirée (Repéré)';
  const score = valid && typeof v.score === 'number' ? clampScore(v.score) : null;
  const accent = valid ? '#3730A3' : '#5A6275';
  const pill =
    score === null
      ? ''
      : `<rect x="236" y="20" width="72" height="32" rx="16" fill="#ECEBFA"/><text x="272" y="42" text-anchor="middle" font-size="18" font-weight="700" fill="#3730A3">${score}<tspan font-size="11" font-weight="500" fill="#5A6275">/100</tspan></text>`;
  // Avec la note, la colonne de texte s'arrête avant la pastille (x = 236) : 72 → 228, soit 156 px.
  // « Visibilité IA mesurée par Repéré » (≈ 210 px à 12 px) passe alors sur deux lignes, la date sur la troisième.
  const text =
    score === null
      ? `<text x="72" y="31" font-size="14" font-weight="600" fill="#1B1F2E">${esc(line1)}</text>
<text x="72" y="52" font-size="15" font-weight="${valid ? 500 : 700}" fill="${valid ? '#5A6275' : '#92400E'}">${esc(line2)}</text>`
      : `<text x="72" y="26" font-size="12" font-weight="600" fill="#1B1F2E">Visibilité IA</text>
<text x="72" y="41" font-size="12" font-weight="600" fill="#1B1F2E">mesurée par Repéré</text>
<text x="72" y="58" font-size="13" font-weight="500" fill="#5A6275">${esc(line2)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="72" viewBox="0 0 320 72" role="img" aria-label="${esc(title)}" font-family="Inter,Arial,Helvetica,sans-serif">
<title>${esc(title)}</title>
<rect x="1" y="1" width="318" height="70" rx="14" fill="#FFFFFF" stroke="#D5D9E4" stroke-width="2"/>
<g transform="translate(14 14) scale(0.703)"><rect width="64" height="64" rx="14" fill="${accent}"/><g fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M17 26V19a2 2 0 0 1 2-2h7"/><path d="M38 17h7a2 2 0 0 1 2 2v7"/><path d="M47 38v7a2 2 0 0 1-2 2h-7"/><path d="M26 47h-7a2 2 0 0 1-2-2v-7"/></g><circle cx="32" cy="32" r="7" fill="${valid ? '#F5A524' : '#D5D9E4'}"/></g>
${text}
${pill}
</svg>`;
}

/**
 * Vue publique du badge d'un commerce, ou null (404) s'il n'a pas activé le badge.
 * Mesure absente, simulée ou trop ancienne : « Mesure expirée », sans note.
 */
export async function badgeViewForBusiness(businessId: string, now: Date = new Date()): Promise<BadgeView | null> {
  const s = await getBadgeSettings(businessId);
  if (!s?.enabled) return null;
  const m = await latestRealMeasure(businessId);
  if (!m || badgeState(m.measuredAt, now) === 'expired') return { state: 'expired' };
  return { state: 'valid', measuredAt: m.measuredAt, ...(s.showScore ? { score: m.audit.score } : {}) };
}

/** Code d'intégration : lien sans nofollow (dofollow) vers la page publique du commerce. Aucune promesse de classement. */
export function embedCode(businessId: string, pageUrl: string): string {
  const img = `${SITE_URL}/badge/${encodeURIComponent(businessId)}.svg`;
  return `<a href="${esc(pageUrl)}" title="Visibilité IA mesurée par Repéré"><img src="${img}" alt="Visibilité IA mesurée par Repéré" width="320" height="72" loading="lazy"></a>`;
}
