import { describe, expect, it } from 'vitest';
import { TABLES, backupFileName, checkPassphrase, chunks, decryptBackup, encryptBackup, readAll, summarize } from '../lib/sauvegarde.mjs';

const PASS = 'phrase-secrete-de-test-tres-longue';
const payload = { version: 1, createdAt: '2026-11-15T10:00:00.000Z', source: 'abc.supabase.co', tables: { businesses: [{ id: 'b1', name: 'Boulangerie Test' }], documents: [] } };

describe('sauvegarde chiffrée', () => {
  it('aller-retour, contenu illisible sans la phrase', () => {
    const buf = encryptBackup(payload, PASS);
    expect(buf.subarray(0, 8).toString('ascii')).toBe('REPSAV01');
    expect(buf.toString('latin1')).not.toContain('Boulangerie');
    expect(decryptBackup(buf, PASS)).toEqual(payload);
    expect(summarize(payload)).toEqual({ businesses: 1, documents: 0 });
  });
  it('phrase incorrecte ou fichier modifié : refus explicite', () => {
    const buf = encryptBackup(payload, PASS);
    expect(() => decryptBackup(buf, 'une-autre-phrase-longue-xx')).toThrow(/phrase secrète incorrecte/);
    const bad = Buffer.from(buf);
    bad[bad.length - 1] ^= 1;
    expect(() => decryptBackup(bad, PASS)).toThrow(/modifié/);
    expect(() => decryptBackup(Buffer.from('pas une sauvegarde du tout, vraiment pas'), PASS)).toThrow(/REPSAV01/);
  });
  it('phrase trop courte refusée', () => {
    expect(checkPassphrase('court')).toMatch(/16 caractères/);
    expect(() => encryptBackup(payload, 'court')).toThrow();
  });
  it('lecture paginée et découpage en lots', async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => ({ i }));
    const got = await readAll(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }));
    expect(got).toHaveLength(2500);
    expect(chunks(got, 1000).map((c: unknown[]) => c.length)).toEqual([1000, 1000, 500]);
    await expect(readAll(async () => ({ data: null, error: { message: 'relation absente' } }))).rejects.toThrow('relation absente');
  });
  it('tables : parents avant enfants, nom de fichier daté', () => {
    expect(TABLES.indexOf('businesses')).toBeLessThan(TABLES.indexOf('memberships'));
    expect(TABLES).not.toContain('rate_events');
    expect(backupFileName(new Date('2026-11-15T08:05:00Z'))).toBe('repere-2026-11-15-0805.repere-sauv');
  });
});
