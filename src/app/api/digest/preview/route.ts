/**
 * Aperçu du digest du lundi : GET /api/digest/preview?businessId=…[&format=html]
 * JSON (digest + objet + texte) par défaut ; `format=html` renvoie l'e-mail tel qu'il sera reçu. Aucun envoi.
 */
import { NextResponse } from 'next/server';
import { canAccessBusiness } from '@/lib/db';
import { buildWeeklyDigest, doneUrl } from '@/lib/digest';
import { renderWeeklyDigestEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const businessId = url.searchParams.get('businessId');
  if (!businessId || !/^[A-Za-z0-9_-]{1,100}$/.test(businessId)) {
    return NextResponse.json({ error: 'businessId manquant ou invalide.' }, { status: 400 });
  }
  const auth = await canAccessBusiness(req, businessId);
  if (!auth.ok) return NextResponse.json({ error: 'Accès refusé.' }, { status: auth.status });

  try {
    const digest = await buildWeeklyDigest(businessId);
    const to = auth.business.contactEmail || 'apercu@exemple.fr';
    const email = renderWeeklyDigestEmail(to, digest, { done: (taskId) => doneUrl(businessId, taskId) });
    if (url.searchParams.get('format') === 'html') {
      return new Response(email.html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    }
    return NextResponse.json({ digest, email: { subject: email.subject, preheader: email.preheader, text: email.text } });
  } catch (e) {
    console.error('[api/digest/preview]', e);
    return NextResponse.json({ error: 'Aperçu indisponible.' }, { status: 500 });
  }
}
