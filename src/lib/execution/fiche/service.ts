/**
 * Fiche officielle — lecture, enregistrement, miroir vers les anciennes fiches, observations (site, fiche Google, IA),
 * rappel de vérification tous les 90 jours. Serveur uniquement.
 *
 * Garanties : comptes démo jamais écrits (403) ; tout document lu est contrôlé (businessId identique : aucune fuite
 * entre espaces) ; les anciennes collections ne sont jamais vidées (miroir champ par champ des seuls faits touchés).
 */
import { getBusiness, getLatestAuditForBusiness } from '@/lib/db';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { isHouseBusinessId } from '@/lib/house';
import { getDoc, listDocs, putDoc } from '@/lib/store';
import type { FactCheckItem } from '@/lib/engine/types-v2';
import { checkConsistency, type GoogleObservation, type SiteFinding } from './consistency';
import { buildDemoFiche, demoGoogle, demoSite } from './demo';
import {
  applyPatch,
  confirmFiche,
  contenuFacts,
  FICHE_COLLECTION,
  migrateFromLegacy,
  reminderDue,
  reminderKey,
  sanitizePatch,
  syncFromLegacy,
  veritePatch,
  type LegacySources,
} from './model';
import { readSite, type SiteFetcher } from './site';
import { FicheError, type FicheActor, type FicheAlert, type OfficialFiche, type SiteObservation } from './types';

const DEMO_MSG = 'Compte de démonstration : rien n’est enregistré.';

function assertWritable(businessId: string) {
  if (isDemoBusinessId(businessId)) throw new FicheError(403, DEMO_MSG, 'demo_read_only');
}

async function legacyOf(businessId: string): Promise<LegacySources | null> {
  const business = await getBusiness(businessId);
  if (!business) return null;
  const [{ getFacts }, { getFacts: getContentFacts }, { SETTINGS_COLLECTION }] = await Promise.all([import('@/lib/facts'), import('@/lib/content/service'), import('../repo')]);
  const [verite, contenu, settings] = await Promise.all([
    getFacts(businessId).catch(() => null),
    getContentFacts(businessId).catch(() => null),
    getDoc<{ businessId: string; sameAs?: string[]; updatedAt?: string }>(SETTINGS_COLLECTION, businessId).catch(() => null),
  ]);
  return {
    businessId,
    business: { name: business.name, website: business.website, trade: business.trade },
    verite: verite && verite.businessId === businessId && Object.keys(verite.facts ?? {}).length ? { facts: verite.facts, updatedAt: verite.updatedAt } : null,
    contenu: contenu && contenu.businessId === businessId && Object.keys(contenu.facts ?? {}).length ? { facts: contenu.facts, updatedAt: contenu.updatedAt } : null,
    settings: settings && settings.data.businessId === businessId ? { sameAs: settings.data.sameAs, updatedAt: settings.data.updatedAt } : null,
  };
}

/**
 * Fiche officielle du commerce. Première lecture : migration douce depuis les anciennes fiches (enregistrée). Lectures
 * suivantes : les changements faits depuis dans /app/verite ou /app/contenu/faits sont repris.
 */
export async function getFiche(businessId: string, now = new Date()): Promise<OfficialFiche | null> {
  if (isDemoBusinessId(businessId)) return buildDemoFiche(businessId, now);
  const [doc, legacy] = await Promise.all([getDoc<OfficialFiche>(FICHE_COLLECTION, businessId), legacyOf(businessId)]);
  if (!legacy) return null;
  const stored = doc && doc.data.businessId === businessId ? doc.data : null;
  if (!stored) {
    const fiche = migrateFromLegacy(legacy, now.toISOString());
    // Compte maison (Repéré) : page officielle déjà publiée et liée depuis le site (V6) : indexable par défaut.
    if (isHouseBusinessId(businessId)) fiche.publication = { ...fiche.publication, indexable: true, indexableAt: now.toISOString() };
    await putDoc(FICHE_COLLECTION, businessId, fiche, businessId);
    return fiche;
  }
  const { fiche, changed } = syncFromLegacy(stored, legacy);
  if (changed.length) await putDoc(FICHE_COLLECTION, businessId, fiche, businessId);
  return fiche;
}

async function store(fiche: OfficialFiche): Promise<OfficialFiche> {
  await putDoc(FICHE_COLLECTION, fiche.businessId, fiche, fiche.businessId);
  const { clearSchemaCache } = await import('../index');
  clearSchemaCache(fiche.businessId);
  return fiche;
}

/** Recopie les faits touchés dans la fiche de vérité, les faits clés et les réglages (sameAs). Jamais bloquant. */
async function mirror(fiche: OfficialFiche, touched: Set<string>, actor: FicheActor): Promise<string[]> {
  const warnings: string[] = [];
  const id = fiche.businessId;
  try {
    const patch = veritePatch(fiche, touched);
    if (Object.keys(patch).length) {
      const { saveFacts, validateFacts, refreshFactCheck } = await import('@/lib/facts');
      const v = validateFacts(patch);
      const ok = v.ok ? patch : Object.fromEntries(Object.entries(patch).filter(([k]) => !(k in v.errors)));
      if (!v.ok) warnings.push(`Fiche Vérité : ${Object.keys(v.errors).join(', ')} non recopié(s) (format refusé).`);
      if (Object.keys(ok).length) {
        const saved = await saveFacts(id, ok);
        await refreshFactCheck(id, saved).catch(() => null);
      }
    }
  } catch (e) {
    warnings.push('Fiche Vérité non mise à jour.');
    console.warn('[fiche] miroir facts.brand', e instanceof Error ? e.message : e);
  }
  try {
    const { getFacts, saveFacts } = await import('@/lib/content/service');
    const prev = await getFacts(id);
    await saveFacts(id, contenuFacts(fiche, prev?.facts ?? {}), { id: actor.id, email: actor.email ?? undefined });
  } catch (e) {
    warnings.push('Faits clés de l’agent de contenu non mis à jour.');
    console.warn('[fiche] miroir content.facts', e instanceof Error ? e.message : e);
  }
  if (touched.has('sameAs')) {
    try {
      const { saveSettings } = await import('../repo');
      await saveSettings(id, { sameAs: fiche.sameAs?.value ?? [] });
    } catch (e) {
      warnings.push('Liens officiels non recopiés dans les réglages.');
      console.warn('[fiche] miroir exec.settings', e instanceof Error ? e.message : e);
    }
  }
  return warnings;
}

export async function saveFiche(businessId: string, input: unknown, actor: FicheActor, now = new Date()): Promise<{ fiche: OfficialFiche; warnings: string[] }> {
  assertWritable(businessId);
  const patch = sanitizePatch(input);
  const prev = await getFiche(businessId, now);
  if (!prev) throw new FicheError(404, 'Commerce introuvable.', 'not_found');
  const next = applyPatch(prev, patch, actor, now.toISOString());
  const touched = new Set<string>([...Object.keys(patch.text ?? {}), ...(patch.accept ?? []).map((a) => a.key)]);
  for (const k of ['services', 'certifications', 'exceptions', 'sameAs'] as const) if (patch[k] !== undefined) touched.add(k);
  await store(next);
  const warnings = await mirror(next, touched, actor);
  return { fiche: next, warnings };
}

export async function confirmOfficialFiche(businessId: string, actor: FicheActor, now = new Date()): Promise<OfficialFiche> {
  assertWritable(businessId);
  const prev = await getFiche(businessId, now);
  if (!prev) throw new FicheError(404, 'Commerce introuvable.', 'not_found');
  if (!Object.keys(prev.text).length) throw new FicheError(400, 'Remplissez au moins un fait avant de confirmer.', 'empty');
  return store(confirmFiche(prev, actor, now.toISOString()));
}

export async function setPublication(businessId: string, input: { indexable?: unknown; embedJsonLd?: unknown }, now = new Date()): Promise<OfficialFiche> {
  assertWritable(businessId);
  const prev = await getFiche(businessId, now);
  if (!prev) throw new FicheError(404, 'Commerce introuvable.', 'not_found');
  const pub = { ...prev.publication };
  if (typeof input.indexable === 'boolean') {
    pub.indexable = input.indexable;
    pub.indexableAt = input.indexable ? now.toISOString() : undefined;
  }
  if (typeof input.embedJsonLd === 'boolean') pub.embedJsonLd = input.embedJsonLd;
  return store({ ...prev, publication: pub, updatedAt: now.toISOString() });
}

/** « Relire mon site » : observation rangée dans la fiche (jamais publiée telle quelle). */
export async function refreshSiteObservation(businessId: string, fetcher?: SiteFetcher, now = new Date()): Promise<OfficialFiche> {
  assertWritable(businessId);
  const prev = await getFiche(businessId, now);
  if (!prev) throw new FicheError(404, 'Commerce introuvable.', 'not_found');
  const site = prev.text.site?.value ?? (await getBusiness(businessId))?.website;
  if (!site) throw new FicheError(400, 'Renseignez d’abord l’adresse de votre site.', 'no_site');
  const obs = await readSite(site, now, fetcher);
  return store({ ...prev, observed: { ...(prev.observed ?? {}), site: obs } });
}

// ---------------------------------------------------------------------------
// Observations et alertes
// ---------------------------------------------------------------------------
export interface Observations {
  site: SiteObservation | null;
  siteFindings: SiteFinding[];
  google: GoogleObservation | null;
  ia: { checkedAt: string; items: FactCheckItem[] } | null;
}

async function realGoogle(businessId: string): Promise<GoogleObservation | null> {
  try {
    const { getLocalSettings } = await import('@/lib/local/repo');
    const s = await getLocalSettings(businessId);
    if (s.businessId !== businessId || !s.manual) return null;
    const m = s.manual;
    if (!m.name && !m.phone && !m.address && !m.website && !m.hoursText) return null;
    return { at: s.updatedAt, name: m.name, phone: m.phone, address: m.address, website: m.website, hoursText: m.hoursText };
  } catch {
    return null;
  }
}

async function realSiteFindings(businessId: string): Promise<SiteFinding[]> {
  try {
    const docs = await listDocs<{ businessId: string; at: string; geo?: { sections?: { id: string; findings: { id: string; title: string }[] }[] } }>('appseo.run', { businessId, limit: 1, order: 'desc' });
    const run = docs[0]?.data;
    if (!run || run.businessId !== businessId) return [];
    return (run.geo?.sections ?? [])
      .filter((s) => s.id === 'entite')
      .flatMap((s) => s.findings)
      .filter((f) => /^geo\.entite\.(facts_phone|facts_address)$/.test(f.id))
      .map((f) => ({ id: f.id, title: f.title, at: run.at }));
  } catch {
    return [];
  }
}

async function iaCheck(businessId: string): Promise<Observations['ia']> {
  try {
    if (isDemoBusinessId(businessId)) {
      const { loadExecContext } = await import('../context');
      const ctx = await loadExecContext(businessId);
      const fc = ctx?.audit?.factCheck;
      return fc ? { checkedAt: ctx?.audit?.measuredAt ?? fc.checkedAt, items: fc.items } : null;
    }
    const { getLatestFactCheck } = await import('@/lib/facts');
    const fc = await getLatestFactCheck(businessId);
    if (!fc || fc.businessId !== businessId) return null;
    const audit = await getLatestAuditForBusiness(businessId).catch(() => null);
    return { checkedAt: (audit as { measuredAt?: string } | null)?.measuredAt ?? fc.report.checkedAt, items: fc.report.items };
  } catch {
    return null;
  }
}

export async function loadObservations(businessId: string, fiche: OfficialFiche, now = new Date()): Promise<Observations> {
  const demo = isDemoBusinessId(businessId);
  const [site, siteFindings, google, ia] = await Promise.all([
    demo ? demoSite(businessId, now) : Promise.resolve(fiche.observed?.site ?? null),
    demo ? Promise.resolve([]) : realSiteFindings(businessId),
    demo ? demoGoogle(businessId, now) : realGoogle(businessId),
    iaCheck(businessId),
  ]);
  return { site: site ?? null, siteFindings, google, ia };
}

export async function ficheAlerts(businessId: string, fiche: OfficialFiche, now = new Date()): Promise<{ alerts: FicheAlert[]; suggestions: ReturnType<typeof checkConsistency>['suggestions']; observations: Observations }> {
  const observations = await loadObservations(businessId, fiche, now);
  const r = checkConsistency({ fiche, site: observations.site, siteFindings: observations.siteFindings, google: observations.google, ia: observations.ia });
  return { ...r, observations };
}

// ---------------------------------------------------------------------------
// Rappel de vérification tous les 90 jours (centre de notifications existant)
// ---------------------------------------------------------------------------
export async function checkFicheReminder(businessId: string, now = new Date(), fiche?: OfficialFiche | null): Promise<boolean> {
  if (isDemoBusinessId(businessId)) return false;
  const f = fiche ?? (await getFiche(businessId, now));
  if (!f || f.businessId !== businessId || !reminderDue(f, now)) return false;
  const { addNotification } = await import('@/lib/notify/center');
  const n = await addNotification(
    businessId,
    {
      type: 'actions_reminder',
      title: f.confirmedAt ? 'Votre fiche officielle a plus de 90 jours : vérifiez-la' : 'Confirmez votre fiche officielle',
      body: 'Horaires, prix, téléphone : vérifiez que tout est à jour, puis cliquez sur « Je confirme que c’est à jour ». Google et les IA reprennent ces informations.',
      href: '/app/fiche',
      severity: 'info',
      dedupeKey: reminderKey(f, now),
    },
    now,
  );
  return !!n;
}

/** Tous les commerces ayant une fiche (tâche planifiée /api/fiche/rappels). */
export async function runFicheReminders(now = new Date()): Promise<{ checked: number; notified: number }> {
  const docs = await listDocs<OfficialFiche>(FICHE_COLLECTION, { limit: 5000 });
  let notified = 0;
  for (const d of docs) {
    const f = d.data;
    if (!f?.businessId || isDemoBusinessId(f.businessId)) continue;
    if (await checkFicheReminder(f.businessId, now, f).catch(() => false)) notified++;
  }
  return { checked: docs.length, notified };
}
