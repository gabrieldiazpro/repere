import { describe, expect, it } from 'vitest';
import { brandFromTitle, nameFromDomain, prefillFromSignals, segmentFromTypes } from '../prefill';

describe('pré-remplissage depuis le site', () => {
  it('déduit un nom lisible de l’adresse', () => {
    expect(nameFromDomain('maison-sora.fr')).toBe('Maison Sora');
    expect(nameFromDomain('https://www.plomberie-martin.fr/contact')).toBe('Plomberie Martin');
    expect(nameFromDomain('paysia.co.uk')).toBe('Paysia');
    expect(nameFromDomain('pas une url')).toBeNull();
    expect(nameFromDomain('')).toBeNull();
  });

  it('choisit la marque dans le titre de la page', () => {
    expect(brandFromTitle('Accueil | Plomberie Martin', null, 'Plomberie Martin')).toBe('Plomberie Martin');
    expect(brandFromTitle('Logiciel de paie en ligne pour PME - Paysia', null, 'Paysia')).toBe('Paysia');
    expect(brandFromTitle('Peu importe', 'Maison Sora', null)).toBe('Maison Sora');
    expect(brandFromTitle('Accueil | Boulangerie Dupain', null, null)).toBe('Boulangerie Dupain');
  });

  it('déduit le parcours et le métier des types schema.org', () => {
    expect(segmentFromTypes(['Plumber'])).toEqual({ segment: 'local', trade: 'plombier' });
    expect(segmentFromTypes(['https://schema.org/Restaurant'])).toEqual({ segment: 'local', trade: 'restaurant' });
    expect(segmentFromTypes(['SoftwareApplication'])).toEqual({ segment: 'pme' });
    expect(segmentFromTypes(['Product'])).toEqual({ segment: 'ecommerce' });
    expect(segmentFromTypes(['WebPage'])).toEqual({});
  });

  it('combine les signaux sans rien inventer', () => {
    expect(prefillFromSignals('plomberie-martin.fr', null)).toEqual({ businessName: 'Plomberie Martin', from: 'adresse' });
    expect(prefillFromSignals('x.fr', { title: 'Accueil', jsonLdNames: ['Plomberie Martin'], jsonLdTypes: ['Plumber'] })).toEqual({
      businessName: 'Plomberie Martin',
      segment: 'local',
      category: 'plombier',
      from: 'site',
    });
    const p = prefillFromSignals('paysia.fr', { title: 'Paysia | La paie simple', jsonLdTypes: [] });
    expect(p.businessName).toBe('Paysia');
    expect(p.category).toBeUndefined();
  });
});
