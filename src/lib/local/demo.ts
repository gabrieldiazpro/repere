/**
 * Données de démonstration du module LOCAL (lecture seule, calculées à la volée, jamais écrites).
 * Compte `demo` = Plomberie Martin (commerce fictif, docs/05-plan-action.md § 5) ; les autres comptes démo reçoivent
 * la même mécanique à partir de leur espace de démonstration.
 */
import { buildDemoWorkspaceById, isDemoBusinessId } from '@/lib/demo-v2';
import { auditStats, mentionRateOf } from '@/lib/digest/stats';
import { auditGbp, profileFromManual } from './gbp';
import { demoVisibilityMap, planMap } from './map';
import { auditNap } from './nap';
import { directoriesFor } from './directories';
import { planPosts } from './posts';
import { analyzeReviewThemes } from './reviews';
import type { GbpAudit, LocalPost, ManualGbpInput, NapAudit, NapEntryInput, Reminder, ReviewText, ReviewThemesReport, VisibilityMap } from './types';

export interface LocalDemo {
  businessId: string;
  gbp: GbpAudit;
  map: VisibilityMap;
  nap: NapAudit;
  posts: LocalPost[];
  reminders: Reminder[];
  themes: ReviewThemesReport;
  label: string;
}

/** Fiche Google de Plomberie Martin telle que décrite dans le cas fictif (14 avis, pas de posts, description courte). */
export const DEMO_MANUAL: ManualGbpInput = {
  name: 'Plomberie Martin',
  primaryCategory: 'Plombier',
  secondaryCategories: [],
  descriptionLength: 180,
  hasHours: true,
  hoursText: 'Du lundi au vendredi 8 h – 19 h, samedi 9 h – 13 h',
  hasSpecialHours: false,
  servicesCount: 2,
  attributesCount: 1,
  photosCount: 6,
  lastPhotoDaysAgo: 240,
  lastPostDaysAgo: null,
  website: 'plomberie-martin.fr',
  phone: '01 43 55 12 34',
  address: '12 rue Oberkampf, 75011 Paris',
  reviewCount: 14, // = DEMO_REVIEWS.length (vérifié par les tests)
  rating: 4.3, // = moyenne de DEMO_REVIEWS
  lastReviewDaysAgo: 41,
  repliedOfLast: { replied: 3, total: 10 },
};

/** Avis FICTIFS (démonstration), sans nom de client. */
export const DEMO_REVIEWS: ReviewText[] = [
  { rating: 5, text: 'Intervention rapide pour une fuite sous l’évier, travail propre et prix annoncé respecté. Je recommande.' },
  { rating: 5, text: 'Très bon accueil au téléphone, le plombier a bien expliqué la panne du chauffe-eau. Devis clair.' },
  { rating: 4, text: 'Travail soigné mais délai un peu long pour avoir un rendez-vous.' },
  { rating: 2, text: 'Injoignable pendant deux jours, puis arrivé en retard. Le travail est correct mais la communication est à revoir.' },
  { rating: 5, text: 'Débouchage efficace, plombier aimable et ponctuel.' },
  { rating: 3, text: 'Résultat correct, mais un peu cher pour une intervention de 30 minutes.' },
  { rating: 5, text: 'Rapide, efficace, et de bons conseils pour éviter que ça recommence.' },
  { rating: 4, text: 'Bon travail sur la salle de bains, chantier laissé propre. Devis un peu long à recevoir.' },
  { rating: 5, text: 'Remplacement du ballon d’eau chaude dans la journée, explications claires et prix conforme au devis.' },
  { rating: 5, text: 'Plombier sérieux et ponctuel, je le rappellerai sans hésiter.' },
  { rating: 5, text: 'Fuite réparée en moins d’une heure un samedi matin. Merci pour la réactivité.' },
  { rating: 4, text: 'Bon diagnostic sur la chasse d’eau, intervention propre. Un peu d’attente au téléphone.' },
  { rating: 4, text: 'Travail correct et rapide, tarif dans la moyenne du quartier.' },
  { rating: 4, text: 'Installation du mitigeur soignée, rendez-vous obtenu sous trois jours.' },
];
/* Les 14 avis fictifs ci-dessus font la fiche Google démo : même nombre et même note (4,3) sur Fiche Google et Avis. */

const HTML_OK = (name: string, phone: string) => `<html><body><h1>${name}</h1><p>Plombier à Paris 11e</p><p>Tél. ${phone}</p><p>12 rue Oberkampf 75011 Paris</p></body></html>`;

export async function buildLocalDemo(businessId: string, now: Date = new Date()): Promise<LocalDemo | null> {
  if (!isDemoBusinessId(businessId)) return null;
  const ws = buildDemoWorkspaceById(businessId);
  if (!ws) return null;
  const b = ws.business;
  const facts = ws.facts.facts;
  const local = businessId === 'demo';
  const manual: ManualGbpInput = local
    ? DEMO_MANUAL
    : { name: b.name, primaryCategory: b.trade, secondaryCategories: ['Service aux entreprises'], descriptionLength: 420, hasHours: true, hasSpecialHours: false, servicesCount: 4, attributesCount: 2, photosCount: 9, lastPhotoDaysAgo: 120, lastPostDaysAgo: 75, website: b.website, phone: facts.telephone, address: facts.adresse, reviewCount: 23, rating: 4.4, lastReviewDaysAgo: 18, replyRate: 0.6 };
  const gbp = auditGbp(profileFromManual(manual, now, 'demo'), { businessId, businessName: b.name, trade: b.trade, facts, now });

  const plan = planMap({ city: b.city, district: b.district, trade: b.trade }, 'demo', { engines: ['chatgpt', 'perplexity', 'gemini'], zones: 12, providers: ['chatgpt', 'perplexity', 'gemini'] });
  // Carte : même vivier de concurrents que Concurrents et taux centré sur le taux de mention du compte.
  const latest = ws.audits[ws.audits.length - 1];
  const st = auditStats(latest);
  const map = demoVisibilityMap({ businessId, businessName: b.name, trade: b.trade, city: b.city, district: b.district, website: b.website }, plan, now, {
    competitors: st.rows.filter((r) => !r.isMe).slice(0, 5).map((r) => ({ name: r.name, weight: r.mentions })),
    baseRate: mentionRateOf(st),
  });

  const dirs = directoriesFor(b.trade, businessId);
  const phone = facts.telephone ?? '01 43 55 12 34';
  const entries: NapEntryInput[] = local
    ? [
        { directoryId: 'google', present: true, url: 'https://www.google.com/maps/place/?q=place_id:demo' },
        { directoryId: 'pagesjaunes', present: true, listed: { name: 'Plomberie Martin', address: '14 rue Oberkampf, 75011 Paris', phone } },
        { directoryId: 'bing', present: false },
        { directoryId: 'facebook', present: false },
        { directoryId: 'houzz', present: true, url: 'https://www.houzz.fr/pro/plomberie-martin-demo' },
        { directoryId: 'travaux', present: false },
      ]
    : [{ directoryId: 'google', present: true }, { directoryId: 'pagesjaunes', present: true }, { directoryId: 'bing', present: false }];
  const nap = await auditNap(dirs, entries, { name: b.name, address: facts.adresse, phone: facts.telephone, website: b.website }, {
    businessId,
    now,
    demo: true,
    // démo : aucune requête réseau ; Google bloque les robots, Houzz « répond » avec la fiche
    fetcher: async (url) => (url.includes('houzz') ? { status: 200, contentType: 'text/html', body: HTML_OK(b.name, phone) } : { status: 403, contentType: 'text/html', body: '' }),
  });

  const { posts, reminders } = await planPosts({ businessId, businessName: b.name, trade: b.trade, city: b.city, services: facts.services, zone: facts.zone, phone: facts.telephone }, { from: now, count: 4 });
  const themes = analyzeReviewThemes(local ? DEMO_REVIEWS : DEMO_REVIEWS.slice(0, 4), { businessId, businessName: b.name, source: 'demo', replies: 3, now });
  return { businessId, gbp, map, nap, posts, reminders, themes, label: 'Données de démonstration (commerce fictif)' };
}
