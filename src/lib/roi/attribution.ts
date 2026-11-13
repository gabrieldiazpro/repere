/**
 * Attribution « première page / UTM » des inscriptions, analyses et audits (ROI des sources payantes, /admin/roi).
 *
 * Conforme à la politique du site (confidentialite, article 11) : aucun cookie, aucun stockage dans le navigateur,
 * aucun identifiant. La première page vue est gardée EN MÉMOIRE de l'onglet (src/lib/roi/landing.ts) pendant la
 * navigation sur le site, et les liens des baromètres portent des paramètres UTM. Le formulaire (audit, analyse,
 * inscription) envoie cette origine avec la demande ; le serveur la valide et la garde avec l'audit, l'analyse ou
 * l'espace créé (collection `roi.attribution`). Première origine connue = celle retenue (jamais écrasée).
 */
import { getDoc, listDocs, putDoc } from '@/lib/store';
import { barometreOf, type Attribution } from './core';

export * from './core';

export const ATTRIBUTION = 'roi.attribution';

export type AttributionKind = 'analysis' | 'audit' | 'business';

export interface AttributionRecord {
  kind: AttributionKind;
  id: string;
  attribution: Attribution;
  /** baromètre d'origine (slug) si l'origine est un baromètre */
  barometre: string | null;
  /** pour un espace : l'analyse ou l'audit dont l'origine a été reprise */
  via?: { kind: 'analysis' | 'audit'; id: string } | null;
  at: string;
}

const docId = (kind: AttributionKind, id: string) => `${kind}:${id}`;

export async function getAttribution(kind: AttributionKind, id: string): Promise<AttributionRecord | null> {
  return (await getDoc<AttributionRecord>(ATTRIBUTION, docId(kind, id)))?.data ?? null;
}

/** Enregistre l'origine (première connue seulement). Ne lève jamais : l'attribution ne bloque aucun parcours. */
export async function recordAttribution(
  kind: AttributionKind,
  id: string,
  attribution: Attribution | null,
  opts: { via?: AttributionRecord['via']; now?: Date; businessId?: string | null } = {},
): Promise<AttributionRecord | null> {
  if (!attribution || !id || id.length > 120) return null;
  try {
    const existing = await getAttribution(kind, id);
    if (existing) return existing;
    const rec: AttributionRecord = {
      kind,
      id,
      attribution,
      barometre: barometreOf(attribution),
      ...(opts.via ? { via: opts.via } : {}),
      at: (opts.now ?? new Date()).toISOString(),
    };
    await putDoc(ATTRIBUTION, docId(kind, id), rec, opts.businessId ?? (kind === 'business' ? id : null));
    return rec;
  } catch (e) {
    console.warn('[roi] attribution non enregistrée', (e as Error).message);
    return null;
  }
}

/**
 * Origine d'un nouvel espace : celle de l'analyse 60 s ou de l'audit d'origine (le premier contact), sinon celle
 * envoyée par le formulaire d'inscription.
 */
export async function recordSignupAttribution(
  businessId: string,
  input: { analysis?: string; audit?: string; attribution?: Attribution | null },
  now: Date = new Date(),
): Promise<AttributionRecord | null> {
  try {
    const fromAnalysis = input.analysis ? await getAttribution('analysis', input.analysis) : null;
    const fromAudit = !fromAnalysis && input.audit ? await getAttribution('audit', input.audit) : null;
    const origin = fromAnalysis ?? fromAudit;
    if (origin) return recordAttribution('business', businessId, origin.attribution, { via: { kind: origin.kind as 'analysis' | 'audit', id: origin.id }, now });
    return recordAttribution('business', businessId, input.attribution ?? null, { now });
  } catch {
    return null;
  }
}

/** Toutes les origines enregistrées (lecture admin). */
export async function listAttributions(limit = 20_000): Promise<AttributionRecord[]> {
  const docs = await listDocs<AttributionRecord>(ATTRIBUTION, { limit });
  return docs.map((d) => d.data).filter((r): r is AttributionRecord => !!r && typeof r.kind === 'string');
}
