import { describe, expect, it } from 'vitest';
import { DemoSearchConsole } from '../demo';

/** RACCORDS-FINAUX : la position moyenne Search Console de démo diffère d'un compte à l'autre (et reste stable). */
describe('Search Console de démo : position moyenne par compte', () => {
  it('trois comptes, trois positions moyennes cohérentes avec leurs mots-clés', async () => {
    const now = new Date('2026-11-13T00:00:00Z');
    const avg = async (id: 'demo' | 'demo-pme' | 'demo-ecom') => {
      const rows = await new DemoSearchConsole(id, now).query('x', { startDate: '2026-10-14', endDate: '2026-11-12', dimensions: ['date'] });
      return rows.reduce((a, r) => a + r.position, 0) / rows.length;
    };
    const [a, b, c] = [await avg('demo'), await avg('demo-pme'), await avg('demo-ecom')];
    expect(new Set([a.toFixed(1), b.toFixed(1), c.toFixed(1)]).size).toBe(3);
    expect(a).toBeLessThan(c);
    expect(await avg('demo')).toBe(a);
  });
});
