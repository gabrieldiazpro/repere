/**
 * CSP à nonce par requête (scripts/ops/mise-en-production.md, annexe B), posée par src/middleware.ts.
 *
 * Next 15 lit le nonce dans l'en-tête `content-security-policy` de la REQUÊTE et l'applique à ses propres scripts,
 * mais seulement pour les pages rendues dynamiquement : une page statique servie depuis le cache n'aurait pas le
 * nonce et ses scripts seraient bloqués. On ne pose donc cette CSP que sur des routes déjà dynamiques (espace client,
 * connexion, inscription, rapport partagé /r) ; ailleurs, la CSP statique de next.config.ts s'applique seule.
 * Les deux politiques se cumulent (la plus stricte l'emporte). `CSP_NONCE=off` désactive celle-ci (dépannage).
 * `img-src https:` : logos de marque blanche des rapports partagés (/r/*).
 */
const NONCE_PREFIXES = ['/app', '/bienvenue', '/connexion', '/inscription', '/r/'];
/** Pages statiques sous ces préfixes (page hors ligne mise en cache par le service worker). */
const STATIC_EXCEPTIONS = new Set(['/app/hors-ligne']);

export function wantsNonceCsp(pathname: string, env: Record<string, string | undefined> = process.env): boolean {
  if ((env.CSP_NONCE ?? 'on') === 'off' || env.CSP_DISABLE === '1') return false;
  if (STATIC_EXCEPTIONS.has(pathname)) return false;
  return NONCE_PREFIXES.some((p) => (p.endsWith('/') ? pathname.startsWith(p) : pathname === p || pathname.startsWith(`${p}/`)));
}

export function newNonce(): string {
  return btoa(crypto.randomUUID());
}

export function nonceCsp(nonce: string, opts: { dev?: boolean; supabaseUrl?: string } = {}): string {
  const dev = opts.dev ?? process.env.NODE_ENV !== 'production';
  const sb = (opts.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' https://api.stripe.com${dev ? ' ws: wss:' : ''}${sb ? ` ${sb} ${sb.replace(/^https/, 'wss')}` : ''}`,
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
    "media-src 'self' blob:",
    "frame-ancestors 'none'",
    "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
    "base-uri 'self'",
    "object-src 'none'",
    "worker-src 'self' blob:",
    'report-uri /api/health/csp-report',
  ].join('; ');
}
