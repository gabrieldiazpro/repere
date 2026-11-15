import { NextResponse } from 'next/server';
import { assertSameOrigin } from '@/lib/auth/http';
import { isAdmin } from '../../data';
import { addPilotNote, isPilotStatus, linkPilotBusiness, setPilotStatus } from '@/lib/pilots/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /admin/pilotes/maj (formulaires de /admin/pilotes) : { id, action: status | note | link, … }.
 * Cookie admin HttpOnly obligatoire ; même origine.
 *
 * Les pages /admin sont servies avec « Referrer-Policy: no-referrer » : Chrome envoie alors « Origin: null » sur un
 * formulaire POST de même origine. On accepte ce cas seulement si le navigateur atteste Sec-Fetch-Site: same-origin.
 */
function sameOrigin(req: Request): boolean {
  if (req.headers.get('origin') === 'null') return req.headers.get('sec-fetch-site') === 'same-origin';
  try {
    assertSameOrigin(req);
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const token = /(?:^|;\s*)admin_token=([^;]+)/.exec(req.headers.get('cookie') || '')?.[1];
  if (!isAdmin(token ? decodeURIComponent(token) : null)) return new NextResponse('Accès restreint.', { status: 403 });
  if (!sameOrigin(req)) return new NextResponse('Origine refusée.', { status: 403 });
  const form = await req.formData().catch(() => null);
  const id = String(form?.get('id') ?? '');
  const action = String(form?.get('action') ?? '');
  let ok = false;
  try {
    if (action === 'status') {
      const s = String(form?.get('status') ?? '');
      ok = isPilotStatus(s) && (await setPilotStatus(id, s)) !== null;
    } else if (action === 'note') {
      ok = (await addPilotNote(id, String(form?.get('text') ?? ''))) !== null;
    } else if (action === 'link') {
      ok = (await linkPilotBusiness(id, String(form?.get('businessId') ?? ''), String(form?.get('startDate') ?? ''))) !== null;
    }
  } catch {
    ok = false;
  }
  const back = new URL('/admin/pilotes', req.url);
  if (!ok) back.searchParams.set('erreur', action || 'action');
  back.hash = id;
  return NextResponse.redirect(back, 303);
}
