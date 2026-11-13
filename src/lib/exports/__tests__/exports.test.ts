import { describe, expect, it } from 'vitest';
import { BOM, csvCell, csvFilename, frNumber, parseCsv, toCsv, questionRows, scoreRows, sourceRows, urlRows, COLUMNS, isExportKind } from '@/lib/exports';
import { buildDemoWorkspaceById } from '@/lib/demo-v2';
import type { AuditResult } from '@/lib/engine/types';

const audits = buildDemoWorkspaceById('demo')!.audits as AuditResult[];

describe('CSV compatible Excel français', () => {
  it('BOM, point-virgule, CRLF, virgule décimale', () => {
    const csv = toCsv([{ a: 'x;y', b: 0.25, c: 'dit "oui"' }], [
      { key: 'a', label: 'A', value: (r) => r.a },
      { key: 'b', label: 'B', value: (r) => r.b },
      { key: 'c', label: 'C', value: (r) => r.c },
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toContain('A;B;C\r\n');
    expect(csv).toContain('"x;y";0,25;"dit ""oui"""');
  });
  it('neutralise les formules', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+33 6')).toBe("'+33 6");
    expect(csvCell('@SUM')).toBe("'@SUM");
    expect(csvCell(-3)).toBe('-3'); // un nombre reste un nombre
  });
  it('nombres, booléens, vides', () => {
    expect(frNumber(1234.5)).toBe('1234,5');
    expect(frNumber(1 / 3)).toBe('0,3333');
    expect(csvCell(true)).toBe('oui');
    expect(csvCell(null)).toBe('');
    expect(csvCell(['a', 'b'])).toBe('a, b');
  });
  it('aller-retour avec parseCsv', () => {
    const rows = [{ t: 'ligne 1\nligne 2', n: 3 }];
    const back = parseCsv(toCsv(rows, [{ key: 't', label: 'Texte', value: (r) => r.t }, { key: 'n', label: 'N', value: (r) => r.n }]));
    expect(back[0]).toEqual(['Texte', 'N']);
    expect(back[1]).toEqual(['ligne 1\nligne 2', '3']);
  });
  it('nom de fichier sûr', () => {
    expect(csvFilename('sources', 'Plomberie Martin & Fils', new Date('2026-11-09T10:00:00Z'))).toBe('repere-sources-plomberie-martin-fils-2026-11-09.csv');
  });
});

describe('vues exportées (démo)', () => {
  it('types reconnus', () => {
    expect(isExportKind('questions')).toBe(true);
    expect(isExportKind('../etc')).toBe(false);
  });
  it('questions : une ligne par question × IA, taux cohérent', () => {
    const rows = questionRows(audits.slice(-1));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.cited).toBeLessThanOrEqual(r.answers);
      expect(r.rate).toBeCloseTo(r.answers ? r.cited / r.answers : 0);
    }
  });
  it('historique des scores : une ligne par audit, avec marge', () => {
    const rows = scoreRows(audits);
    expect(rows).toHaveLength(audits.length);
    for (const r of rows) expect(r.low).toBeLessThanOrEqual(r.high);
    const csv = toCsv(rows, COLUMNS.scores);
    expect(parseCsv(csv)[0]).toContain('Score /100');
  });
  it('sources et URL sans e-mail', () => {
    const csv = toCsv(sourceRows(audits.slice(-1)), COLUMNS.sources) + toCsv(urlRows(audits), COLUMNS.urls);
    expect(csv).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  });
});
