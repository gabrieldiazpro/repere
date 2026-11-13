// Contexte serveur commun aux écrans « Agir » et « Prouver » : espace de travail + droits de l'offre.
import { cache } from 'react';
import { getEntitlements, type Entitlements } from '@/lib/entitlements';
import { loadDashboard } from '../data';
import { loadWorkspace, type Workspace } from '../workspace';

export const loadActionContext = cache(async (): Promise<{ ws: Workspace; ent: Entitlements }> => {
  const [ws, d] = await Promise.all([loadWorkspace(), loadDashboard()]);
  return { ws, ent: getEntitlements(d.business) };
});

/** Lien vers le copilote avec l'écran d'origine (et une question pré-remplie facultative). */
export function copilotHref(context: string, q?: string): string {
  const p = new URLSearchParams({ context });
  if (q) p.set('q', q);
  return `/app/copilote?${p.toString()}`;
}
