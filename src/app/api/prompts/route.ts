/**
 * GET  /api/prompts?businessId=…[&active=true|false][&tag=…][&intent=…][&theme=…][&format=csv]
 *      → { ok, prompts: PromptView[], quota, demo } (ou export CSV si format=csv)
 * POST /api/prompts { businessId, text, theme?, tags?, intent?, active?, origin?, providers? } → { ok, prompt, quota }
 * Comptes démo : lecture seule (403 en écriture).
 */
import { assertEntitled, getEntitlements, requireBusiness } from '@/lib/prompts/adapters';
import { BUSINESS_ID_RE, errorResponse, fail, json, limit, readJson } from '@/lib/prompts/http';
import { exportCsv } from '@/lib/prompts/io';
import { createPrompt, demandContext, ensureInitialPrompts, listPrompts, quotaOf, toView } from '@/lib/prompts/repo';
import type { PromptInput } from '@/lib/prompts/types';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { getLatestAuditForBusiness } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const businessId = sp.get('businessId') ?? '';
    if (!BUSINESS_ID_RE.test(businessId)) return fail(400, 'Identifiant de commerce invalide.');
    const { business } = await requireBusiness(req, businessId);
    await ensureInitialPrompts(business);
    const activeParam = sp.get('active');
    const prompts = await listPrompts(businessId, {
      active: activeParam === 'true' ? true : activeParam === 'false' ? false : undefined,
      tag: sp.get('tag') ?? undefined,
      intent: sp.get('intent') ?? undefined,
      theme: sp.get('theme') ?? undefined,
    });
    const latest = await getLatestAuditForBusiness(businessId).catch(() => null);
    const ctx = demandContext(business, latest?.competitors.map((c) => c.name) ?? []);
    if (sp.get('format') === 'csv') {
      assertEntitled(getEntitlements(business), 'exports');
      const slug = business.name.normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40) || 'commerce';
      return new Response(exportCsv(prompts, ctx), {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="questions-${slug}.csv"`,
          'cache-control': 'no-store',
        },
      });
    }
    const all = activeParam || sp.get('tag') || sp.get('intent') || sp.get('theme') ? await listPrompts(businessId) : prompts;
    return json({
      ok: true,
      prompts: prompts.map((p) => toView(p, ctx)),
      quota: await quotaOf(business, all),
      demo: isDemoBusinessId(businessId),
    });
  } catch (e) {
    return errorResponse(e, '');
  }
}

export async function POST(req: Request) {
  try {
    await limit(req, 'write', 300);
    const body = await readJson(req);
    if (!body) return fail(400, 'Requête invalide.');
    const businessId = typeof body.businessId === 'string' ? body.businessId : '';
    if (!BUSINESS_ID_RE.test(businessId)) return fail(400, 'Identifiant de commerce invalide.');
    const { business } = await requireBusiness(req, businessId, { write: true, minRole: 'member' });
    const input: PromptInput = {
      text: body.text as string,
      theme: typeof body.theme === 'string' ? body.theme : undefined,
      tags: Array.isArray(body.tags) || typeof body.tags === 'string' ? (body.tags as string[]) : undefined,
      intent: body.intent as PromptInput['intent'],
      active: typeof body.active === 'boolean' ? body.active : undefined,
      origin: body.origin === 'suggestion' ? 'suggestion' : 'client',
      queryId: typeof body.queryId === 'string' ? body.queryId : undefined,
      providers: Array.isArray(body.providers) ? (body.providers as PromptInput['providers']) : undefined,
    };
    const prompt = await createPrompt(business, input);
    const latest = await getLatestAuditForBusiness(businessId).catch(() => null);
    return json({ ok: true, prompt: toView(prompt, demandContext(business, latest?.competitors.map((c) => c.name) ?? [])), quota: await quotaOf(business) }, 201);
  } catch (e) {
    return errorResponse(e, '');
  }
}
