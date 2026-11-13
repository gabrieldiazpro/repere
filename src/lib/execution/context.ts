/**
 * Chargement du contexte d'exécution d'un commerce : business, fiche de vérité, dernier audit, réglages.
 * Dépendances : db.ts (getBusiness, getLatestAuditForBusiness), facts.ts (getFacts, getLatestFactCheck).
 */
import type { Segment } from '@/lib/engine/types-v2';
import { getBusiness, getLatestAuditForBusiness, type Business } from '@/lib/db';
import { getFacts, getLatestFactCheck } from '@/lib/facts';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { withDemoV2 } from './demo';
import { getSettings } from './repo';
import type { AuditV2, BrandFacts, ExecSettings } from './types';

export interface ExecContext {
  business: Business;
  segment: Segment;
  facts: BrandFacts;
  audit: AuditV2 | null;
  settings: ExecSettings;
  demo: boolean;
}

export async function loadExecContext(businessId: string): Promise<ExecContext | null> {
  const business = await getBusiness(businessId);
  if (!business) return null;
  const demo = isDemoBusinessId(businessId);
  const [facts, rawAudit, settings] = await Promise.all([
    getFacts(businessId).catch(() => ({ businessId, facts: {}, updatedAt: '' }) as BrandFacts),
    getLatestAuditForBusiness(businessId).catch(() => null),
    getSettings(businessId, business.name),
  ]);
  let audit = rawAudit as AuditV2 | null;
  const segment: Segment = settings.segment ?? business.segment ?? audit?.segment ?? audit?.input?.segment ?? 'local';
  if (audit) {
    if (!audit.factCheck) {
      const fc = await getLatestFactCheck(businessId).catch(() => null);
      if (fc && fc.auditId === audit.id) audit = { ...audit, factCheck: fc.report };
    }
    if (demo) audit = withDemoV2(audit, segment);
  }
  return { business, segment, facts, audit, settings, demo };
}
