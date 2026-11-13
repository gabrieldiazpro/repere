import { NextResponse } from 'next/server';
import { getAudit } from '@/lib/db';
import { buildActionPlan } from '@/lib/engine';
import { renderActionPlanPdf } from '@/lib/pdf/Report';
import { verifyPlanToken } from '@/lib/pdf/sign';
import { slugify } from '@/lib/pdf/derive';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return NextResponse.json({ error: 'Audit introuvable' }, { status: 404 });
  // Rendu PDF coûteux (1–3 s de CPU) : 30 par heure et par IP (qa/securite.md F3).
  const rl = await rateLimit('pdf', getClientIp(req), 30, HOUR_MS);
  if (!rl.ok) return NextResponse.json({ error: 'Trop de téléchargements, réessayez plus tard.' }, { status: 429 });
  const token = new URL(req.url).searchParams.get('token');
  if (!verifyPlanToken(id, token)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  const audit = await getAudit(id);
  if (!audit) return NextResponse.json({ error: 'Audit introuvable' }, { status: 404 });
  try {
    const pdf = await renderActionPlanPdf(audit, buildActionPlan(audit));
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="plan-action-${slugify(audit.input.businessName)}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    console.error('[plan] échec de génération', e);
    return NextResponse.json({ error: 'Génération du PDF impossible' }, { status: 500 });
  }
}
