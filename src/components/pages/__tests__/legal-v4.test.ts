import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/pages/v4/v4.module.css', () => ({ default: {} }));
vi.mock('@/components/pages/ui', () => ({ Breadcrumbs: () => null, SitePage: () => null }));

import { leadIn, legalToc, splitNumber } from '@/components/pages/v4/LegalDocument';

describe('pages légales V4 : mise en forme sans changer le texte', () => {
  it('sépare le numéro d’article du titre', () => {
    expect(splitNumber('2 bis. Contenu des offres')).toEqual(['2 bis', 'Contenu des offres']);
    expect(splitNumber('12 quater. Parrainage')).toEqual(['12 quater', 'Parrainage']);
    expect(splitNumber('Questions fréquentes')).toEqual([null, 'Questions fréquentes']);
  });

  it('isole l’intitulé d’un point sans perdre un caractère', () => {
    const t = 'Test gratuit : score de visibilité IA, premiers résultats.';
    const [a, b] = leadIn(t);
    expect(a).toBe('Test gratuit : ');
    expect(`${a}${b}`).toBe(t);
    expect(leadIn('[À COMPLÉTER : date] suite')).toEqual([null, '[À COMPLÉTER : date] suite']);
  });

  it('donne au sommaire des ancres uniques et lisibles', () => {
    const toc = legalToc([
      { title: '1. Identité et objet' },
      { title: '2. Offres et prix' },
      { title: '2. Offres et prix' },
    ] as never);
    expect(toc.map((x) => x.label)).toEqual(['1. Identité et objet', '2. Offres et prix', '2. Offres et prix']);
    expect(new Set(toc.map((x) => x.id)).size).toBe(3);
    expect(toc[0].id).toBe('1-identite-et-objet');
  });
});
