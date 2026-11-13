/**
 * Décisions de routage du middleware (pures, testées) : protection de /app/**, démo explicite, /bienvenue.
 * Règle : un utilisateur connecté sans commerce n'est JAMAIS renvoyé en silence sur la démo (A7) → /bienvenue.
 */
import type { Segment } from '@/lib/engine/types-v2';
import { safeNext } from './cookies';

export const DEMO_PARAM = 'compte';
const DEMO_SEGMENTS: Record<string, Segment> = { demo: 'local', 'demo-pme': 'pme', 'demo-ecom': 'ecommerce' };

/** Pages de /app accessibles sans session ni démo. */
const PUBLIC_APP = new Set(['/app/hors-ligne']);

export function demoSegmentFromParam(v: string | null | undefined): Segment | null {
  return (v && DEMO_SEGMENTS[v]) || null;
}

export function isDemoSegment(v: string | null | undefined): v is Segment {
  return v === 'local' || v === 'pme' || v === 'ecommerce';
}

export interface RouteInput {
  pathname: string;
  /** chaîne de requête avec « ? » (ou vide) */
  search: string;
  hasSession: boolean;
  /** l'utilisateur connecté a-t-il au moins un commerce ? (undefined si inconnu ou sans session) */
  hasWorkspace?: boolean;
  /** valeur du cookie de démo */
  demoCookie?: string | null;
}

export type RouteDecision =
  | { action: 'next' }
  | { action: 'redirect'; to: string; setDemo?: Segment }
  /** le middleware doit d'abord savoir si l'utilisateur a un commerce */
  | { action: 'needWorkspace' };

function withoutParam(pathname: string, search: string, param: string): string {
  const sp = new URLSearchParams(search);
  sp.delete(param);
  const q = sp.toString();
  return `${pathname}${q ? `?${q}` : ''}`;
}

export function decideRoute(i: RouteInput): RouteDecision {
  const { pathname, search } = i;
  if (pathname === '/app/connexion' || pathname.startsWith('/app/connexion/')) {
    return { action: 'redirect', to: `/connexion${search}` };
  }
  if (pathname === '/bienvenue' || pathname.startsWith('/bienvenue/')) {
    if (!i.hasSession) return { action: 'redirect', to: `/connexion?next=${encodeURIComponent(pathname + search)}` };
    return { action: 'next' };
  }
  if (pathname !== '/app' && !pathname.startsWith('/app/')) return { action: 'next' };
  if (PUBLIC_APP.has(pathname)) return { action: 'next' };

  // Démo explicite : /app?compte=demo|demo-pme|demo-ecom → cookie de démo, URL nettoyée.
  const sp = new URLSearchParams(search);
  const demo = demoSegmentFromParam(sp.get(DEMO_PARAM));
  if (demo) return { action: 'redirect', to: withoutParam(pathname, search, DEMO_PARAM), setDemo: demo };

  if (i.hasSession) {
    if (i.hasWorkspace === undefined) return { action: 'needWorkspace' };
    if (i.hasWorkspace) return { action: 'next' };
    // Connecté sans commerce : démo seulement si choisie explicitement (cookie posé après la connexion).
    if (isDemoSegment(i.demoCookie)) return { action: 'next' };
    return { action: 'redirect', to: '/bienvenue' };
  }
  if (isDemoSegment(i.demoCookie)) return { action: 'next' };
  return { action: 'redirect', to: `/connexion?next=${encodeURIComponent(safeNext(pathname + search))}` };
}
