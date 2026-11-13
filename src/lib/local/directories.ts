/**
 * Annuaires prioritaires par famille de métiers (docs/05-plan-action.md § 4 ; docs/v2/04-execution.md E12 à E16).
 * Listes issues de la pratique du SEO local français, non mesurées sur des requêtes françaises : 8 à 10 annuaires au
 * total, pas davantage (recommandation du plan d'action).
 */
import { tradeFamily } from '@/lib/engine';
import type { TradeFamily } from '@/lib/engine/queries';
import type { Directory } from './types';
import { taskLink } from './util';

type D = Omit<Directory, 'task'>;

const BASE: D[] = [
  { id: 'google', name: 'Google Business Profile', domain: 'google.com', priority: 1, note: 'La fiche la plus lue par Gemini et les cartes Google.' },
  { id: 'pagesjaunes', name: 'PagesJaunes', domain: 'pagesjaunes.fr', priority: 1, note: 'Annuaire généraliste le plus consulté en France ; alimente d’autres annuaires.' },
  { id: 'bing', name: 'Bing Places', domain: 'bing.com', priority: 1, note: 'Source de ChatGPT et Copilot pour les recherches locales (import depuis Google en 10 minutes).' },
  { id: 'apple', name: 'Apple Plans (Business Connect)', domain: 'apple.com', priority: 2, note: 'Utilisé par Siri et Plans sur iPhone.' },
  { id: 'facebook', name: 'Facebook', domain: 'facebook.com', priority: 2, note: 'Page souvent citée comme source d’avis et d’horaires.' },
];

const BY_FAMILY: Record<TradeFamily, D[]> = {
  btp: [
    { id: 'houzz', name: 'Houzz', domain: 'houzz.fr', priority: 1, note: 'Plateforme de référence pour les travaux et la rénovation.' },
    { id: 'travaux', name: 'Travaux.com', domain: 'travaux.com', priority: 2, note: 'Mise en relation travaux.' },
    { id: 'habitissimo', name: 'Habitissimo', domain: 'habitissimo.fr', priority: 2, note: 'Profils d’artisans avec avis.' },
    { id: 'starofservice', name: 'StarOfService', domain: 'starofservice.com', priority: 3, note: 'Annuaire de prestataires avec avis.' },
    { id: 'mappy', name: 'Mappy', domain: 'mappy.com', priority: 3, note: 'Cartographie française reprenant les fiches PagesJaunes.' },
  ],
  restauration: [
    { id: 'tripadvisor', name: 'Tripadvisor', domain: 'tripadvisor.fr', priority: 1, note: 'Source majeure citée par les IA pour les restaurants.' },
    { id: 'thefork', name: 'TheFork', domain: 'thefork.fr', priority: 1, note: 'Réservation et avis (si vous prenez des réservations).' },
    { id: 'yelp', name: 'Yelp', domain: 'yelp.fr', priority: 2, note: 'Avis repris par plusieurs assistants.' },
    { id: 'instagram', name: 'Instagram', domain: 'instagram.com', priority: 3, note: 'Photos des plats, horaires, actualités.' },
  ],
  sante_bienetre: [
    { id: 'doctolib', name: 'Doctolib', domain: 'doctolib.fr', priority: 1, note: 'Si votre profession y est éligible.' },
    { id: 'planity', name: 'Planity', domain: 'planity.com', priority: 2, note: 'Réservation en ligne bien-être.' },
    { id: 'resalib', name: 'Resalib', domain: 'resalib.fr', priority: 2, note: 'Annuaire de praticiens du bien-être.' },
    { id: 'yelp', name: 'Yelp', domain: 'yelp.fr', priority: 3, note: 'Avis repris par plusieurs assistants.' },
  ],
  immobilier: [
    { id: 'seloger', name: 'SeLoger', domain: 'seloger.com', priority: 1, note: 'Fiche agence et annonces.' },
    { id: 'leboncoin', name: 'Leboncoin Immobilier', domain: 'leboncoin.fr', priority: 1, note: 'Page pro de l’agence.' },
    { id: 'bienici', name: 'Bien’ici', domain: 'bienici.com', priority: 2, note: 'Annonces et fiche agence.' },
    { id: 'trustpilot', name: 'Trustpilot', domain: 'trustpilot.com', priority: 3, note: 'Avis vendeurs et acquéreurs.' },
  ],
  beaute: [
    { id: 'planity', name: 'Planity', domain: 'planity.com', priority: 1, note: 'Réservation en ligne, très utilisée en coiffure et esthétique.' },
    { id: 'treatwell', name: 'Treatwell', domain: 'treatwell.fr', priority: 1, note: 'Réservation et avis beauté.' },
    { id: 'instagram', name: 'Instagram', domain: 'instagram.com', priority: 2, note: 'Réalisations en photo.' },
    { id: 'yelp', name: 'Yelp', domain: 'yelp.fr', priority: 3, note: 'Avis repris par plusieurs assistants.' },
  ],
  juridique_compta: [
    { id: 'ordre', name: 'Annuaire de votre ordre professionnel', domain: '', priority: 1, note: 'Barreau, Ordre des experts-comptables, chambre des notaires… selon votre profession.' },
    { id: 'justifit', name: 'Justifit', domain: 'justifit.fr', priority: 2, note: 'Annuaire d’avocats (selon déontologie).' },
    { id: 'linkedin', name: 'LinkedIn (page entreprise)', domain: 'linkedin.com', priority: 2, note: 'Présence professionnelle citée par les IA.' },
    { id: 'trustpilot', name: 'Trustpilot', domain: 'trustpilot.com', priority: 3, note: 'Avis clients (vérifiez votre déontologie).' },
  ],
  autre: [
    { id: 'yelp', name: 'Yelp', domain: 'yelp.fr', priority: 2, note: 'Avis repris par plusieurs assistants.' },
    { id: 'mappy', name: 'Mappy', domain: 'mappy.com', priority: 3, note: 'Cartographie française.' },
    { id: 'trustpilot', name: 'Trustpilot', domain: 'trustpilot.com', priority: 3, note: 'Avis clients.' },
  ],
};

function withTask(d: D, businessId?: string): Directory {
  const task =
    d.id === 'google'
      ? taskLink('gbp_profile', 'gbp_profile', businessId)
      : d.id === 'bing'
        ? taskLink('bing_places', 'bing_places', businessId)
        : d.id === 'apple'
          ? taskLink('apple_business', 'apple_business', businessId)
          : d.domain
            ? taskLink(`src:${d.domain}`, 'directory', businessId)
            : taskLink('nap', 'other', businessId);
  return { ...d, task };
}

/** Liste d'annuaires pour un métier (10 au maximum, base commune d'abord). */
export function directoriesFor(trade: string, businessId?: string): Directory[] {
  const fam = tradeFamily(trade);
  const seen = new Set<string>();
  const out: Directory[] = [];
  for (const d of [...BASE, ...BY_FAMILY[fam]]) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    out.push(withTask(d, businessId));
  }
  return out.slice(0, 10);
}

/** L'URL appartient-elle au domaine de l'annuaire (sous-domaines compris) ? */
export function urlMatchesDirectory(url: string, d: Pick<Directory, 'id' | 'domain'>): boolean {
  let host: string;
  try {
    host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (!d.domain) return true; // annuaire d'ordre : domaine variable
  const roots = d.id === 'google' ? ['google.com', 'google.fr', 'g.page', 'goo.gl'] : d.id === 'apple' ? ['apple.com'] : [d.domain];
  return roots.some((r) => host === r || host.endsWith(`.${r}`));
}
