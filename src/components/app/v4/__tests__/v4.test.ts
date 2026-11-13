import { describe, expect, it } from 'vitest';
import { subscriptionPlans } from '../../Settings';
import { isPlanAvailable } from '@/lib/plans';

describe('Réglages : offres proposées', () => {
  it.each(['local', 'pme', 'ecommerce'] as const)('parcours %s : Essentiel et Accompagné réels, jamais l’ancienne offre', (seg) => {
    const ids = subscriptionPlans(seg).map((p) => p.id);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(ids).not.toContain('suivi_month');
    expect(ids.some((id) => id.includes('_essentiel_month'))).toBe(true);
    expect(ids.some((id) => id.includes('_accompagne_month'))).toBe(true);
    for (const id of ids) expect(isPlanAvailable(id)).toBe(true);
  });
});
