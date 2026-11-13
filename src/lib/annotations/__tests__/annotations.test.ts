import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { addAnnotation, annotateTaskDone, cleanLabel, deleteAnnotation, isValidDate, listStoredAnnotations, mergeAnnotations } from '@/lib/annotations';

beforeAll(() => {
  (globalThis as { __repereDocsDir?: string }).__repereDocsDir = mkdtempSync(path.join(os.tmpdir(), 'annot-'));
});

describe('annotations', () => {
  it('validation', () => {
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('2026-11-09')).toBe(true);
    expect(cleanLabel('<b>x</b>'.repeat(30)).length).toBeLessThanOrEqual(80);
  });
  it('ajout manuel, tâche faite idempotente, suppression', async () => {
    const now = new Date('2026-11-09T10:00:00Z');
    const a = await addAnnotation('bizA', { date: '2026-11-02', label: 'Article paru dans la presse locale', kind: 'external' as never }, now);
    expect(a.kind).toBe('manual');
    await expect(addAnnotation('bizA', { date: '2026-13-01', label: 'x' })).rejects.toThrow(/Date/);
    await expect(addAnnotation('bizA', { date: '2026-11-01', label: '   ' })).rejects.toThrow();
    await annotateTaskDone('bizA', { id: 't1', title: 'Fiche Google', doneAt: '2026-11-05T09:00:00Z' }, now);
    await annotateTaskDone('bizA', { id: 't1', title: 'Fiche Google', doneAt: '2026-11-05T09:00:00Z' }, now);
    const stored = await listStoredAnnotations('bizA');
    expect(stored).toHaveLength(2);
    const merged = mergeAnnotations(stored, [
      { id: 't1', title: 'Fiche Google', doneAt: '2026-11-05T09:00:00Z', businessId: 'bizA', status: 'done' },
      { id: 't2', title: 'JSON-LD', doneAt: '2026-10-20T09:00:00Z', businessId: 'bizA', status: 'done' },
      { id: 't3', title: 'À faire', businessId: 'bizA', status: 'todo' },
    ]);
    expect(merged.map((x) => x.date)).toEqual(['2026-10-20', '2026-11-02', '2026-11-05']);
    expect(mergeAnnotations(stored, [], { from: '2026-11-03' })).toHaveLength(1);
    expect(await deleteAnnotation('autre', a.id)).toBe(false);
    expect(await deleteAnnotation('bizA', a.id)).toBe(true);
  });
  it('démo en lecture seule', async () => {
    await expect(addAnnotation('demo', { date: '2026-11-02', label: 'x' })).rejects.toThrow(/démonstration/);
  });
});
