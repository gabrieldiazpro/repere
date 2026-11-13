import { describe, expect, it, vi } from 'vitest';

// Les modules CSS ne passent pas par PostCSS en test : classes remplacées par leur nom.
vi.mock('../report.module.css', () => ({ default: new Proxy({}, { get: (_t, k) => String(k) }) }));
vi.mock('../v2.module.css', () => ({ default: new Proxy({}, { get: (_t, k) => String(k) }) }));
vi.mock('../v3.module.css', () => ({ default: new Proxy({}, { get: (_t, k) => String(k) }) }));
vi.mock('../v4.module.css', () => ({ default: new Proxy({}, { get: (_t, k) => String(k) }) }));
import { renderToStaticMarkup } from 'react-dom/server';
import { createMockAudit } from '@/lib/engine/audit';
import { ReportView } from '../ReportView';
import type { ReportResult } from '../adapters';

const r = createMockAudit(
  { businessName: 'Paysia', trade: 'logiciel de paie', city: 'France', segment: 'pme', category: 'logiciel de paie pour PME', market: 'France' } as never,
  'render-v3',
) as ReportResult;

describe('ReportView V3 (rendu serveur)', () => {
  it('affiche synthèse, marge, ancres, Découverte en premier et aucun bouton mort', () => {
    const html = renderToStaticMarkup(<ReportView result={r} unlocked payable={false} />);
    expect(html).toContain('id="synthese"');
    expect(html).toContain('±');
    expect(html).toContain('À faire en premier');
    expect(html).toContain(`/inscription?audit=${encodeURIComponent(r.id)}&amp;offre=pme_decouverte`);
    // Sans Stripe : les offres payantes renvoient vers /tarifs, jamais vers un paiement qui échoue.
    expect(html).toContain('/tarifs?segment=pme');
    expect(html.indexOf('Découverte')).toBeLessThan(html.indexOf('Essentiel'));
    // Démo : pas de carte de score à partager.
    if (r.demo) expect(html).not.toContain('Partager ma carte de score');
    expect(html).toContain('id="pour-vous"');
    expect(html).toContain('id="offres"');
  });

  it('propose la carte de score d’un audit réel quand elle est activée', () => {
    const real = { ...r, demo: false } as ReportResult;
    const html = renderToStaticMarkup(<ReportView result={real} cardHref="https://repere-ia.fr/carte/x?t=abc" />);
    expect(html).toContain('href="https://repere-ia.fr/carte/x?t=abc"');
  });
});
