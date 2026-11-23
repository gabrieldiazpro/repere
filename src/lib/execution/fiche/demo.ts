/**
 * Fiche officielle des comptes démo (Plomberie Martin, Paysia, Maison Sora) : construite à partir des MÊMES faits que
 * les autres écrans démo (fiche de vérité démo, fiche Google démo, site démo exploré), étiquetée démo, jamais
 * indexable, jamais de JSON-LD. Rien n'est enregistré.
 */
import { buildDemoWorkspaceById, isDemoBusinessId, type DemoId } from '@/lib/demo-v2';
import { migrateFromLegacy, parseServices } from './model';
import type { HoursException, OfficialFiche, ServiceItem, SiteObservation, TextKey } from './types';
import { extractSiteFacts } from './site';
import type { GoogleObservation } from './consistency';

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString();

/** Prochaines dates fixes (Noël, jour de l'an) à partir d'aujourd'hui. */
function nextHolidays(now: Date): HoursException[] {
  const y = now.getUTCFullYear();
  const xmas = `${y}-12-25` >= now.toISOString().slice(0, 10) ? `${y}-12-25` : `${y + 1}-12-25`;
  const ny = `${y + 1}-01-01`;
  return [
    { from: xmas, closed: true, label: 'Noël' },
    { from: ny, closed: true, label: 'Jour de l’an' },
  ];
}

interface DemoExtra {
  text: Partial<Record<TextKey, string>>;
  services?: ServiceItem[];
  /** jours écoulés depuis la dernière confirmation (null = jamais confirmée) */
  confirmedDaysAgo: number | null;
  exceptions?: boolean;
}

const EXTRA: Record<DemoId, DemoExtra> = {
  demo: {
    text: {
      activite: 'Plombier chauffagiste à Paris 11e : dépannage, débouchage, chauffe-eau et salles de bains',
      garanties: 'Devis gratuit et écrit avant toute intervention ; garantie pièces et main-d’œuvre 2 ans ; assurance décennale',
      paiement: 'Carte bancaire, virement, chèque, espèces',
      langues: 'Français, anglais',
      delais: 'Intervention en urgence dans la journée ; devis sous 48 h',
    },
    services: [
      { name: 'Dépannage de fuite', priceFrom: 89, unit: 'TTC' },
      { name: 'Débouchage', priceFrom: 89, unit: 'TTC' },
      { name: 'Remplacement de chauffe-eau' },
      { name: 'Rénovation de salle de bains' },
    ],
    confirmedDaysAgo: 52,
    exceptions: true,
  },
  'demo-pme': {
    text: {
      activite: 'Logiciel de paie en ligne pour les PME de 10 à 250 salariés',
      paiement: 'Prélèvement SEPA, carte bancaire, virement',
      langues: 'Français',
      delais: 'Mise en place en 2 semaines en moyenne',
    },
    services: [{ name: 'Paie', priceFrom: 8, unit: 'HT par bulletin et par mois' }, { name: 'DSN' }, { name: 'Gestion des absences et congés' }, { name: 'Notes de frais' }, { name: 'Portail salarié' }],
    confirmedDaysAgo: 97,
  },
  'demo-ecom': {
    text: {
      activite: 'Cosmétiques solides sans emballage plastique, fabriqués dans notre atelier lyonnais',
      paiement: 'Carte bancaire, PayPal',
      langues: 'Français',
      garanties: 'Retours gratuits sous 30 jours, produit non entamé',
    },
    services: [
      { name: 'Shampoing solide', priceFrom: 12.9, unit: 'TTC' },
      { name: 'Déodorant solide', priceFrom: 9.9, unit: 'TTC' },
    ],
    confirmedDaysAgo: 20,
  },
};

export function buildDemoFiche(businessId: string, now = new Date()): OfficialFiche | null {
  if (!isDemoBusinessId(businessId)) return null;
  const ws = buildDemoWorkspaceById(businessId);
  if (!ws) return null;
  const x = EXTRA[businessId];
  const confirmedAt = x.confirmedDaysAgo === null ? undefined : iso(now.getTime() - x.confirmedDaysAgo * DAY);
  const base = migrateFromLegacy(
    {
      businessId,
      business: { name: ws.business.name, website: ws.business.website, trade: ws.business.trade },
      verite: { facts: ws.facts.facts, updatedAt: ws.facts.updatedAt },
    },
    confirmedAt ?? ws.facts.updatedAt,
  );
  const at = confirmedAt ?? ws.facts.updatedAt;
  const verified = !!confirmedAt;
  const meta = { source: 'client' as const, at, verified, ...(verified ? { verifiedAt: at } : {}) };
  for (const [k, v] of Object.entries(x.text) as [TextKey, string][]) base.text[k] = { value: v, ...meta };
  for (const k of Object.keys(base.text) as TextKey[]) base.text[k] = { ...base.text[k]!, ...meta, value: base.text[k]!.value };
  base.services = { value: x.services ?? parseServices(ws.facts.facts.services), ...meta };
  if (base.certifications) base.certifications = { ...base.certifications, ...meta };
  if (x.exceptions) base.exceptions = { value: nextHolidays(now), ...meta };
  return {
    ...base,
    confirmedAt,
    confirmedBy: confirmedAt ? 'démo' : undefined,
    publication: { indexable: false, embedJsonLd: false },
    updatedAt: at,
    demo: true,
  };
}

/** Fiche Google démo : la même saisie guidée que l'écran Fiche Google démo (src/lib/local/demo.ts). */
export async function demoGoogle(businessId: string, now = new Date()): Promise<GoogleObservation | null> {
  if (!isDemoBusinessId(businessId)) return null;
  const { DEMO_MANUAL } = await import('@/lib/local/demo');
  const ws = buildDemoWorkspaceById(businessId);
  if (!ws) return null;
  const at = iso(now.getTime() - 9 * DAY);
  if (businessId === 'demo') return { at, name: DEMO_MANUAL.name, phone: DEMO_MANUAL.phone, address: DEMO_MANUAL.address, website: DEMO_MANUAL.website, hoursText: DEMO_MANUAL.hoursText };
  return { at, name: ws.business.name, phone: ws.facts.facts.telephone, address: ws.facts.facts.adresse, website: ws.business.website };
}

/** Site démo : lu sur l'exploration de démonstration (même site que l'écran SEO et GEO démo). */
export async function demoSite(businessId: string, now = new Date()): Promise<SiteObservation | null> {
  if (!isDemoBusinessId(businessId)) return null;
  try {
    const { demoSiteCrawl } = await import('@/lib/seoaudit/demo-crawl');
    const crawl = demoSiteCrawl(businessId, undefined, now);
    const pick = crawl.pages.filter((p) => p.html && (/\/$|\/contact$/.test(new URL(p.url).pathname) || new URL(p.url).pathname === '/')).slice(0, 2);
    const facts = extractSiteFacts(pick.map((p) => ({ url: p.url, html: p.html! })));
    return { url: crawl.startUrl, at: crawl.startedAt, pages: pick.map((p) => p.url), errors: [], ...facts };
  } catch {
    return null;
  }
}
