/** Liens du portefeuille d'agence (purs, testés). */

/** Destination interne à l'espace client uniquement (pas de redirection ouverte, pas de boucle vers /app/agence/*). */
export function safeTarget(v: string | null | undefined): string {
  if (!v || !/^\/app(?:\/[A-Za-z0-9/_-]*)?(?:\?[A-Za-z0-9=&_-]*)?$/.test(v) || v.includes('//') || v.startsWith('/app/agence/')) return '/app';
  return v;
}

/** Lien « ouvrir l'espace du client », éventuellement sur une page précise. */
export function openHref(clientId: string, to?: string): string {
  const q = new URLSearchParams({ client: clientId });
  if (to) q.set('vers', to);
  return `/app/agence/ouvrir?${q.toString()}`;
}

export function exportHref(clientId: string, kind: string): string {
  return `/app/agence/export?${new URLSearchParams({ client: clientId, kind }).toString()}`;
}
