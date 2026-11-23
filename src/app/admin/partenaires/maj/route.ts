import { NextResponse } from 'next/server';
import { adminCookie, formNumber as num, sameOrigin } from '@/lib/partners/admin-http';
import {
  addPartnerNote,
  addPartnerPayout,
  isPartnerStatus,
  setPartnerCode,
  setPartnerListed,
  setPartnerStatus,
  setPartnerTerms,
  withdrawListing,
} from '@/lib/partners/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /admin/partenaires/maj : { id, action: status | note | code | terms | listed | payout | withdraw, … }. */
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
      ok = isPartnerStatus(s) && (await setPartnerStatus(id, s)) !== null;
    } else if (action === 'note') ok = (await addPartnerNote(id, String(form?.get('text') ?? ''))) !== null;
    else if (action === 'code') ok = (await setPartnerCode(id, String(form?.get('code') ?? ''))) !== null;
    else if (action === 'terms') ok = (await setPartnerTerms(id, num(form?.get('rate')), num(form?.get('months')))) !== null;
    else if (action === 'listed') ok = (await setPartnerListed(id, String(form?.get('listed') ?? '') === '1')) !== null;
    else if (action === 'payout') ok = (await addPartnerPayout(id, num(form?.get('euros')), String(form?.get('note') ?? ''))) !== null;
    else if (action === 'withdraw') ok = (await withdrawListing(id)) !== null;
  } catch {
    ok = false;
  }
  const back = new URL('/admin/partenaires', req.url);
  if (!ok) back.searchParams.set('erreur', action || 'action');
  back.hash = id;
  return NextResponse.redirect(back, 303);
}
