import { NextResponse } from 'next/server';
import { z } from 'zod';
import { draftReviewReply, draftReviewReplyAsync, loadExecContext } from '@/lib/execution';
import { canEditBusiness } from '@/lib/execution/auth';
import { getBusinessRecord } from '@/lib/db';
import { getEntitlements } from '@/lib/entitlements';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  businessId: z.string().min(1).max(100),
  review: z.object({
    rating: z.number().min(1).max(5),
    text: z.string().max(4000).default(''),
    author: z.string().max(120).optional(),
  }),
});

/** POST /api/exec/review-reply — brouillon de réponse à un avis (à valider avant publication). */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  const rl = await rateLimit('exec-review-reply', getClientIp(req), 60, HOUR_MS);
  if (!rl.ok) return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });
  const { businessId, review } = parsed.data;
  const auth = await canEditBusiness(req, businessId);
  if (!auth.ok) return NextResponse.json({ error: 'Accès refusé.' }, { status: auth.status });
  // Offre Découverte : pas d'exécution (décision 2), appliqué côté serveur (appels LLM payants).
  if (!auth.demo) {
    const b = await getBusinessRecord(businessId).catch(() => null);
    if (b && !getEntitlements(b).execution) {
      return NextResponse.json({ error: 'Cette fonction est disponible avec l’offre Essentiel.', code: 'upgrade_required' }, { status: 402 });
    }
  }
  try {
    const ctx = await loadExecContext(businessId);
    if (!ctx) return NextResponse.json({ error: 'Commerce introuvable.' }, { status: 404 });
    const contact = ctx.facts.facts.telephone ?? ctx.facts.facts.site ?? ctx.business.website;
    // Compte démo : gabarit, jamais de LLM payant (E2).
    const { text, llm } = auth.demo
      ? { text: draftReviewReply(review, { businessName: ctx.business.name, contact }), llm: false }
      : await draftReviewReplyAsync(review, { businessName: ctx.business.name, contact });
    return NextResponse.json({ ok: true, reply: text, llm, note: 'Brouillon : relisez-le avant de le publier.' });
  } catch (e) {
    console.error('[api/exec/review-reply]', e);
    return NextResponse.json({ error: 'Rédaction impossible.' }, { status: 500 });
  }
}
