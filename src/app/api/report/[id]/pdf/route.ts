import { NextResponse } from 'next/server';
import { getAudit } from '@/lib/db';
import { renderReportPdf } from '@/lib/pdf/Report';
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
  const audit = await getAudit(id);
  if (!audit) return NextResponse.json({ error: 'Audit introuvable' }, { status: 404 });
  try {
    const pdf = await renderReportPdf(audit);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="visibilite-ia-${slugify(audit.input.businessName)}.pdf"`,
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch (e) {
    console.error('[pdf] échec de génération', e);
    return NextResponse.json({ error: 'Génération du PDF impossible' }, { status: 500 });
  }
}
