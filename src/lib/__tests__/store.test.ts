import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'store-'));

type StoreMod = typeof import('@/lib/store');
type LogMod = typeof import('@/lib/log');
let store: StoreMod;
let logMod: LogMod;

beforeAll(async () => {
  (globalThis as { __repereDocsDir?: string }).__repereDocsDir = DIR;
  store = await import('@/lib/store');
  logMod = await import('@/lib/log');
});

describe('store fichier : écritures atomiques et lecture protégée', () => {
  it('100 écritures concurrentes : le fichier reste du JSON complet à chaque lecture, aucun document perdu', async () => {
    const f = path.join(DIR, 'doc-conc.test.json');
    let reads = 0;
    let parseErrors = 0;
    let stop = false;
    // Lecteur concurrent (comme un autre processus du serveur de dev) : lit le fichier en boucle pendant les écritures.
    const reader = (async () => {
      while (!stop) {
        try {
          const raw = await fs.promises.readFile(f, 'utf8');
          reads++;
          JSON.parse(raw);
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== 'ENOENT') parseErrors++;
        }
        await new Promise((r) => setImmediate(r));
      }
    })();
    await Promise.all(Array.from({ length: 100 }, (_, i) => store.putDoc('conc.test', `d${i}`, { i, pad: 'x'.repeat(2000) })));
    stop = true;
    await reader;
    expect(parseErrors).toBe(0);
    expect(reads).toBeGreaterThan(0);
    const onDisk = JSON.parse(fs.readFileSync(f, 'utf8')) as Record<string, unknown>;
    expect(Object.keys(onDisk)).toHaveLength(100);
    expect(await store.listDocs('conc.test')).toHaveLength(100);
    // Aucun fichier temporaire laissé derrière.
    expect(fs.readdirSync(DIR).filter((n) => n.endsWith('.tmp'))).toEqual([]);
  });

  it('fichier tronqué : collection vide, ligne de journal, copie de sauvegarde, pas d’exception', async () => {
    fs.writeFileSync(path.join(DIR, 'doc-broken.json'), '{"a":{"id":"a","data":');
    const lines: string[] = [];
    const restore = logMod.setLogSink((_l, line) => lines.push(line));
    try {
      await expect(store.listDocs('broken')).resolves.toEqual([]);
    } finally {
      restore();
    }
    expect(lines.some((l) => l.includes('store.json_corrupt'))).toBe(true);
    expect(fs.readdirSync(DIR).some((n) => n.startsWith('doc-broken.json.corrupt-'))).toBe(true);
    // La collection reste utilisable.
    await store.putDoc('broken', 'b', { ok: true });
    expect((await store.getDoc<{ ok: boolean }>('broken', 'b'))?.data.ok).toBe(true);
  });

  it('fichier vide : collection vide + journal', async () => {
    fs.writeFileSync(path.join(DIR, 'doc-vide.json'), '');
    const lines: string[] = [];
    const restore = logMod.setLogSink((_l, line) => lines.push(line));
    try {
      await expect(store.listDocs('vide')).resolves.toEqual([]);
    } finally {
      restore();
    }
    expect(lines.some((l) => l.includes('store.json_empty'))).toBe(true);
  });

  it('readJsonSafe : absent → valeur par défaut, sans journal', async () => {
    const lines: string[] = [];
    const restore = logMod.setLogSink((_l, line) => lines.push(line));
    try {
      expect(await store.readJsonSafe(path.join(DIR, 'absent.json'), () => ({ x: 1 }))).toEqual({ x: 1 });
    } finally {
      restore();
    }
    expect(lines).toEqual([]);
  });
});
