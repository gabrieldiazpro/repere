/**
 * Pilote automatique — sources serveur : fiche officielle vue par le pilote (faits vérifiés seulement) et préparation
 * des brouillons de contenus à partir des opportunités (agent de contenu V8), dans le contexte d'une tâche planifiée
 * (pas de session) : dernière mesure des IA, pages explorées, constats GEO de l'analyse, faits du client.
 */
import type { SiteCrawl } from '@/lib/crawl/types';
import type { Actor } from '@/lib/publish/types';
import type { FicheView } from './policy';
import type { AutopilotBusiness } from './runner';

/** Faits VÉRIFIÉS de la fiche officielle (valeurs et clés), et date de la dernière confirmation globale. */
export async function ficheForAutopilot(businessId: string): Promise<{ view: FicheView; values: string[] } | null> {
  const { getFiche } = await import('@/lib/execution/fiche');
  const f = await getFiche(businessId);
  if (!f) return null;
  const values: string[] = [];
  const keys: string[] = [];
  for (const [k, t] of Object.entries(f.text)) {
    if (!t?.verified || !t.value) continue;
    keys.push(k);
    values.push(t.value);
  }
  if (f.services?.verified) {
    keys.push('services');
    values.push(...f.services.value.map((s) => s.name));
  }
  if (f.certifications?.verified) {
    keys.push('certifications');
    values.push(...f.certifications.value.flatMap((c) => [c.name, c.number ?? '', c.issuer ?? ''].filter(Boolean)));
  }
  if (f.sameAs?.verified) keys.push('sameAs');
  try {
    const db = await import('@/lib/db');
    const b = await db.getBusinessRecord(businessId);
    if (b?.name) values.push(b.name);
  } catch {
    /* nom absent : les valeurs de la fiche suffisent */
  }
  return { view: { confirmedAt: f.confirmedAt ?? null, verifiedKeys: keys }, values };
}

type AuditLike = { measuredAt?: string; createdAt?: string; queries?: unknown[]; mentions?: unknown[] };

/**
 * Crée au plus `max` brouillons de pages manquantes (création seulement : jamais de réécriture, jamais de page de
 * tarifs), rédigés avec les seuls faits du client. Rien n'est publié ici : la validation sous mandat et le délai de
 * relecture suivent dans le pilote.
 */
export async function prepareContentDrafts(businessId: string, max: number, input: { b: AutopilotBusiness; crawl?: SiteCrawl; findingIds: string[]; actor: Actor; now: Date }): Promise<number> {
  if (max <= 0) return 0;
  const [{ detectOpportunities, mergeFacts, defaultContentWriter }, svc, db] = await Promise.all([import('@/lib/content'), import('@/lib/content/service'), import('@/lib/db')]);
  const raw = (await db.getLatestAuditForBusiness(businessId).catch(() => null)) as AuditLike | null;
  const audit =
    raw && Array.isArray(raw.queries) && Array.isArray(raw.mentions)
      ? ({ measuredAt: raw.measuredAt ?? raw.createdAt ?? input.now.toISOString(), queries: raw.queries, mentions: raw.mentions } as Parameters<typeof detectOpportunities>[0]['audit'])
      : null;
  const pages = (input.crawl?.pages ?? []).filter((p) => p.status === 200).map((p) => ({ url: p.finalUrl || p.url, title: p.title ?? null, h1: p.h1[0] ?? null, words: p.wordCount, indexable: p.isIndexable, depth: p.depth }));
  if (!pages.length) return 0;
  const [drafts, dismissed, stored] = await Promise.all([svc.listDrafts(businessId), svc.listDismissed(businessId).catch(() => []), svc.getFacts(businessId).catch(() => null)]);
  const taken = drafts.filter((d) => d.status !== 'rejected' && d.opportunityId).map((d) => d.opportunityId!);
  const ops = detectOpportunities({
    businessName: input.b.name,
    segment: input.b.segment,
    city: input.b.city ?? undefined,
    trade: input.b.trade ?? undefined,
    audit,
    gsc: null,
    geo: { findingIds: input.findingIds },
    pages,
    crawledAt: input.crawl?.startedAt,
    taken,
    dismissed,
  }).filter((o) => o.action === 'create' && o.pageType !== 'tarifs');
  const site = input.b.website ? `https://${input.b.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}` : input.crawl?.finalOrigin ?? '';
  const facts = mergeFacts(stored?.facts ?? {}, {}, stored?.updatedAt);
  let created = 0;
  for (const op of ops.slice(0, max)) {
    try {
      await svc.createDraft(businessId, op, { name: input.b.name, site, segment: input.b.segment, city: input.b.city ?? undefined, facts, pages, now: input.now, writer: defaultContentWriter() }, input.actor);
      created++;
    } catch {
      /* proposition suivante */
    }
  }
  return created;
}
