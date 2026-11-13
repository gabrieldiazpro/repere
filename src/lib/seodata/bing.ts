/**
 * Bing Webmaster Tools API (JSON, réponses sous `d`). La clé API appartient au CLIENT (générée dans son compte Bing
 * Webmaster Tools > Paramètres > Accès API) : elle est collée dans Repéré, vérifiée, puis CHIFFRÉE au repos
 * (`seodata.bing.conn`, src/lib/integrations). Gratuit. Dates « /Date(1399100400000)/ », semaines Bing.
 */
import { decryptSecret, encryptSecret } from '@/lib/integrations';
import { deleteDoc, getDoc, putDoc } from '@/lib/store';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { SeoDataError, endpoints, requestJson, sameSite } from './http';
import type { BingProvider, BingQueryRow } from './types';

export const BING_CONN = 'seodata.bing.conn';

/** « /Date(1399100400000)/ » ou « /Date(1399100400000-0700)/ » → AAAA-MM-JJ. */
export function msDate(v: unknown): string {
  const m = String(v ?? '').match(/Date\((-?\d+)/);
  return m ? new Date(Number(m[1])).toISOString().slice(0, 10) : '';
}

export class BingWebmaster implements BingProvider {
  readonly name = 'bing-webmaster';
  readonly demo = false;
  constructor(private apiKey: string) {
    if (!/^[A-Za-z0-9]{16,64}$/.test(apiKey)) throw new SeoDataError('bad_request', 'Clé API Bing invalide.');
  }

  private async call<T>(method: string, params: Record<string, string> = {}): Promise<T> {
    const q = new URLSearchParams({ ...params, apikey: this.apiKey });
    let r: { d?: T; ErrorCode?: number; Message?: string };
    try {
      r = await requestJson<{ d?: T; ErrorCode?: number; Message?: string }>(`${endpoints().bing}/${method}?${q}`, { provider: 'Bing Webmaster' });
    } catch (e) {
      // Erreur JSON documentée {"ErrorCode":3,"Message":"InvalidApiKey"} renvoyée avec un statut 400.
      if (e instanceof SeoDataError && /InvalidApiKey/i.test(e.message)) throw new SeoDataError('auth', 'Bing Webmaster : clé API refusée.');
      throw e;
    }
    if (r && typeof r === 'object' && 'ErrorCode' in r && r.ErrorCode) {
      throw new SeoDataError(r.ErrorCode === 3 ? 'auth' : 'bad_request', `Bing Webmaster : ${r.Message ?? 'erreur'}`);
    }
    return (r?.d ?? ([] as unknown)) as T;
  }

  async sites(): Promise<string[]> {
    const d = await this.call<{ Url?: string; IsVerified?: boolean }[]>('GetUserSites');
    return (d ?? []).filter((s) => s.Url && s.IsVerified !== false).map((s) => String(s.Url));
  }

  async queryStats(siteUrl: string): Promise<BingQueryRow[]> {
    const d = await this.call<Record<string, unknown>[]>('GetQueryStats', { siteUrl });
    return (d ?? []).map((r) => ({
      query: String(r.Query ?? ''),
      date: msDate(r.Date),
      clicks: Number(r.Clicks ?? 0),
      impressions: Number(r.Impressions ?? 0),
      avgPosition: typeof r.AvgImpressionPosition === 'number' && r.AvgImpressionPosition > 0 ? r.AvgImpressionPosition : null,
    }));
  }

  async trafficStats(siteUrl: string): Promise<{ date: string; clicks: number; impressions: number }[]> {
    const d = await this.call<Record<string, unknown>[]>('GetRankAndTrafficStats', { siteUrl });
    return (d ?? []).map((r) => ({ date: msDate(r.Date), clicks: Number(r.Clicks ?? 0), impressions: Number(r.Impressions ?? 0) })).sort((a, b) => a.date.localeCompare(b.date));
  }
}

export interface BingConnection { businessId: string; apiKeyEnc: string; siteUrl: string; connectedAt: string }

export async function getBingConnection(businessId: string): Promise<BingConnection | null> {
  if (isDemoBusinessId(businessId)) return null;
  return (await getDoc<BingConnection>(BING_CONN, businessId))?.data ?? null;
}

/** Vérifie la clé (GetUserSites) et que le site du compte y figure, puis l'enregistre chiffrée. */
export async function connectBing(businessId: string, apiKey: string, website: string, now = new Date()): Promise<{ siteUrl: string }> {
  if (isDemoBusinessId(businessId)) throw new SeoDataError('demo_read_only', 'Compte de démonstration : aucune connexion.');
  const b = new BingWebmaster(apiKey.trim());
  const sites = await b.sites();
  const siteUrl = sites.find((s) => sameSite(s, website));
  if (!siteUrl) throw new SeoDataError('bad_request', 'Ce site n’est pas vérifié dans ce compte Bing Webmaster Tools.');
  await putDoc<BingConnection>(BING_CONN, businessId, { businessId, apiKeyEnc: encryptSecret(apiKey.trim()), siteUrl, connectedAt: now.toISOString() }, businessId);
  return { siteUrl };
}

export async function disconnectBing(businessId: string): Promise<void> {
  if (isDemoBusinessId(businessId)) return;
  await deleteDoc(BING_CONN, businessId);
}

export async function bingFor(businessId: string): Promise<{ provider: BingWebmaster; siteUrl: string } | null> {
  const c = await getBingConnection(businessId);
  if (!c) return null;
  try {
    return { provider: new BingWebmaster(decryptSecret(c.apiKeyEnc)), siteUrl: c.siteUrl };
  } catch {
    throw new SeoDataError('auth', 'Clé Bing illisible : reconnectez Bing Webmaster Tools.');
  }
}
