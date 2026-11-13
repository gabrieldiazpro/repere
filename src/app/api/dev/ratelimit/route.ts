import { NextResponse } from 'next/server';
import { resetRateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * DEV UNIQUEMENT : vide le compteur mémoire de limitation de débit.
 * `DELETE /api/dev/ratelimit` (tous) ou `?bucket=audit`. Renvoie 404 en production.
 */
export async function DELETE(req: Request) {
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  const bucket = new URL(req.url).searchParams.get('bucket') || undefined;
  return NextResponse.json({ ok: true, cleared: resetRateLimit(bucket) });
}
