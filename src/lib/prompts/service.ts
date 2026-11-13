/**
 * Cas d'usage composés (utilisés par les routes /api/prompts) : import, suggestions d'un commerce, historique.
 */
import type { Business } from '@/lib/db';
import { listAuditsForBusiness } from '@/lib/db';
import { DEMO_READ_ONLY, isDemoBusinessId } from '@/lib/demo-v2';
import type { ProviderId } from '@/lib/engine/types';
import { putDoc } from '@/lib/store';
import { getEntitlements, getSiteFetcher, HttpError, type SiteSnapshot } from './adapters';
import { buildHistory, type PromptHistory } from './history';
import { parseImport, planImport, type ImportRejection } from './io';
import { buildPrompt, COLLECTION, listPrompts, quotaOf } from './repo';
import { suggestPrompts } from './suggest';
import type { PromptSuggestion, TrackedPrompt } from './types';

export interface ImportResult {
  created: TrackedPrompt[];
  rejected: ImportRejection[];
  /** questions importées en pause faute de place dans le quota de questions actives */
  pausedForQuota: number;
  dryRun: boolean;
}

/**
 * Importe un contenu CSV ou texte. Dédoublonné contre l'existant et dans le fichier.
 * Les questions au-delà du quota de questions actives sont importées EN PAUSE (rien n'est perdu).
 * `dryRun` : calcule le résultat sans rien écrire (autorisé sur les comptes démo).
 */
export async function importPrompts(business: Business, content: string, opts: { dryRun?: boolean } = {}): Promise<ImportResult> {
  const dryRun = opts.dryRun === true;
  if (!dryRun && isDemoBusinessId(business.id)) throw new HttpError(403, DEMO_READ_ONLY);
  const existing = await listPrompts(business.id);
  const plan = planImport(parseImport(content), existing);
  const quota = await quotaOf(business, existing);
  let room = quota.remaining;
  let pausedForQuota = 0;
  const created: TrackedPrompt[] = [];
  const now = new Date();
  for (const input of plan.accepted) {
    let active = input.active !== false;
    if (active) {
      if (room > 0) room--;
      else {
        active = false;
        pausedForQuota++;
      }
    }
    created.push(buildPrompt(business, { ...input, active, origin: 'client' }, now));
  }
  if (!dryRun) for (const p of created) await putDoc(COLLECTION, p.id, p, business.id);
  return { created, rejected: plan.rejected, pausedForQuota, dryRun };
}

export interface SuggestRequest {
  category?: string;
  offering?: string;
  /** URL du site à lire (défaut : site déclaré du commerce) */
  url?: string;
  /** lire le site (défaut : oui, sauf comptes démo) */
  fetchSite?: boolean;
  limit?: number;
}

export interface SuggestResponse {
  suggestions: PromptSuggestion[];
  /** le site a-t-il pu être lu (récupération sûre) ? */
  siteRead: boolean;
}

export async function suggestForBusiness(business: Business, req: SuggestRequest = {}): Promise<SuggestResponse> {
  const [audits, existing] = await Promise.all([listAuditsForBusiness(business.id).catch(() => []), listPrompts(business.id)]);
  let site: SiteSnapshot | null = null;
  const url = (req.url || business.website || '').trim();
  const demo = isDemoBusinessId(business.id);
  if (url && req.fetchSite !== false && !demo) {
    const fetcher = getSiteFetcher();
    site = fetcher ? await fetcher(url).catch(() => null) : null;
  }
  const suggestions = suggestPrompts({
    business,
    audits,
    existing,
    category: req.category,
    offering: req.offering,
    site,
    limit: req.limit,
  });
  return { suggestions, siteRead: Boolean(site && site.headings.length) };
}

/** Historique d'une question, limité à la profondeur d'historique de l'offre. */
export async function historyForPrompt(
  business: Business,
  prompt: TrackedPrompt,
  opts: { provider?: ProviderId; answers?: boolean; maxAnswers?: number; now?: Date } = {},
): Promise<PromptHistory & { historyMonths: number | null }> {
  const audits = await listAuditsForBusiness(business.id).catch(() => []);
  const months = getEntitlements(business).historyMonths;
  let since: string | undefined;
  if (months != null) {
    const d = new Date(opts.now ?? new Date());
    d.setMonth(d.getMonth() - months);
    since = d.toISOString();
  }
  return { ...buildHistory(prompt, audits, { provider: opts.provider, answers: opts.answers, maxAnswers: opts.maxAnswers, since }), historyMonths: months };
}
