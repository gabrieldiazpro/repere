/**
 * Fiche officielle (V9) — point d'entrée serveur : page publique /p/<slug>, Markdown, llms.txt, encart, export.
 */
import { findBusinessIdBySlug, hostedPageUrl, loadExecContext, type ExecContext } from '../index';
import { buildFaq } from '../jsonld';
import type { FaqItem } from '../types';
import { buildOfficialJsonLd, clientSiteJsonLd } from './jsonld';
import { publicView, toFactsMap, type PublicFiche } from './model';
import { getFiche } from './service';
import type { OfficialFiche } from './types';

export * from './types';
export {
  FICHE_COLLECTION,
  FICHE_FIELDS,
  ESSENTIAL,
  REVERIFY_DAYS,
  completeness,
  credentialLine,
  daysSince,
  nextCheckDue,
  parseCredentials,
  parseServices,
  priceLabel,
  publicView,
  reminderDue,
  sanitizePatch,
  serviceLine,
  migrateFromLegacy,
  syncFromLegacy,
  applyPatch,
  confirmFiche,
  toFactsMap,
  veritePatch,
  contenuFacts,
  type PublicFiche,
  type LegacySources,
} from './model';
export { buildOfficialJsonLd, clientSiteJsonLd, languageCodes } from './jsonld';
export { ficheMarkdown, ficheLlmsTxt, verificationLine, exceptionLine, frDate } from './markdown';
export { embedData, embedScript, embedHtml, embedStaticSnippet, embedScriptSnippet, embedIframeSnippet, embedFramePage, publicationExport, EMBED_MAX_BYTES, type EmbedData, type PublicationExport } from './embed';
export { checkConsistency, type GoogleObservation, type SiteFinding, type Suggestion } from './consistency';
export { extractSiteFacts, readSite, type SiteFetcher } from './site';
export { buildDemoFiche } from './demo';
export { getFiche, saveFiche, confirmOfficialFiche, setPublication, refreshSiteObservation, ficheAlerts, loadObservations, checkFicheReminder, runFicheReminders } from './service';

const SEGMENT_KIND = { local: 'Fiche officielle', pme: 'Présentation officielle', ecommerce: 'Fiche officielle de la marque' } as const;

export function activityOf(ctx: Pick<ExecContext, 'audit' | 'segment' | 'business'>): string {
  const input = ctx.audit?.input;
  if (ctx.segment === 'pme') return input?.offering || input?.category || ctx.business.trade;
  if (ctx.segment === 'ecommerce') return input?.offering || ctx.business.trade;
  const place = [ctx.business.city, ctx.business.district].filter(Boolean).join(' ');
  return `${ctx.business.trade}${place ? ` à ${place}` : ''}`;
}

export interface PublicFicheContext {
  ctx: ExecContext;
  fiche: OfficialFiche;
  view: PublicFiche;
  name: string;
  kind: string;
  activity: string;
  pageUrl: string;
  faq: FaqItem[];
  /** JSON-LD complet de la page (null : compte démo) */
  jsonld: Record<string, unknown> | null;
  /** JSON-LD pour le site du client (encart), seulement si le client l'a activé */
  clientJsonLd: Record<string, unknown> | null;
  /** indexable : vraie entreprise ET opt-in explicite ET page publiée */
  indexable: boolean;
  demo: boolean;
}

export const SLUG_RE = /^[a-z0-9-]{2,60}$/;

/** Contexte public d'un commerce (page, Markdown, llms.txt, encart). null si introuvable ou dépublié. */
export async function loadPublicFicheByBusiness(businessId: string, now = new Date()): Promise<PublicFicheContext | null> {
  const ctx = await loadExecContext(businessId);
  if (!ctx || ctx.settings.published === false) return null;
  const fiche = await getFiche(businessId, now);
  if (!fiche || fiche.businessId !== businessId) return null;
  const demo = ctx.demo || !!fiche.demo;
  const view = publicView(fiche, now);
  const pageUrl = hostedPageUrl(ctx.settings.slug);
  const facts = toFactsMap(view);
  const faq = buildFaq(ctx.audit ?? { input: { businessName: view.text.nom || ctx.business.name, trade: ctx.business.trade, city: ctx.business.city, district: ctx.business.district, segment: ctx.segment } }, facts, ctx.business);
  const jsonld = demo ? null : buildOfficialJsonLd({ fiche: view, business: ctx.business, segment: ctx.segment, pageUrl, schemaType: ctx.settings.schemaType, logoUrl: ctx.settings.logoUrl, faq, demo });
  return {
    ctx,
    fiche,
    view,
    name: view.text.nom || ctx.business.name,
    kind: SEGMENT_KIND[ctx.segment],
    activity: view.text.activite || activityOf(ctx),
    pageUrl,
    faq,
    jsonld,
    clientJsonLd: !demo && fiche.publication.embedJsonLd ? clientSiteJsonLd(jsonld) : null,
    indexable: !demo && fiche.publication.indexable === true,
    demo,
  };
}

export async function loadPublicFiche(slug: string, now = new Date()): Promise<PublicFicheContext | null> {
  if (!SLUG_RE.test(slug)) return null;
  try {
    const id = await findBusinessIdBySlug(slug);
    if (!id) return null;
    const p = await loadPublicFicheByBusiness(id, now);
    return p && p.ctx.settings.slug === slug ? p : null;
  } catch {
    return null;
  }
}
