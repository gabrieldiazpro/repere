/**
 * Point d'entrée des signatures partagées (docs/v3/12-CONTRATS-V3.md) pour le module DONNEES.
 * Raccordé aux vrais modules (intégration V3) : @/lib/auth, @/lib/entitlements, @/lib/jobs.
 */
export { requireBusiness, HttpError, type Role } from '@/lib/auth';
export { getEntitlements, assertEntitled, type Entitlements } from '@/lib/entitlements';
export { enqueue, registerHandler, type JobType } from '@/lib/jobs';
export type { Business, BusinessRecord } from '@/lib/db';
