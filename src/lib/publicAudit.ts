import type { AuditResult } from '@/lib/engine';

/**
 * Version publique d'un audit (qa/securite.md E2) : le rapport est partageable par lien,
 * donc jamais d'e-mail, de message d'erreur fournisseur ni de coût interne.
 * À utiliser pour GET /api/audit/[id] et la page /rapport/[id] (y compris le flux RSC).
 */
export function toPublicAudit(audit: AuditResult): AuditResult {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { email: _email, ...input } = audit.input;
  const answers = (audit.answers ?? []).map((a) => (a.error ? { ...a, error: 'indisponible' } : a));
  const out: AuditResult = { ...audit, input, answers };
  if (audit.details) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { estimatedCostEur: _c, ...details } = audit.details;
    out.details = details as AuditResult['details'];
  }
  return out;
}
