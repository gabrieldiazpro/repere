/**
 * ChangeSets (propositions de modifications).
 * GET  /api/v5/publish/changesets?businessId=&status=proposed,validated   → { changeSets, demo }
 * POST /api/v5/publish/changesets { businessId, findings: Finding[], site: PlanSite }  (member) → { changeSets, skipped }
 *      Planifie des brouillons (aucune écriture chez le client). Comptes démo : 403.
 */
import { z } from 'zod';
import { HttpError } from '@/lib/auth';
import { CHANGESET_STATUSES, createChangeSets, listChangeSets, type ChangeSetStatus, type Finding, type PlanSite } from '@/lib/publish';
import { summarizeChange } from '@/lib/publish/model';
import { access, assertSameOrigin, body, handle, json, limit } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FindingZ = z.object({
  id: z.string().min(1).max(120),
  category: z.string().max(60).default(''),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).default('medium'),
  title: z.string().max(300),
  why: z.string().max(1000).default(''),
  fix: z.string().max(1000).default(''),
  affected: z.array(z.object({ url: z.string().max(2000), detail: z.string().max(2000).optional() })).max(200).default([]),
  affectedCount: z.number().int().nonnegative().default(0),
  impact: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
  effort: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
  autoFix: z.object({ kind: z.string().max(40), payload: z.unknown() }).optional(),
  evidence: z.string().max(2000).optional(),
});

const PageZ = z.object({
  url: z.string().url().max(2000),
  title: z.string().max(500).optional(),
  metaDescription: z.string().max(1000).optional(),
  h1: z.array(z.string().max(500)).max(10).optional(),
  canonical: z.string().max(2000).optional(),
  images: z.array(z.object({ src: z.string().max(2000), alt: z.string().max(500).optional() })).max(200).optional(),
  text: z.string().max(20_000).optional(),
  isIndexable: z.boolean().optional(),
});

const SiteZ = z.object({
  origin: z.string().url().max(300),
  name: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  robotsTxt: z.string().max(100_000).nullable().optional(),
  llmsTxt: z.string().max(100_000).nullable().optional(),
  pages: z.array(PageZ).max(300).default([]),
});

export async function GET(req: Request) {
  return handle(async () => {
    const u = new URL(req.url);
    const { businessId, demo } = await access(req, u.searchParams.get('businessId'));
    const status = (u.searchParams.get('status') ?? '').split(',').filter((s): s is ChangeSetStatus => (CHANGESET_STATUSES as readonly string[]).includes(s));
    const list = await listChangeSets(businessId, status.length ? { status } : {});
    return json({ changeSets: list.map((cs) => ({ ...cs, changes: cs.changes.map((c) => summarizeChange(c, 600)) })), demo });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const b = await body(req);
    await limit(req, 'publish-plan', 60);
    const { businessId, actor } = await access(req, b.businessId, { write: true });
    const findings = z.array(FindingZ).min(1).max(100).safeParse(b.findings);
    const site = SiteZ.safeParse(b.site);
    if (!findings.success) throw new HttpError(400, 'Constats invalides.');
    if (!site.success) throw new HttpError(400, 'Description du site invalide.');
    const plan = await createChangeSets(businessId, findings.data as Finding[], { ...(site.data as Omit<PlanSite, 'businessId'>), businessId }, actor);
    return json(plan, { status: 201 });
  });
}
