import { describe, expect, it, vi } from 'vitest';

// Les modules CSS ne passent pas par PostCSS en test : classes remplacées par leur nom.
vi.mock('../report.module.css', () => ({ default: new Proxy({}, { get: (_t, k) => String(k) }) }));
vi.mock('../v2.module.css', () => ({ default: new Proxy({}, { get: (_t, k) => String(k) }) }));
vi.mock('../v3.module.css', () => ({ default: new Proxy({}, { get: (_t, k) => String(k) }) }));
vi.mock('../v4.module.css', () => ({ default: new Proxy({}, { get: (_t, k) => String(k) }) }));
import { renderToStaticMarkup } from 'react-dom/server';
import { createMockAudit } from '@/lib/engine/audit';
import { competitorRanking } from '../derive';
import type { ReportResult } from '../adapters';
import { findingsOf, shortQuote, summaryOf } from '../v3';
import { ReportView } from '../ReportView';

const local = createMockAudit({ businessName: 'Plomberie Martin', trade: 'plombier', city: 'Lyon' }, 'v4-local') as ReportResult;

describe('rapport V4 : synthèse en 10 secondes', () => {
  it('3 constats au plus, mêmes chiffres que la synthèse, l’action en dernier', () => {
    const s = summaryOf(local);
    const rk = competitorRanking(local, 5);
    const f = findingsOf(s, rk.leader, rk.rows.find((x) => x.isYou)?.mentions ?? 0);
    expect(f.length).toBeGreaterThanOrEqual(2);
    expect(f.length).toBeLessThanOrEqual(3);
    expect(f[0].big).toBe(`${s.cited} sur ${s.answers}`);
    expect(f[f.length - 1].label).toBe('À faire en premier');
    expect(f[f.length - 1].big).toBe(s.action.title);
    for (const x of f) expect(x.href.startsWith('#')).toBe(true);
  });

  it('un rang de 1 devient un point fort', () => {
    const s = { ...summaryOf(local), rank: 1, of: 6 };
    const f = findingsOf(s, null, 3);
    expect(f[1]).toMatchObject({ tone: 'good', big: '1ᵉʳ sur 6' });
  });

  it('extrait court coupé sur un mot', () => {
    const long = 'mot '.repeat(80).trim();
    const q = shortQuote(long, 50);
    expect(q.length).toBeLessThanOrEqual(52);
    expect(q.endsWith(' …')).toBe(true);
    expect(shortQuote('court')).toBe('court');
  });

  it('rendu serveur : verdict, constats, extraits et LE bouton d’inscription dans le HTML', () => {
    const html = renderToStaticMarkup(<ReportView result={local} payable={false} />);
    expect(html).toContain('Les 3 constats les plus importants');
    expect(html).toContain('Créer mon espace gratuit');
    expect(html).toContain('Le détail du rapport');
    expect(html.indexOf('Créer mon espace gratuit')).toBeLessThan(html.indexOf('id="verite"'));
  });
});
