// Navigation V3 de l'espace client : Lundi · Mesurer · Comprendre · Agir · Prouver · Copilote · parcours métier.
// Les entrées existent même si la page est livrée par un autre agent (MESURE, ACTION, METIERS).
import type { Segment } from '@/lib/engine/types-v2';
import type { IconName } from './icons';

export interface NavItem {
  href: string;
  label: string;
  /** libellé court (barre d'onglets mobile) */
  short?: string;
  sub: string;
  icon: IconName;
  badge?: 'errors' | 'tasks';
  /** autres préfixes d'URL qui rendent l'entrée active */
  also?: string[];
  /** raccourci clavier « g » puis cette lettre */
  key?: string;
}

export interface NavGroup {
  id: string;
  label: string | null;
  items: NavItem[];
}

const LUNDI: NavGroup = {
  id: 'lundi',
  label: null,
  items: [{ href: '/app', label: 'Lundi', short: 'Lundi', sub: 'Votre semaine en 30 secondes', icon: 'home', key: 'l' }],
};

const MESURER: NavGroup = {
  id: 'mesurer',
  label: 'Mesurer',
  items: [
    { href: '/app/questions', label: 'Questions suivies', short: 'Mesurer', sub: 'Ce que vos clients demandent aux IA', icon: 'list', key: 'q', also: ['/app/requetes'] },
    { href: '/app/reponses', label: 'Réponses', sub: 'Chaque réponse des IA, mot pour mot', icon: 'eye', key: 'r' },
    { href: '/app/sources', label: 'Sources et citations', sub: 'Les sites et les pages que les IA citent', icon: 'link', key: 's', also: ['/app/citations'] },
    { href: '/app/concurrents', label: 'Concurrents', sub: 'Part de voix par thème et par IA', icon: 'podium', key: 'c', also: ['/app/historique'] },
    { href: '/app/seo', label: 'SEO et GEO', sub: 'Vos scores Google et IA, ce qui a changé', icon: 'globe', key: 'e' },
    { href: '/app/seo/positions', label: 'Positions Google', sub: 'Votre place sur vos mots-clés, chaque semaine', icon: 'flag', key: 'm' },
  ],
};

const COMPRENDRE: NavGroup = {
  id: 'comprendre',
  label: 'Comprendre',
  items: [
    { href: '/app/ia', label: 'Ce que disent les IA', sub: 'Ton, thèmes et verbatims', icon: 'quote', key: 'i' },
    { href: '/app/verite', label: 'Vérité', sub: 'Vos informations exactes et les erreurs des IA', icon: 'shield', badge: 'errors', key: 'v' },
    { href: '/app/seo/technique', label: 'Audit du site', sub: '185 contrôles Google, vitesse et liens', icon: 'search', key: 'u', also: ['/app/seo/performance', '/app/seo/liens'] },
    { href: '/app/seo/geo', label: 'Lisible par les IA', sub: 'Passages, questions, identité, accès des robots', icon: 'compass', key: 'j' },
  ],
};

const AGIR: NavGroup = {
  id: 'agir',
  label: 'Agir',
  items: [
    { href: '/app/actions', label: 'Centre d’actions', short: 'Agir', sub: 'Quoi faire, dans quel ordre, avec l’effet mesuré', icon: 'check', badge: 'tasks', key: 'a', also: ['/app/taches', '/app/plan'] },
    { href: '/app/agent', label: 'Agent', sub: 'Les corrections faites pour vous, après votre accord', icon: 'send' },
    { href: '/app/pages', label: 'Pages', sub: 'Vos pages prêtes à être citées', icon: 'file', key: 'p' },
    { href: '/app/technique', label: 'Technique', sub: 'Robots, données structurées, rendu', icon: 'bolt', key: 't' },
  ],
};

const PROUVER: NavGroup = {
  id: 'prouver',
  label: 'Prouver',
  items: [
    { href: '/app/trafic', label: 'Trafic et ventes', sub: 'Visites et ventes venues des IA', icon: 'trend', key: 'f' },
    { href: '/app/seo/search-console', label: 'Clics Google', sub: 'Search Console : clics, requêtes, pages', icon: 'eye', key: 'b' },
    { href: '/app/rapports', label: 'Rapports', sub: 'PDF, liens de partage et envois planifiés', icon: 'share', key: 'o' },
  ],
};

const COPILOTE: NavGroup = {
  id: 'copilote',
  label: null,
  items: [{ href: '/app/copilote', label: 'Copilote', short: 'Copilote', sub: 'Questions sur vos données', icon: 'spark', key: 'k' }],
};

const LOCAL: NavGroup = {
  id: 'local',
  label: 'Local',
  items: [
    { href: '/app/local', label: 'Fiche Google', sub: 'Votre fiche notée sur 100', icon: 'store', key: 'g' },
    { href: '/app/local/carte', label: 'Carte', sub: 'Votre visibilité quartier par quartier', icon: 'map' },
    { href: '/app/local/annuaires', label: 'Annuaires', sub: 'Nom, adresse, téléphone partout identiques', icon: 'globe' },
    { href: '/app/local/avis', label: 'Avis', sub: 'Ce que disent vos clients, par thème', icon: 'star' },
  ],
};

const ECOMMERCE: NavGroup = {
  id: 'ecommerce',
  label: 'E-commerce',
  items: [
    { href: '/app/produits', label: 'Produits', sub: 'Vos produits cités par les IA', icon: 'box', key: 'd' },
    { href: '/app/produits/revendeurs', label: 'Revendeurs', sub: 'Les marketplaces citées à votre place', icon: 'store' },
    { href: '/app/produits/prix-avis', label: 'Prix et avis', sub: 'Les prix et notes que citent les IA, comparés à vos fiches', icon: 'star' },
    { href: '/app/produits/ventes', label: 'Ventes IA', sub: 'Chiffre d’affaires venu des IA', icon: 'card', also: ['/app/produits/shopify'] },
  ],
};

const COMPTE: NavGroup = {
  id: 'compte',
  label: null,
  items: [
    { href: '/app/notifications', label: 'Notifications', sub: 'Alertes et nouveautés de votre espace', icon: 'bell', key: 'n' },
    { href: '/app/reglages', label: 'Réglages', sub: 'Équipe, offre, alertes, intégrations, données', icon: 'gear', key: 'x' },
  ],
};

/** Groupes de la barre latérale, selon le parcours (Local et E-commerce ont leur groupe métier). */
export function navGroups(segment: Segment | null | undefined): NavGroup[] {
  const metier = segment === 'local' ? [LOCAL] : segment === 'ecommerce' ? [ECOMMERCE] : [];
  return [LUNDI, MESURER, COMPRENDRE, AGIR, PROUVER, ...metier, COPILOTE];
}

/** Entrées de compte (pied de barre latérale, page « Plus »). */
export const ACCOUNT_NAV = COMPTE.items;

export function allNav(segment: Segment | null | undefined): NavItem[] {
  return [...navGroups(segment).flatMap((g) => g.items), ...COMPTE.items];
}

/** Compatibilité V2 (ancienne page Plus, autres écrans) : toutes les entrées, parcours PME. */
export const NAV_GROUPS = navGroups('pme');
export const ALL_NAV = allNav('pme');

export function isActive(href: string, pathname: string, also: string[] = []) {
  if (href === '/app') return pathname === '/app';
  const hit = (h: string) => pathname === h || pathname.startsWith(`${h}/`);
  // Une sous-entrée plus précise (ex. /app/local/carte) l'emporte sur /app/local.
  return hit(href) || also.some(hit);
}

/** Entrée active la plus précise pour une URL. */
export function activeItem(items: NavItem[], pathname: string): NavItem | null {
  const hits = items.filter((i) => isActive(i.href, pathname, i.also));
  return hits.sort((a, b) => b.href.length - a.href.length)[0] ?? null;
}

/** Barre d'onglets mobile : 4 entrées + « Plus » = 5. */
export const TAB_HREFS = ['/app', '/app/questions', '/app/actions', '/app/copilote'];

/** Raccourcis « g » puis lettre → URL. */
export function shortcutMap(segment: Segment | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of allNav(segment)) if (i.key && !out[i.key]) out[i.key] = i.href;
  return out;
}
