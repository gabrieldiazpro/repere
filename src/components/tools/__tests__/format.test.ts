import { describe, expect, it } from 'vitest';
import { formatEuros, formatMargin, formatPrice, frenchPrices } from '../format';
import { EXAMPLE_PRODUCT, exampleProduct } from '../examples';

describe('formats français des outils', () => {
  it('prix au format « 14,90 € »', () => {
    expect(formatEuros(14.9)).toBe('14,90 €');
    expect(formatPrice('14.90', 'EUR')).toBe('14,90 €');
    expect(formatPrice('1290', 'eur')).toBe('1 290,00 €');
    expect(formatPrice(null, 'EUR')).toBeNull();
  });
  it('réécrit les montants des diagnostics sans toucher aux autres nombres', () => {
    expect(frenchPrices('12.90 EUR.')).toBe('12,90 €.');
    expect(frenchPrices('GTIN 3770012345017, 75 g')).toBe('GTIN 3770012345017, 75 g');
  });
  it('marges arrondies', () => {
    expect(formatMargin(13.7)).toBe('± 14 points');
    expect(formatMargin(null)).toBeNull();
  });
  it("l'exemple « fiche produit » est un cosmétique solide de Maison Sora, au prix du catalogue démo", () => {
    const r = exampleProduct();
    expect(EXAMPLE_PRODUCT.category).toMatch(/solide/);
    expect(r.product.name).toBe(EXAMPLE_PRODUCT.name);
    expect(Number(r.product.price)).toBeCloseTo(EXAMPLE_PRODUCT.price ?? NaN);
    expect(r.product.conflicts).toEqual([]);
    expect(JSON.stringify(r)).not.toMatch(/sencha|thé/i);
  });
});
