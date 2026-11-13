import type { NextConfig } from "next";

/**
 * En-têtes de sécurité (qa/securite.md M1, docs/v3/10-audit-technique.md §6 S2, S4, S6).
 *
 * CSP APPLIQUÉE par défaut (plus de Report-Only silencieux), avec rapports vers /api/health/csp-report.
 * - Scripts : 'self' + 'unsafe-inline'. Next 15 injecte des scripts inline (données RSC) dont le contenu change à chaque
 *   page : aucun hachage statique n'est possible, et le nonce exige que le middleware pose la CSP par requête
 *   (patch prêt dans scripts/ops/mise-en-production.md, « CSP à nonce »). Aucun script tiers n'est autorisé :
 *   t.js est servi par notre domaine, Stripe Checkout est une redirection (form-action / navigation).
 * - Polices locales (@fontsource, 'self'), images data:/blob: et logos de marque blanche en https:,
 *   Stripe (checkout, js, api, cadres), Supabase (connect-src, lu au build : NEXT_PUBLIC_SUPABASE_URL est exigée en
 *   production par src/lib/env.ts).
 * - CSP_REPORT_ONLY=1 repasse en Report-Only (diagnostic), CSP_DISABLE=1 retire la CSP (dépannage d'urgence).
 * - HSTS sans `preload` tant que le domaine n'est pas inscrit volontairement (S6) ; X-Robots-Tag conservé.
 */
const isDev = process.env.NODE_ENV !== "production";
const supabase = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const REPORT_PATH = "/api/health/csp-report";

function buildCsp(opts: { dev?: boolean; supabaseUrl?: string; nonce?: string; frameAncestors?: string } = {}): string {
  const dev = opts.dev ?? isDev;
  const sb = opts.supabaseUrl ?? supabase;
  const script = opts.nonce
    ? `'self' 'nonce-${opts.nonce}' 'strict-dynamic'`
    : `'self' 'unsafe-inline' https://js.stripe.com`;
  return [
    "default-src 'self'",
    `script-src ${script}${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' https://api.stripe.com${dev ? " ws: wss:" : ""}${sb ? ` ${sb} ${sb.replace(/^https/, "wss")}` : ""}`,
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
    "media-src 'self' blob:",
    `frame-ancestors ${opts.frameAncestors ?? "'none'"}`,
    "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
    "base-uri 'self'",
    "object-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
    `report-uri ${REPORT_PATH}`,
    "report-to csp",
  ].join("; ");
}

const csp = buildCsp();
const cspDisabled = process.env.CSP_DISABLE === "1";
const cspKey = process.env.CSP_REPORT_ONLY === "1" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";

const securityHeaders = [
  ...(cspDisabled ? [] : [{ key: cspKey, value: csp }]),
  { key: "Reporting-Endpoints", value: `csp="${REPORT_PATH}"` },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

/**
 * Métadonnées (title, description, canonical, og:*) toujours dans le <head> pour les robots de recherche et d'IA.
 * Next 15 « diffuse » les métadonnées des pages dynamiques dans le <body>, SAUF pour les user agents de `htmlLimitedBots`
 * (rendu bloquant). La valeur remplace la liste par défaut de Next : on reprend celle-ci (next/dist/shared/lib/router/
 * utils/html-bots.js, 15.5) et on ajoute les robots IA (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot,
 * PerplexityBot, MistralAI-User, Google-Extended, Applebot-Extended, CCBot…), Googlebot, RepereBot et tout UA contenant
 * bot / crawl / spider. Les navigateurs ne sont pas concernés (le flux reste rapide pour les visiteurs).
 */
const NEXT_DEFAULT_LIMITED_BOTS =
  "[\\w-]+-Google|Google-[\\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight";
const AI_AND_SEARCH_BOTS =
  "bot|crawl|spider|GPTBot|OAI-SearchBot|ChatGPT|ClaudeBot|Claude-|anthropic|PerplexityBot|Perplexity-|MistralAI|Mistral|Google-Extended|Googlebot|Applebot|CCBot|cohere|YouBot|Bytespider|Amazonbot|meta-externalagent|DuckAssistBot|RepereBot";
const HTML_LIMITED_BOTS = new RegExp(`${NEXT_DEFAULT_LIMITED_BOTS}|${AI_AND_SEARCH_BOTS}`, "i");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  htmlLimitedBots: HTML_LIMITED_BOTS,
  async redirects() {
    // L'ancienne adresse du robot (anciens user agents) pointe vers la page de référence.
    return [{ source: "/robot", destination: "/methode/robot", permanent: true }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/admin/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "Cache-Control", value: "no-store" }] },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
      // Aperçu du digest affiché dans /app/reglages (iframe de même origine).
      {
        source: "/api/digest/preview",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          ...(cspDisabled ? [] : [{ key: cspKey, value: buildCsp({ frameAncestors: "'self'" }) }]),
        ],
      },
      // Jamais indexés, mais crawl autorisé (pas de Disallow) : les aperçus de /rapport restent lisibles.
      ...["/app", "/app/:path*", "/admin", "/admin/:path*", "/api/:path*", "/rapport/:path*"].map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      })),
    ];
  },
};

export default nextConfig;
