/**
 * Dogfooding : Repéré utilise son propre module d'exécution pour son balisage et sa page officielle.
 * Le compte « maison » (HOUSE_BUSINESS_ID) est créé par le module execution / db (hors de ce dossier).
 * Tout est défensif : si le compte n'existe pas encore, le site publie le balisage écrit à la main, sans erreur.
 */
import { HOUSE_BUSINESS_ID, HOUSE_PAGE_PATH } from './site';
import { ORG_ID } from './jsonld';

type Node = Record<string, unknown>;

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

const clean = (v: unknown) => (typeof v === 'string' ? !/\[[^\]]*\]/.test(v) && v.trim() !== '' : v != null);

/**
 * Champs factuels du nœud Organization produit par /api/schema/repere (fiche de vérité), à fusionner dans
 * organizationLd() de l'accueil et de /a-propos. Le @id, le nom, l'URL et la description restent ceux du site :
 * seuls les champs absents du nœud écrit à la main sont repris (téléphone, adresse, date de création, sameAs).
 */
export async function houseOrgExtras(): Promise<Node> {
  try {
    const { schemaForBusiness } = await import('@/lib/execution');
    const data = (await withTimeout(schemaForBusiness(HOUSE_BUSINESS_ID), 2500)) as Node | null;
    const graph = (data?.['@graph'] as Node[] | undefined) ?? [];
    const org = graph.find((n) => n['@id'] === ORG_ID);
    if (!org) return {};
    const out: Node = {};
    for (const k of ['telephone', 'address', 'foundingDate'] as const) {
      const v = org[k];
      if (v && (typeof v !== 'object' || Object.values(v as Node).every(clean)) && clean(v)) out[k] = v;
    }
    if (Array.isArray(org.sameAs)) out.sameAs = (org.sameAs as unknown[]).filter((u): u is string => typeof u === 'string' && /^https:\/\//.test(u));
    return out;
  } catch {
    return {};
  }
}

/** Fusionne sans écraser l'identité (sameAs : union). */
export function mergeOrg<T extends Node>(base: T, extras: Node): T {
  const out: Node = { ...base };
  for (const [k, v] of Object.entries(extras)) {
    if (k === 'sameAs') {
      const merged = [...new Set([...((base.sameAs as string[] | undefined) ?? []), ...(v as string[])])];
      if (merged.length) out.sameAs = merged;
    } else if (out[k] === undefined) out[k] = v;
  }
  return out as T;
}

/** La page officielle /p/repere existe-t-elle et est-elle indexable ? (sitemap, liens) */
let liveCache: { at: number; v: Promise<boolean> } | null = null;

export function housePageLive(): Promise<boolean> {
  if (!liveCache || Date.now() - liveCache.at > 10 * 60_000) liveCache = { at: Date.now(), v: checkHousePage() };
  return liveCache.v;
}

async function checkHousePage(): Promise<boolean> {
  try {
    const { findBusinessIdBySlug, loadExecContext } = await import('@/lib/execution');
    const id = await withTimeout(findBusinessIdBySlug(HOUSE_PAGE_PATH.split('/').pop()!), 2500);
    if (!id) return false;
    const ctx = await withTimeout(loadExecContext(id), 2500);
    return !!ctx && !ctx.demo && ctx.settings.published !== false;
  } catch {
    return false;
  }
}
