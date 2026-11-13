'use server';
// Actions serveur de la partie SEO (APP-SEO) : relance de l'exploration du site (droits par offre).
import { revalidatePath } from 'next/cache';
import { requireBusiness } from '@/lib/auth';
import { crawlSite } from '@/lib/crawl';
import { getEntitlements } from '@/lib/entitlements';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { putDoc } from '@/lib/store';
import { log } from '@/lib/log';
import { providersForBusiness } from '@/lib/seodata/providers';
import { loadWorkspace } from '@/components/app/workspace';
import { auditBoth, listRealRuns, RUN_COLLECTION } from '@/components/app/seo/data';
import { crawlRights, nextCrawlAllowed, type SeoRun } from '@/components/app/seo/model';

export type CrawlResult = { ok: true; seo: number; geo: number; pages: number; truncated: boolean } | { ok: false; error: string; code?: string };

/** Budget de temps d'une exploration lancée depuis l'app (la page reste ouverte pendant ce temps). */
const TIME_BUDGET_MS = 50_000;

export async function relancerExploration(): Promise<CrawlResult> {
  const ws = await loadWorkspace();
  const id = ws.business.id;
  if (ws.demo || isDemoBusinessId(id)) return { ok: false, error: 'Compte de démonstration : l’exploration est simulée.', code: 'demo_read_only' };
  let tier = 'decouverte';
  try {
    const { business } = await requireBusiness(null, id, { write: true });
    tier = getEntitlements(business).tier;
  } catch {
    return { ok: false, error: 'Vous n’avez pas les droits pour lancer une exploration sur cet espace.', code: 'forbidden' };
  }
  const website = ws.business.website ? (/^https?:\/\//.test(ws.business.website) ? ws.business.website : `https://${ws.business.website}`) : '';
  if (!website) return { ok: false, error: 'Renseignez l’adresse de votre site dans les réglages, puis relancez.', code: 'no_site' };
  const rights = crawlRights(tier);
  const past = await listRealRuns(id, 30);
  const next = nextCrawlAllowed(rights, past.filter((r) => r.trigger === 'manual').map((r) => r.at));
  if (next) return { ok: false, error: `Votre offre permet ${rights.label.toLowerCase()}. Prochaine exploration possible le ${next.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })}.`, code: 'quota' };
  try {
    const crawl = await crawlSite(website, { maxPages: rights.maxPages, timeBudgetMs: TIME_BUDGET_MS, concurrency: 4, checkLinks: true, maxLinkChecks: 40 });
    if (!crawl.pages.length) return { ok: false, error: 'Le site n’a pas répondu à notre robot (RepereBot). Vérifiez l’adresse et que le site est en ligne.', code: 'unreachable' };
    // Vitesse réelle de la page d'accueil si PageSpeed est configuré (sinon l'audit se limite à l'exploration).
    let perf;
    try {
      const { p } = await providersForBusiness(id);
      if (p.perf) perf = await p.perf.measure(crawl.finalOrigin + '/', { devices: ['mobile', 'desktop'] });
    } catch {
      perf = undefined;
    }
    const r = auditBoth(crawl, ws, perf);
    const at = new Date().toISOString();
    const run: SeoRun = { id: `${id}:${at}`, businessId: id, at, demo: false, url: crawl.startUrl, pagesCrawled: crawl.pages.length, truncated: crawl.truncated, durationMs: crawl.durationMs, seo: r.seo, geo: r.geo, pages: r.pages, trigger: 'manual' };
    await putDoc(RUN_COLLECTION, run.id, run, id);
    // Agent de publication : brouillons de corrections à valider (réglages du client ; jamais d'application ici).
    try {
      const { runPublishAgent } = await import('@/lib/publish/agent');
      const findings = [...r.seo.sections, ...r.geo.sections].flatMap((sec) => sec.findings);
      const agent = await runPublishAgent(id, { findings, crawl, name: ws.business.name, trigger: 'crawl' });
      if (agent.status === 'created') revalidatePath('/app/agent');
    } catch (e) {
      log.warn('appseo.agent_failed', { businessId: id, error: e instanceof Error ? e.message : String(e) });
    }
    revalidatePath('/app/seo', 'layout');
    return { ok: true, seo: r.seo.score, geo: r.geo.score, pages: crawl.pages.length, truncated: crawl.truncated };
  } catch (e) {
    log.warn('appseo.crawl_failed', { businessId: id, error: e instanceof Error ? e.message : String(e) });
    return { ok: false, error: 'L’exploration n’a pas abouti. Réessayez dans quelques minutes.', code: 'error' };
  }
}
