import { describe, expect, it } from 'vitest';
import { renderBadgeSvg } from '../badge';

/** Largeur estimée d'un texte (Inter ≈ 0,58 em par caractère, majorée). */
const width = (txt: string, size: number) => txt.length * size * 0.58;

describe('badge : le texte ne passe pas sous la pastille de score', () => {
  it.each(['2026-09-05T10:00:00Z', '2026-11-05T10:00:00Z'])('avec note (%s) : chaque ligne tient entre x=72 et x=228', (at) => {
    const svg = renderBadgeSvg({ state: 'valid', measuredAt: at, score: 64 });
    const lines = [...svg.matchAll(/<text x="72" y="\d+" font-size="(\d+)"[^>]*>([^<]+)<\/text>/g)];
    expect(lines.length).toBe(3);
    for (const [, size, txt] of lines) expect(width(txt, Number(size)), txt).toBeLessThanOrEqual(156);
    expect(svg).toContain('aria-label="Visibilité IA mesurée par Repéré');
  });
  it('sans note : libellé complet sur une ligne', () => {
    const svg = renderBadgeSvg({ state: 'valid', measuredAt: '2026-11-05T10:00:00Z' });
    expect(svg).toContain('>Visibilité IA mesurée par Repéré</text>');
    expect(svg).not.toContain('rx="16"');
  });
});
