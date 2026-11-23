import { NextResponse } from 'next/server';
import { adminCookie, sameOrigin } from '@/lib/partners/admin-http';
import { addMeetingNote, isMeetingStatus, setMeetingStatus } from '@/lib/meetings/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /admin/partenaires/rendez-vous/maj : { id, action: status | note, … } (cookie admin, même origine). */
export async function POST(req: Request) {
  if (!adminCookie(req)) return new NextResponse('Accès restreint.', { status: 403 });
  if (!sameOrigin(req)) return new NextResponse('Origine refusée.', { status: 403 });
  const form = await req.formData().catch(() => null);
  const id = String(form?.get('id') ?? '');
  const action = String(form?.get('action') ?? '');
  let ok = false;
  try {
    if (action === 'status') {
      const s = String(form?.get('status') ?? '');
      ok = isMeetingStatus(s) && (await setMeetingStatus(id, s)) !== null;
    } else if (action === 'note') ok = (await addMeetingNote(id, String(form?.get('text') ?? ''))) !== null;
  } catch {
    ok = false;
  }
  const back = new URL('/admin/partenaires/rendez-vous', req.url);
  if (!ok) back.searchParams.set('erreur', action || 'action');
  back.hash = id;
  return NextResponse.redirect(back, 303);
}
