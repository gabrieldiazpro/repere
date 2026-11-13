import { getSettings, hostedPageUrl } from '@/lib/execution';
import { getBusinessRecord } from '@/lib/db';

/** Page publique du commerce (/p/slug), ou null si elle n'est pas publiée (pas de lien vers rien). */
export async function publicPageUrl(businessId: string): Promise<string | null> {
  const b = await getBusinessRecord(businessId);
  if (!b) return null;
  const s = await getSettings(businessId, b.name).catch(() => null);
  if (!s || s.published === false || !s.slug) return null;
  return hostedPageUrl(s.slug);
}
