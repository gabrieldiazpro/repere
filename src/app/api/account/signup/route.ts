/**
 * POST /api/account/signup { email, name, segment, website?, city?, trade?, audit?, analysis?, ref?, suite? } — inscription à l'offre Découverte (gratuite).
 * Le compte est créé non confirmé ; l'espace est créé au clic sur le lien magique (adresse prouvée), à partir d'un
 * jeton signé lié à cette adresse : aucune donnée d'entreprise n'est écrite avant confirmation.
 */
import { toResponse } from '@/lib/auth';
import { analysisSignupDefaults, signupClaimToken } from '@/lib/auth/claims';
import { sanitizeAttribution } from '@/lib/roi/attribution';
import { authMode } from '@/lib/auth/config';
import { assertSameOrigin, json, limit, readJson, str } from '@/lib/auth/http';
import { startBrowserLogin } from '@/lib/auth/magic';
import { HttpError } from '@/lib/auth/roles';
import { ensureUser, isEmail, normEmail } from '@/lib/auth/users';
import type { Segment } from '@/lib/engine/types-v2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SEGMENTS: Segment[] = ['local', 'pme', 'ecommerce'];

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await limit(req, 'auth-signup', 5);
    const body = await readJson(req);
    if (!isEmail(body.email)) throw new HttpError(400, 'Cette adresse e-mail semble incomplète. Vérifiez-la, par exemple vous@exemple.fr.');
    // Inscription depuis une analyse 60 s (V5) : nom, type et site repris de l'analyse si elle a été demandée avec cette adresse.
    const analysis = str(body.analysis, 80) || undefined;
    const fromAnalysis = analysis ? await analysisSignupDefaults(analysis, normEmail(body.email)) : null;
    const name = str(body.name, 120) || fromAnalysis?.name || '';
    if (name.length < 2) throw new HttpError(400, 'Indiquez le nom de votre entreprise.');
    const segment = SEGMENTS.includes(body.segment as Segment) ? (body.segment as Segment) : (fromAnalysis?.segment ?? null);
    if (!segment) throw new HttpError(400, 'Choisissez votre parcours : commerce local, PME ou e-commerce.');
    let website = str(body.website, 200) || fromAnalysis?.website || '';
    if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
    if (website) {
      try {
        website = new URL(website).toString();
      } catch {
        throw new HttpError(400, 'L’adresse du site semble incorrecte.');
      }
    }
    if (authMode() === 'off') throw new HttpError(503, 'L’inscription est momentanément indisponible.', 'auth_unavailable');
    const email = normEmail(body.email);
    await ensureUser(email);
    const claim = signupClaimToken({
      email,
      name,
      segment,
      website: website || undefined,
      city: str(body.city, 80) || undefined,
      trade: str(body.trade, 80) || undefined,
      audit: str(body.audit, 80) || undefined,
      analysis,
      ref: str(body.ref, 20) || undefined,
      suite: body.suite === 'carte' ? 'carte' : undefined,
      // Origine de la visite (première page / UTM, sans cookie) : validée dans le jeton, gardée à la création de l'espace.
      src: sanitizeAttribution(body.attribution),
    });
    const r = await startBrowserLogin(email, { next: '/app', claim });
    if (!r.ok) {
      console.warn('[auth] envoi du lien d’inscription impossible', r.error);
      throw new HttpError(502, 'L’envoi n’a pas fonctionné. Réessayez dans un instant.');
    }
    return json({ ok: true, ...(r.devLink ? { devLink: r.devLink } : {}) }, { cookies: r.cookies });
  } catch (e) {
    return toResponse(e, 'api/account/signup');
  }
}
