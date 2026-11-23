/** Outils communs des routes /api/fiche/* (accès, erreurs, données d'écran). */
import { NextResponse } from 'next/server';
import { canEditBusiness } from '@/lib/execution/auth';
import { DEMO_READ_ONLY } from '@/lib/demo-v2';
import { getSettings, hostedPageUrl } from '@/lib/execution';
import {
  FicheError,
  completeness,
  embedData,
  embedHtml,
  embedIframeSnippet,
  embedScriptSnippet,
  embedStaticSnippet,
  ficheAlerts,
  getFiche,
  loadPublicFicheByBusiness,
  nextCheckDue,
  publicView,
  type FicheActor,
  type OfficialFiche,
} from '@/lib/execution/fiche';
import { SITE_URL } from '@/lib/seo/site';

export const ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

export function err(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

export function fail(e: unknown, where: string) {
  if (e instanceof FicheError) return err(e.status, e.message, { code: e.code, ...(e.errors ? { errors: e.errors } : {}) });
  console.error(`[api/fiche] ${where}`, e);
  return err(500, 'Opération impossible pour le moment. Réessayez dans un instant.');
}

/** Accès en écriture (membre au moins ; administrateur pour la publication). Démo : 403 explicite. */
export async function writer(req: Request, businessId: string, minRole: 'member' | 'admin' = 'member'): Promise<{ ok: true; actor: FicheActor } | { ok: false; res: Response }> {
  if (!ID_RE.test(businessId)) return { ok: false, res: err(400, 'businessId manquant ou invalide.') };
  const a = await canEditBusiness(req, businessId, { write: true, minRole });
  if (!a.ok) return { ok: false, res: err(a.status ?? 403, a.demo ? DEMO_READ_ONLY : 'Accès refusé.', { demo: !!a.demo }) };
  return { ok: true, actor: { id: a.userId ?? 'owner' } };
}

export async function reader(req: Request, businessId: string): Promise<{ ok: true; demo: boolean } | { ok: false; res: Response }> {
  if (!ID_RE.test(businessId)) return { ok: false, res: err(400, 'businessId manquant ou invalide.') };
  const a = await canEditBusiness(req, businessId);
  if (!a.ok) return { ok: false, res: err(a.status ?? 403, 'Accès refusé.') };
  return { ok: true, demo: !!a.demo };
}

const SITE = SITE_URL.replace(/\/$/, '');

/** Tout ce dont l'écran /app/fiche a besoin (aussi utilisé côté serveur par la page). */
export async function ficheScreenData(businessId: string, now = new Date()) {
  const fiche = await getFiche(businessId, now);
  if (!fiche) return null;
  return screenDataFor(businessId, fiche, now);
}

export async function screenDataFor(businessId: string, fiche: OfficialFiche, now = new Date()) {
  const [pub, { alerts, suggestions, observations }] = await Promise.all([loadPublicFicheByBusiness(businessId, now), ficheAlerts(businessId, fiche, now)]);
  const settings = pub?.ctx.settings ?? (await getSettings(businessId));
  const pageUrl = hostedPageUrl(settings.slug);
  const view = publicView(fiche, now);
  const data = embedData(view, pub?.name ?? fiche.text.nom?.value ?? '', pageUrl);
  const segment = pub?.ctx.segment ?? 'local';
  return {
    fiche,
    view,
    segment,
    published: settings.published !== false,
    slug: settings.slug,
    pageUrl,
    markdownUrl: `${pageUrl}.md`,
    llmsUrl: `${pageUrl}/llms.txt`,
    alerts,
    suggestions,
    observations: { site: observations.site, google: observations.google, iaCheckedAt: observations.ia?.checkedAt ?? null },
    completeness: completeness(fiche, segment),
    nextCheck: nextCheckDue(fiche),
    hasJsonLd: !!pub?.jsonld,
    embed: {
      data,
      previewHtml: embedHtml(data),
      script: embedScriptSnippet(`${SITE}/encart/${settings.slug}/e.js`),
      iframe: embedIframeSnippet(`${SITE}/encart/${settings.slug}`, data.n),
      html: embedStaticSnippet(data, pub?.clientJsonLd ?? null),
    },
  };
}
export type FicheScreenData = NonNullable<Awaited<ReturnType<typeof ficheScreenData>>>;
