/**
 * GET /api/fiche/export?businessId=… — blocs « À propos » et « Contact » (Markdown et HTML) et JSON-LD, pour l'agent
 * de publication (pages du site du client) ou un copier-coller. JSON-LD null pour un compte démo.
 */
import { NextResponse } from 'next/server';
import { clientSiteJsonLd, loadPublicFicheByBusiness, publicationExport } from '@/lib/execution/fiche';
import { err, fail, reader } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const businessId = new URL(req.url).searchParams.get('businessId') ?? '';
  const a = await reader(req, businessId);
  if (!a.ok) return a.res;
  try {
    const p = await loadPublicFicheByBusiness(businessId);
    if (!p) return err(404, 'Fiche introuvable ou page dépubliée.');
    return NextResponse.json({ demo: p.demo, ...publicationExport(p.view, p.name, p.pageUrl, clientSiteJsonLd(p.jsonld)) });
  } catch (e) {
    return fail(e, 'export');
  }
}
