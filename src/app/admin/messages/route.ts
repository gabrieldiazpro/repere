import { NextResponse } from 'next/server';
import { assertSameOrigin } from '@/lib/auth/http';
import { isAdmin } from '../data';
import { setAnswered } from '../messages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /admin/messages (formulaire de l'écran d'administration) : { id, answered: "1" | "0" }.
 * Cookie admin HttpOnly obligatoire ; même origine (le cookie est SameSite=Strict, on revérifie l'en-tête Origin).
 */
export async function POST(req: Request) {
  const token = /(?:^|;\s*)admin_token=([^;]+)/.exec(req.headers.get('cookie') || '')?.[1];
  if (!isAdmin(token ? decodeURIComponent(token) : null)) return new NextResponse('Accès restreint.', { status: 403 });
  try {
    assertSameOrigin(req);
  } catch {
    return new NextResponse('Origine refusée.', { status: 403 });
  }
  const form = await req.formData().catch(() => null);
  const id = String(form?.get('id') ?? '');
  const answered = String(form?.get('answered') ?? '1') === '1';
  const ok = await setAnswered(id, answered).catch(() => false);
  return NextResponse.redirect(new URL(ok ? '/admin#messages' : '/admin?erreur=message#messages', req.url), 303);
}
