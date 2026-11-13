import { NextResponse } from 'next/server';
import { getAudit } from '@/lib/db';
import { toPublicAudit } from '@/lib/publicAudit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || id.length > 100) return NextResponse.json({ error: 'Identifiant invalide.' }, { status: 400 });
  try {
    const audit = await getAudit(id);
    if (!audit) return NextResponse.json({ error: 'Rapport introuvable.' }, { status: 404 });
    return NextResponse.json(toPublicAudit(audit), { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch (e) {
    console.error('[api/audit/id]', e);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
