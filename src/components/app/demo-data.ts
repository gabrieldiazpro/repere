/**
 * Données démo V2 de REPLI de l'espace client (périmètre APP).
 * Utilisées seulement quand un module V2 (demo-v2, execution, tracking, facts, digest) n'est pas disponible
 * ou échoue. Déterministes, réalistes, toujours étiquetées « démo ». Les concurrents sont fictifs.
 * Base : createMockAudit (moteur), enrichie des champs AuditResultV2Ext.
 */
import { createMockAudit, type AuditInput, type AuditResult, type CompetitorStat, type MentionResult, type ProviderId, type QuerySpec } from '@/lib/engine';
import type {
  AiEngine,
  AiTrafficDay,
  AiTrafficSummary,
  AuditResultV2Ext,
  BrandClaim,
  BrandFactField,
  BrandFacts,
  BrandQuote,
  CompetitorGap,
  DomainStat,
  ExecTask,
  FactCheckItem,
  PerceptionReport,
  Segment,
  SourceCategory,
  SourceOpportunity,
  SourcesReport,
  WeeklyDigest,
} from '@/lib/engine/types-v2';

export type V2Audit = AuditResult & AuditResultV2Ext;

export interface WorkspaceBusiness {
  id: string;
  segment: Segment;
  name: string;
  /** « Plombier · Paris 11ᵉ » */
  descriptor: string;
  /** « plombiers du 11ᵉ » */
  cohort: string;
  website: string;
  slug: string;
  planLabel: string;
  planPrice: string;
}

// ---------------------------------------------------------------------------
// Aléa déterministe
// ---------------------------------------------------------------------------
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const round2 = (x: number) => Math.round(x * 1000) / 1000;
const clamp = (x: number) => Math.max(0, Math.min(100, Math.round(x)));

// ---------------------------------------------------------------------------
// Graines par parcours
// ---------------------------------------------------------------------------
type DomainSeed = [domain: string, label: string, category: SourceCategory, citations: number, presence: 'present' | 'absent' | 'unknown', competitors: string[], providers: ProviderId[]];

interface Seed {
  business: WorkspaceBusiness;
  input: AuditInput;
  providers: ProviderId[];
  queries: [string, QuerySpec['intent']][];
  scores: number[];
  me: number[];
  comps: [string, number, number][];
  newCompetitor: string;
  domains: DomainSeed[];
  quotes: [ProviderId, string, string, BrandQuote['sentiment']][];
  themes: string[];
  sentiment: PerceptionReport['sentiment'];
  facts: Partial<Record<BrandFactField, string>>;
  checks: [BrandFactField, string, ProviderId, string, FactCheckItem['verdict'], FactCheckItem['severity']][];
  reasons: Record<string, string[]>;
  traffic: { base: Partial<Record<AiEngine, number>>; total: number; pages: [string, AiEngine][]; convRate: number };
}

const LOCAL: Seed = {
  business: {
    id: 'demo',
    segment: 'local',
    name: 'Plomberie Martin',
    descriptor: 'Plombier · Paris 11ᵉ',
    cohort: 'plombiers du 11ᵉ',
    website: 'plomberie-martin.fr',
    slug: 'plomberie-martin',
    planLabel: 'Local',
    planPrice: '49 € par mois',
  },
  input: { businessName: 'Plomberie Martin', trade: 'plombier', city: 'Paris', district: '11e', website: 'plomberie-martin.fr' },
  providers: ['chatgpt', 'gemini', 'perplexity'],
  queries: [
    ['Quel est le meilleur plombier à Paris 11e ?', 'best'],
    ['Plombier en urgence près de Bastille un dimanche', 'urgent'],
    ['Un plombier fiable près de Voltaire ?', 'nearby'],
    ['Recherche de fuite à Paris 11 : qui appeler ?', 'specific'],
    ['Plombier pas cher et sérieux dans le 11e', 'best'],
    ['Avis sur les plombiers d’Oberkampf', 'review'],
    ['Remplacement de chauffe-eau à Paris 11', 'specific'],
    ['Débouchage de canalisation Paris 11e rapide', 'urgent'],
  ],
  scores: [18, 27, 33, 42, 52, 61],
  me: [0.03, 0.05, 0.07, 0.09, 0.11, 0.13],
  comps: [
    ['Dupont & Fils Plomberie', 0.19, 0.18],
    ['Allo Plombier 11', 0.12, 0.15],
    ['SOS Bastille Plomberie', 0.1, 0.14],
    ['Plomberie Voltaire', 0.12, 0.11],
    ['Les Artisans de Charonne', 0.09, 0.08],
    ['Hydro Services Paris', 0.07, 0.07],
    ['Plombier Oberkampf', 0.06, 0.06],
    ['Maison Leclerc Plomberie', 0.05, 0.05],
    ['ProFuite Paris', 0.03, 0.04],
    ['Atelier Roquette', 0.04, 0.03],
  ],
  newCompetitor: "Plomb'Express",
  domains: [
    ['pagesjaunes.fr', 'PagesJaunes', 'annuaire', 24, 'absent', ['Dupont & Fils Plomberie', 'Allo Plombier 11', 'SOS Bastille Plomberie'], ['chatgpt', 'perplexity']],
    ['travaux.com', 'Travaux.com', 'comparatif', 15, 'absent', ['Dupont & Fils Plomberie', 'Plomberie Voltaire'], ['chatgpt', 'perplexity']],
    ['plomberie-martin.fr', 'Votre site', 'client', 13, 'present', [], ['chatgpt', 'perplexity']],
    ['reddit.com', 'Reddit', 'forum', 11, 'absent', ['Allo Plombier 11'], ['perplexity', 'chatgpt']],
    ['leparisien.fr', 'Le Parisien', 'media_local', 10, 'absent', ['SOS Bastille Plomberie', 'Dupont & Fils Plomberie'], ['perplexity']],
    ['trustpilot.com', 'Trustpilot', 'avis', 9, 'unknown', ['Allo Plombier 11'], ['chatgpt']],
    ['allo-plombier-11.fr', 'Allo Plombier 11', 'concurrent', 9, 'absent', ['Allo Plombier 11'], ['chatgpt', 'perplexity']],
    ['habitatpresto.com', 'Habitatpresto', 'comparatif', 8, 'absent', ['Plomberie Voltaire', 'Hydro Services Paris'], ['chatgpt']],
    ['starofservice.com', 'StarOfService', 'marketplace', 7, 'present', ['Les Artisans de Charonne'], ['perplexity']],
    ['quechoisir.org', 'Que Choisir', 'media_national', 6, 'absent', [], ['chatgpt', 'perplexity']],
    ['yelp.fr', 'Yelp', 'avis', 5, 'present', ['Dupont & Fils Plomberie'], ['perplexity']],
    ['mappy.com', 'Mappy', 'annuaire', 5, 'unknown', ['SOS Bastille Plomberie'], ['chatgpt']],
    ['118712.fr', '118 712', 'annuaire', 4, 'absent', ['Dupont & Fils Plomberie'], ['chatgpt']],
    ['mairie11.paris.fr', 'Mairie du 11ᵉ', 'institutionnel', 3, 'absent', [], ['perplexity']],
    ['fr.wikipedia.org', 'Wikipédia', 'wikipedia', 2, 'absent', [], ['claude']],
  ],
  quotes: [
    ['perplexity', 'Plombier en urgence près de Bastille un dimanche', 'Plomberie Martin est souvent citée pour sa réactivité : plusieurs avis mentionnent une intervention en moins d’une heure, y compris le week-end.', 'positif'],
    ['chatgpt', 'Quel est le meilleur plombier à Paris 11e ?', 'Parmi les plombiers bien notés du 11e, on trouve Dupont & Fils, Allo Plombier 11 et Plomberie Martin, appréciée pour ses devis clairs.', 'positif'],
    ['gemini', 'Plombier en urgence près de Bastille un dimanche', 'Plomberie Martin est ouvert du lundi au samedi de 8 h à 20 h.', 'negatif'],
    ['chatgpt', 'Plombier pas cher et sérieux dans le 11e', 'Plomberie Martin affiche un déplacement à 49 € et des interventions à partir de 89 € TTC, devis gratuit.', 'neutre'],
    ['perplexity', 'Recherche de fuite à Paris 11 : qui appeler ?', 'Pour une recherche de fuite non destructive, Plomberie Martin et ProFuite Paris disposent de caméras thermiques.', 'positif'],
    ['gemini', 'Avis sur les plombiers d’Oberkampf', 'Les avis sur Plomberie Martin sont positifs mais peu nombreux par rapport à ses concurrents du quartier.', 'neutre'],
  ],
  themes: ['réactivité', 'devis clairs', 'peu d’avis', 'prix dans la moyenne', 'urgences'],
  sentiment: { positif: 0.58, neutre: 0.29, negatif: 0.13 },
  // Fiche de vérité : identique à celle du moteur (src/lib/engine/providers/mock-v2.ts, KNOWN_FACTS) et de demo-v2.
  facts: {
    adresse: '12 rue Oberkampf, 75011 Paris',
    telephone: '01 43 55 12 34',
    horaires: 'Du lundi au vendredi 8 h – 19 h, samedi 9 h – 13 h ; urgences 7 j/7',
    prix: 'Déplacement 49 € ; intervention à partir de 89 € TTC ; devis gratuit',
    zone: 'Paris 11e, 10e, 12e et 20e',
    services: 'Dépannage de fuite, débouchage, remplacement de chauffe-eau, rénovation de salle de bains',
    dirigeant: 'Julien Martin',
    creation: '2009',
    site: 'plomberie-martin.fr',
    statut: 'ouvert',
  },
  checks: [
    ['horaires', 'du lundi au samedi de 8 h à 20 h', 'gemini', 'Plomberie Martin est ouvert du lundi au samedi de 8 h à 20 h.', 'faux', 'haute'],
    ['prix', 'Déplacement 49 €', 'chatgpt', 'Plomberie Martin affiche un déplacement à 49 € et des interventions à partir de 89 € TTC, devis gratuit.', 'correct', 'haute'],
    ['telephone', '01 43 55 12 34', 'perplexity', 'Vous pouvez joindre Plomberie Martin au 01 43 55 12 34.', 'correct', 'haute'],
    ['adresse', '12 rue Oberkampf, 75011 Paris', 'chatgpt', 'L’atelier se trouve 12 rue Oberkampf, dans le 11e.', 'correct', 'haute'],
  ],
  reasons: {
    'Dupont & Fils Plomberie': ['Fiche PagesJaunes complète avec 212 avis', 'Cité par Le Parisien dans un article sur les dépannages abusifs', 'Horaires d’urgence publiés sur Google et sur son site'],
    'Allo Plombier 11': ['Recommandé dans 3 fils Reddit r/paris', 'Page « urgence 24 h/24 » avec balisage schema.org', 'Note Trustpilot 4,6 sur 380 avis'],
    'SOS Bastille Plomberie': ['Présent sur PagesJaunes et Mappy', 'Les IA le citent comme ouvert le dimanche (vous aussi, mais elles ne le savent pas)', 'Article du Parisien de septembre'],
  },
  traffic: {
    base: { chatgpt: 2.4, perplexity: 1.1, gemini: 0.6, copilot: 0.3, claude: 0.15 },
    total: 95,
    pages: [['/', 'chatgpt'], ['/urgence-plombier-paris-11', 'perplexity'], ['/recherche-de-fuite', 'chatgpt'], ['/p/plomberie-martin', 'chatgpt'], ['/chauffe-eau', 'gemini'], ['/contact', 'chatgpt']],
    convRate: 0.09,
  },
};

const PME: Seed = {
  business: {
    id: 'demo-pme',
    segment: 'pme',
    name: 'Paysia',
    descriptor: 'Logiciel de paie pour PME · France',
    cohort: 'logiciels de paie cités par les IA',
    website: 'paysia.fr',
    slug: 'paysia',
    planLabel: 'PME',
    planPrice: '179 € par mois',
  },
  input: { businessName: 'Paysia', trade: 'logiciel de paie', city: 'Paris', website: 'paysia.fr' },
  providers: ['chatgpt', 'gemini', 'perplexity', 'claude'],
  queries: [
    ['Quel est le meilleur logiciel de paie pour une PME de 50 salariés ?', 'best'],
    ['Alternative à Salaria moins chère', 'specific'],
    ['Logiciel de paie compatible DSN avec support en français', 'specific'],
    ['Comparatif des logiciels de paie 2026', 'best'],
    ['Paysia avis', 'review'],
    ['Externaliser la paie ou prendre un logiciel ?', 'specific'],
    ['Logiciel de paie avec API pour un SIRH', 'specific'],
    ['Logiciel de paie pour cabinet comptable', 'best'],
  ],
  scores: [24, 28, 31, 35, 38, 44],
  me: [0.04, 0.05, 0.05, 0.06, 0.07, 0.08],
  comps: [
    ['Salaria', 0.22, 0.21],
    ['Paylo', 0.15, 0.17],
    ['Netpaie', 0.12, 0.12],
    ['Clairpaie', 0.1, 0.1],
    ['Ondine RH', 0.09, 0.09],
    ['Bulletin Pro', 0.08, 0.07],
    ['Kaliopaie', 0.06, 0.06],
    ['Fiche&Co', 0.05, 0.05],
    ['RH Sereine', 0.04, 0.04],
    ['Payroll Nord', 0.03, 0.03],
  ],
  newCompetitor: 'Talenza',
  domains: [
    ['g2.com', 'G2', 'avis', 31, 'present', ['Salaria', 'Paylo', 'Netpaie'], ['chatgpt', 'perplexity', 'claude']],
    ['capterra.fr', 'Capterra', 'comparatif', 27, 'absent', ['Salaria', 'Paylo', 'Clairpaie'], ['chatgpt', 'perplexity']],
    ['appvizer.fr', 'Appvizer', 'comparatif', 19, 'absent', ['Salaria', 'Netpaie'], ['perplexity', 'chatgpt']],
    ['journaldunet.com', 'Journal du Net', 'media_national', 14, 'absent', ['Salaria'], ['perplexity', 'claude']],
    ['paysia.fr', 'Votre site', 'client', 12, 'present', [], ['chatgpt', 'perplexity', 'claude']],
    ['reddit.com', 'Reddit', 'forum', 11, 'absent', ['Paylo', 'Netpaie'], ['perplexity', 'chatgpt']],
    ['lesechos.fr', 'Les Echos', 'media_national', 9, 'absent', ['Salaria', 'Ondine RH'], ['perplexity']],
    ['salaria.fr', 'Salaria', 'concurrent', 9, 'absent', ['Salaria'], ['chatgpt', 'claude']],
    ['getapp.fr', 'GetApp', 'comparatif', 8, 'unknown', ['Paylo'], ['chatgpt']],
    ['linkedin.com', 'LinkedIn', 'reseau_social', 7, 'present', ['Paylo', 'Clairpaie'], ['perplexity']],
    ['compta-online.com', 'Compta Online', 'forum', 6, 'absent', ['Netpaie', 'Kaliopaie'], ['chatgpt', 'perplexity']],
    ['net-entreprises.fr', 'Net-entreprises', 'institutionnel', 5, 'absent', [], ['claude', 'chatgpt']],
    ['trustpilot.com', 'Trustpilot', 'avis', 4, 'unknown', ['Paylo'], ['chatgpt']],
    ['fr.wikipedia.org', 'Wikipédia', 'wikipedia', 3, 'absent', ['Salaria'], ['claude']],
  ],
  quotes: [
    ['claude', 'Logiciel de paie avec API pour un SIRH', 'Paysia propose une API documentée et des connecteurs vers les principaux SIRH, ce qui en fait une option intéressante pour les PME déjà équipées.', 'positif'],
    ['chatgpt', 'Quel est le meilleur logiciel de paie pour une PME de 50 salariés ?', 'Pour 50 salariés, Salaria et Paylo sont les choix les plus cités. Paysia est une alternative plus récente, appréciée pour son accompagnement.', 'neutre'],
    ['perplexity', 'Alternative à Salaria moins chère', 'Paysia est souvent présentée comme une alternative à Salaria, avec un tarif à partir de 8 € HT par bulletin.', 'positif'],
    ['chatgpt', 'Paysia avis', 'Quelques utilisateurs regrettent des fonctionnalités encore limitées pour les grandes structures.', 'negatif'],
    ['gemini', 'Comparatif des logiciels de paie 2026', 'Paysia coûte environ 15 € par mois ; c’est un éditeur parisien fondé en 2018, qui cible les PME de 10 à 250 salariés.', 'neutre'],
    ['perplexity', 'Logiciel de paie compatible DSN avec support en français', 'Les utilisateurs de Paysia saluent un support réactif en français et une mise en place en moins d’un mois.', 'positif'],
  ],
  themes: ['accompagnement', 'API et intégrations', 'alternative moins chère', 'prix (information fausse)', 'éditeur récent'],
  sentiment: { positif: 0.5, neutre: 0.33, negatif: 0.17 },
  facts: {
    site: 'paysia.fr',
    adresse: '48 rue de la Chaussée-d’Antin, 75009 Paris',
    prix: 'À partir de 8 € HT par bulletin et par mois, sans frais de mise en place',
    services: 'Paie, DSN, gestion des absences et congés, notes de frais, portail salarié',
    clients: 'PME de 10 à 250 salariés ; 1 200 entreprises clientes',
    zone: 'France entière',
    dirigeant: 'Claire Dubois',
    creation: '2018',
    statut: 'en activité',
  },
  checks: [
    ['prix', 'environ 15 € par mois', 'gemini', 'Paysia coûte environ 15 € par mois.', 'faux', 'haute'],
    ['prix', 'À partir de 8 € HT par bulletin', 'perplexity', 'Paysia est souvent présentée comme une alternative à Salaria, avec un tarif à partir de 8 € HT par bulletin.', 'correct', 'haute'],
    ['creation', 'Fondé en 2018', 'gemini', 'Paysia est un éditeur parisien fondé en 2018.', 'correct', 'basse'],
  ],
  reasons: {
    Salaria: ['Fiche Capterra avec 640 avis et un badge « meilleur rapport qualité-prix »', 'Page Wikipédia et articles des Echos', 'Page « Salaria vs autres » sur son site, très citée par ChatGPT'],
    Paylo: ['Recommandé dans 4 fils Reddit et Compta Online', 'Présent sur Capterra, GetApp et Appvizer', 'Livre blanc DSN repris par Journal du Net'],
    Netpaie: ['Classé dans 3 comparatifs Appvizer', 'Documentation publique de son API, citée par Claude'],
  },
  traffic: {
    base: { chatgpt: 9, perplexity: 5.5, gemini: 2.2, copilot: 2.8, claude: 1.6, other_ai: 0.4 },
    total: 820,
    pages: [['/', 'chatgpt'], ['/alternative-salaria', 'perplexity'], ['/tarifs', 'chatgpt'], ['/api', 'claude'], ['/dsn', 'copilot'], ['/p/paysia', 'perplexity'], ['/demo', 'chatgpt']],
    convRate: 0.04,
  },
};

const ECOM: Seed = {
  business: {
    id: 'demo-ecom',
    segment: 'ecommerce',
    name: 'Maison Sora',
    descriptor: 'Cosmétiques solides · boutique en ligne',
    cohort: 'marques de cosmétiques solides',
    website: 'maison-sora.fr',
    slug: 'maison-sora',
    planLabel: 'E-commerce',
    planPrice: '249 € par mois',
  },
  input: { businessName: 'Maison Sora', trade: 'cosmétiques solides', city: 'Lyon', website: 'maison-sora.fr' },
  providers: ['chatgpt', 'gemini', 'perplexity', 'claude'],
  queries: [
    ['Meilleur shampoing solide pour cheveux bouclés', 'best'],
    ['Déodorant solide efficace sans bicarbonate', 'specific'],
    ['Alternative au gel douche en bouteille plastique', 'specific'],
    ['Crème visage solide bio : laquelle choisir ?', 'best'],
    ['Coffret cosmétiques zéro déchet à offrir', 'specific'],
    ['Maison Sora avis', 'review'],
    ['Shampoing solide fabriqué en France', 'best'],
    ['Dentifrice solide vraiment efficace ?', 'specific'],
  ],
  scores: [31, 36, 40, 47, 51, 58],
  me: [0.06, 0.08, 0.1, 0.11, 0.13, 0.15],
  comps: [
    ['Savonnerie Alba', 0.2, 0.19],
    ['Pain de Lune', 0.15, 0.16],
    ['Solide & Sens', 0.14, 0.13],
    ['Atelier Brume', 0.1, 0.11],
    ['Galet Cosmetics', 0.08, 0.09],
    ['Nuée Paris', 0.07, 0.06],
    ['Bloc Beauté', 0.06, 0.05],
    ['Kerbio', 0.05, 0.05],
    ['Oh Solid!', 0.04, 0.04],
    ['Céleste Zéro', 0.03, 0.03],
  ],
  newCompetitor: "Terre d'Iroise",
  domains: [
    ['amazon.fr', 'Amazon', 'marketplace', 26, 'present', ['Savonnerie Alba', 'Pain de Lune', 'Solide & Sens'], ['chatgpt', 'perplexity']],
    ['reddit.com', 'Reddit', 'forum', 21, 'absent', ['Pain de Lune', 'Atelier Brume'], ['perplexity', 'chatgpt']],
    ['marieclaire.fr', 'Marie Claire', 'media_national', 17, 'absent', ['Savonnerie Alba', 'Solide & Sens'], ['chatgpt', 'perplexity']],
    ['maison-sora.fr', 'Votre site', 'client', 16, 'present', [], ['chatgpt', 'perplexity', 'claude']],
    ['incibeauty.com', 'INCI Beauty', 'comparatif', 14, 'absent', ['Savonnerie Alba', 'Galet Cosmetics'], ['perplexity', 'chatgpt']],
    ['60millions-mag.com', '60 Millions de consommateurs', 'media_national', 11, 'absent', ['Pain de Lune'], ['perplexity']],
    ['sephora.fr', 'Sephora', 'marketplace', 9, 'absent', ['Savonnerie Alba'], ['chatgpt']],
    ['trustpilot.com', 'Trustpilot', 'avis', 8, 'present', ['Pain de Lune'], ['chatgpt']],
    ['youtube.com', 'YouTube', 'reseau_social', 7, 'unknown', ['Solide & Sens', 'Atelier Brume'], ['perplexity', 'gemini']],
    ['savonnerie-alba.fr', 'Savonnerie Alba', 'concurrent', 7, 'absent', ['Savonnerie Alba'], ['chatgpt']],
    ['doctissimo.fr', 'Doctissimo', 'forum', 6, 'absent', ['Kerbio'], ['chatgpt']],
    ['quechoisir.org', 'Que Choisir', 'media_national', 5, 'absent', [], ['perplexity']],
    ['instagram.com', 'Instagram', 'reseau_social', 4, 'present', ['Nuée Paris'], ['gemini']],
    ['fr.wikipedia.org', 'Wikipédia', 'wikipedia', 2, 'absent', [], ['claude']],
  ],
  quotes: [
    ['perplexity', 'Meilleur shampoing solide pour cheveux bouclés', 'Le shampoing « Onde » de Maison Sora revient souvent dans les avis pour les cheveux bouclés : il ne graisse pas et dure environ 60 lavages.', 'positif'],
    ['chatgpt', 'Coffret cosmétiques zéro déchet à offrir', 'Maison Sora propose des cosmétiques solides sans plastique, fabriqués à Lyon : shampoing solide à 12,90 €.', 'positif'],
    ['gemini', 'Maison Sora avis', 'Chez Maison Sora, la livraison est offerte dès 60 €, en France uniquement.', 'negatif'],
    ['gemini', 'Déodorant solide efficace sans bicarbonate', 'Plusieurs marques proposent des déodorants sans bicarbonate, dont Pain de Lune et Maison Sora.', 'neutre'],
    ['claude', 'Shampoing solide fabriqué en France', 'Maison Sora fabrique ses produits dans son atelier lyonnais, sans emballage plastique.', 'positif'],
    ['perplexity', 'Crème visage solide bio : laquelle choisir ?', 'La crème solide de Maison Sora est appréciée, mais certains avis la trouvent un peu chère au gramme.', 'neutre'],
  ],
  themes: ['cheveux bouclés', 'fabriqué à Lyon', 'sans plastique', 'prix au gramme', 'livraison (information fausse)'],
  sentiment: { positif: 0.62, neutre: 0.25, negatif: 0.13 },
  facts: {
    site: 'maison-sora.fr',
    produits: 'Shampoings, après-shampoings, déodorants et soins visage solides, sans emballage plastique',
    prix: 'Shampoing solide 12,90 € ; déodorant solide 9,90 €',
    livraison: 'France et Belgique ; offerte dès 39 € ; expédition sous 48 h',
    retours: 'Retours gratuits sous 30 jours, produit non entamé',
    ingredients: 'Ingrédients d’origine naturelle, sans sulfates ni silicones ; liste INCI complète sur chaque fiche produit',
    certifications: 'Cosmos Organic (Ecocert) ; vegan',
    adresse: '7 rue Burdeau, 69001 Lyon (atelier, pas de boutique)',
    creation: '2020',
    dirigeant: 'Inès Morel',
    statut: 'en activité',
  },
  checks: [
    ['livraison', 'offerte dès 60 € ; France uniquement', 'gemini', 'Chez Maison Sora, la livraison est offerte dès 60 €, en France uniquement.', 'faux', 'haute'],
    ['prix', 'Shampoing solide 12,90 €', 'chatgpt', 'Maison Sora propose des cosmétiques solides sans plastique, fabriqués à Lyon : shampoing solide à 12,90 €.', 'correct', 'haute'],
    ['adresse', 'Atelier lyonnais', 'claude', 'Maison Sora fabrique ses produits dans son atelier lyonnais.', 'correct', 'moyenne'],
    ['produits', 'Shampoing « Onde » pour cheveux bouclés', 'perplexity', 'Le shampoing « Onde » de Maison Sora revient souvent dans les avis pour les cheveux bouclés.', 'correct', 'basse'],
  ],
  reasons: {
    'Savonnerie Alba': ['Fiches produit avec données Product complètes (prix, avis, disponibilité)', 'Sélectionné dans 2 articles de Marie Claire', 'Vendu chez Sephora'],
    'Pain de Lune': ['Recommandé dans 5 fils Reddit r/ZeroWaste et r/conseilsbeaute', 'Testé par 60 Millions de consommateurs', 'Note Trustpilot 4,7 sur 1 900 avis'],
    'Solide & Sens': ['Vidéos YouTube de comparaison citées par Perplexity', 'Fiche INCI Beauty notée « excellente »'],
  },
  traffic: {
    base: { chatgpt: 28, perplexity: 11, gemini: 6, copilot: 3, claude: 2.5, other_ai: 1.2 },
    total: 4200,
    pages: [['/produits/shampoing-onde', 'perplexity'], ['/', 'chatgpt'], ['/coffrets', 'chatgpt'], ['/produits/deodorant-sans-bicarbonate', 'gemini'], ['/p/maison-sora', 'chatgpt'], ['/livraison', 'chatgpt'], ['/produits/creme-visage-solide', 'claude']],
    convRate: 0.031,
  },
};

const SEEDS: Record<Segment, Seed> = { local: LOCAL, pme: PME, ecommerce: ECOM };

export function seedFor(segment: Segment) {
  return SEEDS[segment];
}

// ---------------------------------------------------------------------------
// Audits (6 mois)
// ---------------------------------------------------------------------------
const CATEGORY_ACTION: Record<SourceCategory, { action: (l: string) => string; how: (l: string, b: WorkspaceBusiness) => string[]; effort: 'S' | 'M' | 'L' }> = {
  annuaire: {
    action: (l) => `Créer votre fiche ${l}`,
    how: (l, b) => [
      `Créez ou revendiquez votre fiche gratuite sur ${l}.`,
      `Reprenez exactement le nom, l’adresse et le téléphone de votre fiche de vérité (${b.name}).`,
      'Ajoutez vos services, des photos récentes et vos horaires, urgences comprises.',
    ],
    effort: 'S',
  },
  avis: {
    action: (l) => `Activer et alimenter votre page ${l}`,
    how: (l) => [`Revendiquez votre page ${l}.`, 'Envoyez le kit de demande d’avis à vos clients récents, sans incitation ni filtrage.', 'Répondez à chaque avis sous 48 h.'],
    effort: 'M',
  },
  comparatif: {
    action: (l) => `Être référencé sur ${l}`,
    how: (l) => [`Créez votre profil vendeur sur ${l}.`, 'Remplissez les critères de comparaison (prix, délais, garanties) avec vos chiffres réels.', 'Demandez à 5 clients de laisser un avis vérifié.'],
    effort: 'M',
  },
  forum: {
    action: (l) => `Répondre utilement sur ${l}`,
    how: (l) => [`Repérez les 3 discussions de ${l} citées par les IA (liens dans l’audit).`, 'Répondez en votre nom, en déclarant votre activité, avec un conseil concret.', 'Pas de message publicitaire ni de faux compte : les modérateurs et les IA les écartent.'],
    effort: 'S',
  },
  media_local: {
    action: (l) => `Proposer un sujet à ${l}`,
    how: (l) => [`Identifiez le ou la journaliste qui couvre votre quartier à ${l}.`, 'Proposez un angle utile (conseil saisonnier, chiffre local), pas un publireportage.', 'Joignez votre fiche de vérité et une photo.'],
    effort: 'L',
  },
  media_national: {
    action: (l) => `Proposer une expertise à ${l}`,
    how: (l) => [`Repérez les articles de ${l} cités par les IA pour vos questions.`, 'Proposez une donnée ou un avis d’expert à la rédaction, avec sources.', 'Ajoutez la page de presse à votre site, balisée.'],
    effort: 'L',
  },
  marketplace: {
    action: (l) => `Compléter votre présence sur ${l}`,
    how: (l) => [`Vérifiez votre fiche ${l} : titre, description, prix, disponibilité.`, 'Alignez les caractéristiques sur votre fiche de vérité.', 'Ajoutez des photos et demandez des avis vérifiés.'],
    effort: 'M',
  },
  reseau_social: {
    action: (l) => `Publier un contenu de référence sur ${l}`,
    how: (l) => [`Publiez sur ${l} un contenu pratique qui répond à une question posée aux IA.`, 'Mentionnez clairement votre nom et votre site dans la description.'],
    effort: 'M',
  },
  wikipedia: {
    action: () => 'Vérifier votre admissibilité à Wikipédia',
    how: () => ['Wikipédia exige des sources secondaires indépendantes : ne créez pas votre propre page.', 'Obtenez d’abord des articles de presse, puis proposez la création à un contributeur.'],
    effort: 'L',
  },
  institutionnel: {
    action: (l) => `Être listé sur ${l}`,
    how: (l) => [`Vérifiez si ${l} tient un annuaire des professionnels ou des partenaires.`, 'Envoyez votre demande avec vos justificatifs (SIRET, assurance, labels).'],
    effort: 'M',
  },
  concurrent: { action: (l) => l, how: () => [], effort: 'L' },
  client: { action: (l) => l, how: () => [], effort: 'S' },
  autre: { action: (l) => `Être présent sur ${l}`, how: (l) => [`Contactez ${l} pour figurer dans la page citée.`], effort: 'M' },
};

function providerList(ps: ProviderId[]) {
  const names = ps.map((p) => ({ chatgpt: 'ChatGPT', perplexity: 'Perplexity', gemini: 'Gemini', claude: 'Claude', mistral: 'Mistral (Le Chat)' })[p]);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} et ${names.at(-1)}` : names[0];
}

function buildSources(seed: Seed, answers: number): SourcesReport {
  const total = seed.domains.reduce((s, d) => s + d[3], 0);
  const q = seed.queries;
  const domains: DomainStat[] = seed.domains.map(([domain, label, category, citations, presence, competitors, providers], i) => ({
    domain,
    label,
    category,
    citations,
    citationShare: round2(citations / total),
    providers,
    queries: [`q${(i % q.length) + 1}`, `q${((i + 3) % q.length) + 1}`],
    clientPresence: presence,
    competitorsPresent: competitors,
    sampleUrls: [`https://${domain}/`],
  }));
  const byCategory: Partial<Record<SourceCategory, number>> = {};
  for (const d of domains) byCategory[d.category] = (byCategory[d.category] ?? 0) + d.citations;
  const opportunities: SourceOpportunity[] = domains
    .filter((d) => d.clientPresence !== 'present' && d.category !== 'concurrent' && d.category !== 'client')
    .map((d, i) => {
      const ca = CATEGORY_ACTION[d.category];
      const q1 = q[i % q.length][0];
      const q2 = q[(i + 2) % q.length][0];
      const gap = d.competitorsPresent.length
        ? `${d.competitorsPresent.slice(0, 2).join(' et ')} ${d.competitorsPresent.length > 1 ? 'y sont' : 'y est'} ; ${d.clientPresence === 'unknown' ? 'votre présence n’a pas pu être vérifiée' : 'vous n’apparaissez pas'}.`
        : d.clientPresence === 'unknown'
          ? 'Votre présence n’a pas pu être vérifiée.'
          : 'Aucun concurrent n’y est encore : la place est libre.';
      const impact: 1 | 2 | 3 = d.citationShare >= 0.1 ? 3 : d.citationShare >= 0.05 ? 2 : 1;
      return {
        domain: d.domain,
        label: d.label,
        category: d.category,
        score: Math.min(98, Math.round(d.citationShare * 300 + d.competitorsPresent.length * 8 + (ca.effort === 'S' ? 10 : 0))),
        why: `Cité dans ${d.citations} réponses sur ${answers} (${Math.round(d.citationShare * 100)} % des citations), par ${providerList(d.providers)}, pour « ${q1} » et « ${q2} ». ${gap}`,
        action: ca.action(d.label),
        howTo: ca.how(d.label, seed.business),
        effort: ca.effort,
        impact,
        competitorsPresent: d.competitorsPresent,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  const clientCitedCount = domains.filter((d) => d.category === 'client').reduce((s, d) => s + d.citations, 0);
  return {
    totalCitations: total,
    domains: [...domains].sort((a, b) => b.citations - a.citations),
    byCategory,
    opportunities,
    clientCitedCount,
    note: 'Sources relevées via les API de ChatGPT, Perplexity et Claude. Gemini ne fournit pas ses sources : il sert à la perception et à la vérité, pas à cette vue.',
  };
}

function monthDate(offsetMonths: number) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offsetMonths, 3, 7, 30)).toISOString();
}

function buildAudit(seed: Seed, i: number, n: number): V2Audit {
  const b = seed.business;
  const base = createMockAudit(seed.input, `${b.id}-v2-${i}`);
  const iso = monthDate(n - 1 - i);
  const t = n > 1 ? i / (n - 1) : 1;
  const score = seed.scores[i];
  const r = rng(`${b.id}-${i}`);
  const queries: QuerySpec[] = seed.queries.map(([text, intent], k) => ({ id: `q${k + 1}`, text, intent }));
  const comps: CompetitorStat[] = seed.comps.map(([name, a, z]) => ({ name, share: round2(a + (z - a) * t), mentions: 0 }));
  if (i >= n - 2) comps.push({ name: seed.newCompetitor, share: i === n - 1 ? 0.03 : 0.01, mentions: 0 });
  const me = seed.me[i];
  const mentions: MentionResult[] = [];
  for (const q of queries)
    for (const p of seed.providers) {
      const mentioned = r() < me * 4.2;
      const named = comps.filter(() => r() < 0.35).slice(0, 3).map((c) => c.name);
      mentions.push({ provider: p, queryId: q.id, run: 1, mentioned, rank: mentioned ? 1 + Math.floor(r() * 3) : null, competitors: named });
    }
  const totalMentions = Math.max(1, Math.round(queries.length * seed.providers.length * 1.4));
  for (const c of comps) c.mentions = Math.max(1, Math.round(c.share * totalMentions));
  comps.sort((x, y) => y.share - x.share);
  const offsets = [5, -6, 2, -3];
  const subScores = { chatgpt: null, perplexity: null, gemini: null, claude: null } as AuditResult['subScores'];
  seed.providers.forEach((p, j) => (subScores[p] = clamp(score + offsets[j % 4])));
  const mentionRate = round2(mentions.filter((m) => m.mentioned).length / mentions.length);
  const all = [...comps.map((c) => c.share), me].sort((x, y) => y - x);
  const rank = all.indexOf(me) + 1;
  const of = comps.length + 1;
  const audit: V2Audit = {
    ...base,
    id: `${b.id}-audit-${i + 1}`,
    input: seed.input,
    createdAt: iso,
    measuredAt: iso,
    score,
    range: { low: clamp(score - 7), high: clamp(score + 6) },
    subScores,
    mentionRate,
    shareOfVoice: me,
    competitors: comps,
    queries,
    mentions,
    answers: [],
    excerpts: [],
    providersUsed: seed.providers,
    demo: true,
    segment: b.segment,
    benchmark: { rank, of, label: `${rank === 1 ? '1ᵉʳ' : `${rank}ᵉ`} sur ${of} ${b.cohort}` },
  };
  if (i === n - 1) {
    const answers = queries.length * seed.providers.length * 2;
    audit.sources = buildSources(seed, answers);
    audit.perception = buildPerception(seed, iso);
    audit.factCheck = buildFactCheck(seed, iso);
    audit.gaps = comps
      .filter((c) => c.share > me)
      .map((c) => ({
        competitor: c.name,
        mentions: c.mentions,
        share: c.share,
        presentOn: seed.domains.filter((d) => d[5].includes(c.name) && d[4] !== 'present').map((d) => d[0]),
        reasons: seed.reasons[c.name] ?? ['Plus présent que vous dans les sources citées par les IA', 'Davantage d’avis récents'],
      })) satisfies CompetitorGap[];
  }
  return audit;
}

function buildPerception(seed: Seed, at: string): PerceptionReport {
  const quotes: BrandQuote[] = seed.quotes.map(([provider, query, text, sentiment]) => ({ provider, query, text, sentiment, at }));
  const claims: BrandClaim[] = seed.checks.map(([field, value, provider, quote]) => ({ field, value, provider, quote }));
  return { quotes, sentiment: seed.sentiment, themes: seed.themes, claims };
}

function buildFactCheck(seed: Seed, at: string) {
  const items: FactCheckItem[] = seed.checks.map(([field, stated, provider, quote, verdict, severity]) => ({
    field,
    expected: seed.facts[field] ?? '',
    stated,
    provider,
    quote,
    verdict,
    severity,
  }));
  return { checkedAt: at, items, errors: items.filter((x) => x.verdict === 'faux').length };
}

const auditCache = new Map<string, V2Audit[]>();
export function demoAudits(segment: Segment): V2Audit[] {
  const seed = SEEDS[segment];
  const key = `${segment}-${new Date().toISOString().slice(0, 7)}`;
  const hit = auditCache.get(key);
  if (hit) return hit;
  const n = seed.scores.length;
  const list = Array.from({ length: n }, (_, i) => buildAudit(seed, i, n));
  auditCache.set(key, list);
  return list;
}

export function demoFacts(segment: Segment): BrandFacts {
  const s = SEEDS[segment];
  return { businessId: s.business.id, facts: { ...s.facts }, updatedAt: monthDate(1) };
}

// ---------------------------------------------------------------------------
// Tâches
// ---------------------------------------------------------------------------
export function mondayIso(d = new Date()) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - day);
  return x.toISOString().slice(0, 10);
}

function jsonLdFor(seed: Seed) {
  const b = seed.business;
  const f = seed.facts;
  const url = `https://${b.website}`;
  if (b.segment === 'local')
    return {
      '@context': 'https://schema.org',
      '@type': 'Plumber',
      name: b.name,
      url,
      telephone: '+33143551234',
      address: { '@type': 'PostalAddress', streetAddress: '42 rue de la Roquette', postalCode: '75011', addressLocality: 'Paris', addressCountry: 'FR' },
      areaServed: ['Paris 11e', 'Paris 3e', 'Paris 4e', 'Paris 12e', 'Paris 20e'],
      openingHoursSpecification: [
        { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], opens: '08:00', closes: '19:00' },
      ],
      founder: f.dirigeant,
      foundingDate: f.creation,
    };
  if (b.segment === 'pme')
    return {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: b.name,
      url,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      featureList: ['Paie', 'DSN intégrée', 'Absences', 'Notes de frais', 'API'],
      offers: { '@type': 'Offer', price: '7', priceCurrency: 'EUR', description: 'Par bulletin, sans frais de mise en place' },
      publisher: { '@type': 'Organization', name: b.name, foundingDate: f.creation, address: { '@type': 'PostalAddress', addressLocality: 'Lyon', addressCountry: 'FR' } },
    };
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Shampoing solide Onde — cheveux bouclés',
    brand: { '@type': 'Brand', name: b.name },
    url: `${url}/produits/shampoing-onde`,
    offers: {
      '@type': 'Offer',
      price: '12.90',
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      shippingDetails: { '@type': 'OfferShippingDetails', shippingDestination: ['FR', 'BE', 'LU', 'CH'].map((c) => ({ '@type': 'DefinedRegion', addressCountry: c })) },
    },
  };
}

function faqHtml(seed: Seed) {
  const pairs = seed.queries.slice(0, 3).map(([q]) => q);
  return `<section class="faq">\n${pairs.map((q) => `  <details>\n    <summary>${q}</summary>\n    <p>Réponse rédigée à partir de votre fiche de vérité. À relire avant publication.</p>\n  </details>`).join('\n')}\n</section>`;
}

function task(seed: Seed, k: number, t: Omit<ExecTask, 'id' | 'businessId' | 'createdAt'>): ExecTask {
  return { id: `${seed.business.id}-t${k}`, businessId: seed.business.id, createdAt: monthDate(0), ...t };
}

export function demoTasks(segment: Segment): ExecTask[] {
  const seed = SEEDS[segment];
  const b = seed.business;
  const week = mondayIso();
  const fc = buildFactCheck(seed, monthDate(0)).items.find((x) => x.verdict === 'faux');
  const ld = JSON.stringify(jsonLdFor(seed), null, 2);
  const firstOpp = buildSources(seed, 48).opportunities[0];
  const list: ExecTask[] = [];
  if (fc)
    list.push(
      task(seed, 1, {
        kind: 'fact_fix',
        title: `Corriger : ${fc.provider === 'chatgpt' ? 'ChatGPT' : fc.provider === 'gemini' ? 'Gemini' : fc.provider === 'claude' ? 'Claude' : 'Perplexity'} se trompe sur ${fc.field === 'horaires' ? 'vos horaires' : fc.field === 'livraison' ? 'vos pays de livraison' : fc.field === 'services' ? 'vos fonctionnalités' : 'vos prix'}`,
        why: `L’IA affirme « ${fc.stated} » alors que votre fiche de vérité indique « ${fc.expected} ». Les IA reprennent l’information la plus répandue : il faut la rendre cohérente partout.`,
        automation: 'semi',
        minutes: 15,
        impact: 3,
        status: 'todo',
        week,
        steps: ['Mettez à jour la même information sur votre fiche Google et votre site.', 'Ajoutez le balisage schema.org fourni (il sera servi automatiquement si le plugin est installé).', 'Repéré vérifiera à nouveau lundi prochain. La correction par l’IA n’est pas garantie et peut prendre plusieurs semaines.'],
        deliverable: [
          { type: 'text', label: 'Texte à coller sur votre site et votre fiche Google', content: `${fc.expected}.` },
          { type: 'jsonld', label: 'Balisage à jour', content: ld },
        ],
      }),
    );
  list.push(
    task(seed, 2, {
      kind: firstOpp?.category === 'annuaire' ? 'directory' : 'source_outreach',
      title: firstOpp ? firstOpp.action : 'Gagner une source citée',
      why: firstOpp ? firstOpp.why : '',
      automation: 'guide',
      minutes: firstOpp?.effort === 'S' ? 20 : 45,
      impact: firstOpp?.impact ?? 2,
      status: 'todo',
      week,
      sourceDomain: firstOpp?.domain,
      steps: firstOpp?.howTo,
      deliverable: [
        {
          type: 'text',
          label: 'Description prête à coller',
          content: `${b.name} — ${b.descriptor}. ${seed.facts.services ?? seed.facts.produits ?? ''}. ${seed.facts.zone ? `Intervention : ${seed.facts.zone}.` : ''} ${seed.facts.prix ?? ''}`.replace(/\s+/g, ' ').trim(),
        },
        { type: 'checklist', label: 'À vérifier', content: 'Nom identique partout\nCoordonnées de la fiche de vérité\n3 photos récentes\nLien vers votre site' },
      ],
    }),
    task(seed, 3, {
      kind: 'schema',
      title: b.segment === 'ecommerce' ? 'Compléter les données Product de vos fiches' : 'Ajouter le balisage schema.org à votre site',
      why: 'Les IA lisent les données structurées pour vérifier vos informations. Vos trois concurrents les mieux classés en ont ; vous non.',
      automation: 'auto',
      minutes: 10,
      impact: 2,
      status: 'in_progress',
      week,
      steps: ['Avec le plugin WordPress, rien à faire : le balisage est servi automatiquement.', 'Sinon, collez le code HTML ci-dessous dans le <head> de votre page d’accueil.', 'Testez avec l’outil de test des résultats enrichis de Google.'],
      deliverable: [
        { type: 'jsonld', label: 'JSON-LD', content: ld },
        { type: 'html', label: 'Code à coller dans le <head>', content: `<script type="application/ld+json">\n${ld}\n</script>` },
      ],
    }),
    task(seed, 4, {
      kind: 'faq_page',
      title: 'Publier votre page FAQ citable',
      why: 'Les questions réellement posées aux IA, avec vos réponses exactes. Une page claire et balisée est plus facile à citer.',
      automation: 'auto',
      minutes: 15,
      impact: 2,
      status: 'todo',
      steps: ['Relisez les réponses proposées.', 'Publiez la page hébergée par Repéré ou copiez le HTML sur votre site.'],
      deliverable: [
        { type: 'link', label: 'Page hébergée', content: `/p/${b.slug}` },
        { type: 'html', label: 'HTML de la FAQ', content: faqHtml(seed) },
      ],
    }),
    task(seed, 5, {
      kind: 'review_request',
      title: 'Envoyer le kit de demande d’avis',
      why: 'Les concurrents cités ont 3 à 10 fois plus d’avis récents. Le kit respecte les règles : même message pour tous, sans contrepartie.',
      automation: 'semi',
      minutes: 10,
      impact: 2,
      status: 'todo',
      deliverable: [
        {
          type: 'text',
          label: 'Message à envoyer',
          content: `Bonjour,\n\nMerci de votre confiance. Si vous avez un instant, votre avis sur ${b.name} aide d’autres clients à nous trouver. Positif ou non, il nous est utile.\n\nLaisser un avis : [lien de votre fiche]\n\nBelle journée,\n${seed.facts.dirigeant ?? b.name}`,
        },
      ],
    }),
    task(seed, 6, {
      kind: 'gbp_profile',
      title: b.segment === 'local' ? 'Réécrire la description de votre fiche Google' : 'Mettre à jour votre profil LinkedIn entreprise',
      why: 'La description est l’un des premiers textes que lisent les IA pour comprendre ce que vous faites.',
      automation: 'semi',
      minutes: 5,
      impact: 1,
      status: 'done',
      doneAt: monthDate(0),
      deliverable: [{ type: 'text', label: 'Description (750 caractères max.)', content: `${b.name} : ${b.descriptor.toLowerCase()}. ${seed.facts.services ?? seed.facts.produits ?? ''}.` }],
    }),
    task(seed, 7, {
      kind: 'bing_places',
      title: 'Créer votre fiche Bing Places',
      why: 'Copilot s’appuie sur Bing. Une fiche gratuite, importable depuis Google en quelques clics.',
      automation: 'guide',
      minutes: 10,
      impact: 1,
      status: 'done',
      doneAt: monthDate(0),
      steps: ['Connectez-vous à Bing Places for Business.', 'Importez votre fiche Google.', 'Vérifiez les horaires.'],
    }),
    task(seed, 8, {
      kind: 'content',
      title: b.segment === 'pme' ? 'Publier une page « Paysia ou Salaria : lequel choisir ? »' : b.segment === 'ecommerce' ? 'Publier un guide « shampoing solide et cheveux bouclés »' : 'Publier une page « urgence plombier dimanche »',
      why: 'Une question fréquente pour laquelle aucune page claire n’existe chez vous. Comparatif honnête : vos limites comprises.',
      automation: 'semi',
      minutes: 60,
      impact: 2,
      status: 'todo',
      deliverable: [{ type: 'text', label: 'Plan de la page', content: '1. La question posée\n2. Réponse courte en 2 phrases\n3. Ce qui vous distingue, chiffres à l’appui\n4. Quand ce n’est pas le bon choix\n5. FAQ (3 questions)' }],
    }),
    task(seed, 9, {
      kind: 'review_reply',
      title: 'Répondre à l’avis 3 étoiles du 2 novembre',
      why: 'Un avis sans réponse est repris tel quel par les IA. Une réponse factuelle et courtoise est aussi citée.',
      automation: 'semi',
      minutes: 5,
      impact: 1,
      status: 'skipped',
      deliverable: [{ type: 'text', label: 'Brouillon de réponse', content: 'Bonjour, merci d’avoir pris le temps de nous écrire. Nous sommes désolés pour le délai : nous vous rappelons cette semaine pour en parler. L’équipe.' }],
    }),
  );
  return list;
}

// ---------------------------------------------------------------------------
// Trafic IA (90 jours)
// ---------------------------------------------------------------------------
const BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'ClaudeBot', 'Applebot'];

export function demoTraffic(segment: Segment, days = 90): AiTrafficSummary {
  const seed = SEEDS[segment];
  const r = rng(`${seed.business.id}-traffic`);
  const out: AiTrafficDay[] = [];
  const end = new Date();
  const byEngine: Partial<Record<AiEngine, number>> = {};
  let ai = 0;
  let all = 0;
  let conv = 0;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - i));
    const growth = 0.55 + 0.9 * ((days - 1 - i) / Math.max(1, days - 1));
    const weekday = d.getUTCDay() === 0 || d.getUTCDay() === 6 ? 0.7 : 1.08;
    const visits: Partial<Record<AiEngine, number>> = {};
    const conversions: Partial<Record<AiEngine, number>> = {};
    let dayAi = 0;
    for (const [e, base] of Object.entries(seed.traffic.base) as [AiEngine, number][]) {
      const v = Math.max(0, Math.round(base * growth * weekday * (0.6 + r() * 0.8)));
      visits[e] = v;
      dayAi += v;
      byEngine[e] = (byEngine[e] ?? 0) + v;
      const c = Math.round(v * seed.traffic.convRate * (0.5 + r()));
      if (c) conversions[e] = c;
      conv += c;
    }
    const totalVisits = Math.round(seed.traffic.total * weekday * (0.85 + r() * 0.3)) + dayAi;
    const bots: Record<string, number> = {};
    for (const b of BOTS) bots[b] = Math.round((b.includes('User') ? 2 : 6) * growth * (0.4 + r()) * (segment === 'local' ? 0.5 : 1.5));
    ai += dayAi;
    all += totalVisits;
    out.push({ date: d.toISOString().slice(0, 10), visits, conversions, totalVisits, bots });
  }
  const pages = seed.traffic.pages.map(([path, engine], i) => ({ path, engine, visits: Math.round((ai * 0.34) / (i + 1.3)) }));
  return {
    businessId: seed.business.id,
    from: out[0].date,
    to: out.at(-1)!.date,
    days: out,
    totals: { aiVisits: ai, aiShare: all ? ai / all : 0, conversions: conv, byEngine },
    topLandingPages: pages,
    installed: true,
    demo: true,
  };
}

// ---------------------------------------------------------------------------
// Digest
// ---------------------------------------------------------------------------
export function demoDigest(segment: Segment): WeeklyDigest {
  const seed = SEEDS[segment];
  const audits = demoAudits(segment);
  const latest = audits.at(-1)!;
  const prev = audits.at(-2);
  const cited = latest.mentions.filter((m) => m.provider === 'chatgpt' && m.mentioned).length;
  const asked = latest.mentions.filter((m) => m.provider === 'chatgpt').length;
  const prevCited = prev ? prev.mentions.filter((m) => m.provider === 'chatgpt' && m.mentioned).length : cited;
  const d = cited - prevCited;
  const quotes = buildPerception(seed, latest.measuredAt).quotes;
  const tasks = demoTasks(segment).filter((t) => t.week === mondayIso()).slice(0, 3);
  const traffic = demoTraffic(segment, 7);
  return {
    businessId: seed.business.id,
    week: mondayIso(),
    headline: `Cette semaine, ChatGPT vous cite dans ${cited} questions sur ${asked}${d ? ` (${d > 0 ? '+' : '−'}${Math.abs(d)})` : ''}.`,
    scoreDelta: prev ? latest.score - prev.score : null,
    benchmark: latest.benchmark,
    bestQuote: quotes.find((q) => q.sentiment === 'positif'),
    quoteToFix: quotes.find((q) => q.sentiment === 'negatif'),
    factErrors: latest.factCheck?.errors ?? 0,
    newCompetitors: [seed.newCompetitor],
    tasks,
    aiVisits: traffic.totals.aiVisits,
  };
}

export function demoBusiness(segment: Segment): WorkspaceBusiness {
  return SEEDS[segment].business;
}
