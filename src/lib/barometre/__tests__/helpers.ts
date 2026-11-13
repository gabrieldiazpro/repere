/** Outils de test : store isolé dans un dossier temporaire, fournisseurs simulés « réels » (tests seulement). */
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { EngineProvider } from '../../engine/providers/http';
import type { ProviderId } from '../../engine/types';
import { simulatedAnswer } from '../simulate';
import type { BarometreDef } from '../types';

export function isolateStore(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'barometre-test-'));
  const g = globalThis as unknown as { __repereDocs?: Map<string, unknown>; __repereDocsDir?: string };
  g.__repereDocs?.clear();
  g.__repereDocsDir = dir;
  return dir;
}

/**
 * Fournisseur « mesure réelle » factice : demo:false, modèle nommé, réponses du générateur simulé.
 * Sert UNIQUEMENT à tester le chemin de publication dans un store temporaire.
 */
export function fakeRealProvider(id: ProviderId, def: BarometreDef, opts: { seed?: string; cost?: number; counter?: { n: number }; fail?: (q: string) => boolean } = {}): EngineProvider {
  return {
    id,
    model: `modele-test-${id}`,
    demo: false,
    costPerCallEur: opts.cost ?? 0.01,
    async ask(query, ctx) {
      if (opts.counter) opts.counter.n++;
      if (opts.fail?.(ctx.queryId)) throw new Error('HTTP 500 : erreur de test');
      return simulatedAnswer(def, id, query, ctx, opts.seed);
    },
  };
}
