/**
 * Audits de site rattachés à un commerce (app, protégée par session) : historique dans la collection
 * `siteaudit.runs`. Les comptes démo ne sont jamais écrits côté serveur (lecture seule).
 */
import { isDemoBusinessId } from '@/lib/demo-v2';
import { getDoc, listDocs, putDoc } from '@/lib/store';
import { auditCitability, citabilityFromHtml, withAiRewrite } from './citability';
import { SafeFetchError, type SafeFetchOptions } from './fetch';
import { productFromHtml } from './product';
import { auditPage } from './readiness';
import type { CitabilityReport, ProductReport, ReadinessReport } from './types';

export const RUNS_COLLECTION = 'siteaudit.runs';

export type RunKind = 'full' | 'readiness' | 'citability' | 'product';

export interface SiteAuditRun {
  id: string;
  businessId: string;
  url: string;
  kind: RunKind;
  createdAt: string;
  readiness: ReadinessReport | null;
  citability: CitabilityReport | null;
  product: ProductReport | null;
  error?: string;
  /** Résultat non enregistré (compte démo). */
  demo?: boolean;
}

export interface RunOptions extends SafeFetchOptions {
  kind?: RunKind;
  question?: string;
  /** Réécriture par IA (si clé configurée). */
  ai?: boolean;
  /** Enregistrer dans l'historique (défaut : oui, sauf comptes démo). */
  persist?: boolean;
}

function runId(): string {
  return `sa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Lance un audit de page pour un commerce et l'enregistre. */
export async function runSiteAudit(businessId: string, url: string, opts: RunOptions = {}): Promise<SiteAuditRun> {
  const kind = opts.kind ?? 'full';
  const demo = isDemoBusinessId(businessId);
  const run: SiteAuditRun = { id: runId(), businessId, url, kind, createdAt: new Date().toISOString(), readiness: null, citability: null, product: null, ...(demo ? { demo: true } : {}) };
  try {
    if (kind === 'citability') {
      run.citability = await auditCitability({ url, question: opts.question, ai: opts.ai }, opts);
    } else {
      const { readiness, html, finalUrl } = await auditPage(url, opts);
      if (kind === 'full' || kind === 'readiness') run.readiness = readiness;
      if (kind === 'full') {
        const c = citabilityFromHtml(html, { url: finalUrl, question: opts.question });
        run.citability = opts.ai ? await withAiRewrite(c, html, opts.question) : c;
      }
      if (kind === 'product' || (kind === 'full' && /"@type"\s*:\s*"Product"|og:type["']?\s+content=["']product/i.test(html))) run.product = productFromHtml(html, finalUrl);
    }
  } catch (e) {
    if (!(e instanceof SafeFetchError)) throw e;
    run.error = e.publicMessage;
  }
  if (!demo && opts.persist !== false) await putDoc(RUNS_COLLECTION, run.id, run, businessId);
  return run;
}

/** Historique d'un commerce (plus récent d'abord). Allégé : sans les verdicts robot par robot. */
export async function listRuns(businessId: string, limit = 20): Promise<SiteAuditRun[]> {
  if (isDemoBusinessId(businessId)) return [];
  const docs = await listDocs<SiteAuditRun>(RUNS_COLLECTION, { businessId, limit: Math.min(limit, 100) });
  return docs.map((d) => d.data);
}

export async function getRun(businessId: string, id: string): Promise<SiteAuditRun | null> {
  const d = await getDoc<SiteAuditRun>(RUNS_COLLECTION, id);
  return d && d.businessId === businessId ? d.data : null;
}

/** Gestionnaire de la tâche de fond `siteaudit.run` : payload { businessId, url, kind?, question? }. */
export async function runSiteAuditJob(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const businessId = typeof payload.businessId === 'string' ? payload.businessId : '';
  const url = typeof payload.url === 'string' ? payload.url : '';
  if (!businessId || !url) throw new Error('siteaudit.run : businessId et url requis');
  const kind = (['full', 'readiness', 'citability', 'product'] as const).find((k) => k === payload.kind) ?? 'full';
  const run = await runSiteAudit(businessId, url, { kind, question: typeof payload.question === 'string' ? payload.question : undefined });
  return { runId: run.id, readiness: run.readiness?.score ?? null, citability: run.citability?.score ?? null, error: run.error ?? null };
}
