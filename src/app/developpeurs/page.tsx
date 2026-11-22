import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { CtaBand, PageHero, SitePage, linkClass } from "@/components/pages/ui";
import { DocLayout } from "@/components/pages/v4/DocLayout";
import { pageMeta } from "@/lib/seo/meta";
import { breadcrumbListLd, graph, webPageLd } from "@/lib/seo/jsonld";
import { SITE_URL } from "@/lib/seo/site";
import { DEMO_API_KEY } from "@/lib/publicapi/keys";
import { LIMITS } from "@/lib/publicapi/usage";
import { buildOpenApi, API_BASE_PATH } from "@/lib/publicapi/openapi";
import { ROUTES, type RouteDef } from "@/lib/publicapi/routes";
import { TOOLS } from "@/lib/publicapi/mcp";
import { WEBHOOK_EVENTS, WEBHOOK_EVENT_DOCS } from "@/lib/publicapi/webhook-events";
import { ERROR_CODES } from "@/lib/publicapi/errors";

const PATH = "/developpeurs";
const TITLE = "API publique et serveur MCP de Repéré";
const DESCRIPTION =
  "Lisez vos scores SEO, GEO et de visibilité dans les IA, les questions suivies, les réponses des IA avec leurs marges, les concurrents et les priorités depuis vos outils : API REST, OpenAPI 3.1, serveur MCP et webhooks signés.";
const UPDATED = "2026-11-22";

export const metadata = pageMeta({ path: PATH, title: "Développeurs : API publique, MCP et webhooks", description: DESCRIPTION });

const BASE = `${SITE_URL}${API_BASE_PATH}`;

const TOC = [
  { id: "presentation", label: "Présentation" },
  { id: "authentification", label: "Authentification" },
  { id: "exemples", label: "Exemples (curl, JavaScript)" },
  { id: "pagination-erreurs", label: "Pagination et erreurs" },
  { id: "limites", label: "Limites" },
  { id: "reference", label: "Référence des routes" },
  { id: "webhooks", label: "Webhooks" },
  { id: "mcp", label: "Serveur MCP" },
  { id: "demo", label: "Clé de démonstration" },
];

const h2 = "scroll-mt-24 text-[1.7rem] font-bold leading-tight sm:text-[2rem]";
const p = "mt-4 text-[1.05rem] text-ink/80";
const pre = "mt-4 overflow-x-auto rounded-2xl bg-[#11131a] p-4 font-mono text-[0.85rem] leading-relaxed text-[#e8eaf2]";

function Code({ children, label }: { children: string; label: string }) {
  return (
    <pre className={pre} aria-label={label} tabIndex={0}>
      <code>{children}</code>
    </pre>
  );
}

const CURL = `# Vos espaces
curl -s "${BASE}/v1/spaces" \\
  -H "Authorization: Bearer $REPERE_API_KEY"

# Scores actuels (IA avec marge, SEO, GEO)
curl -s "${BASE}/v1/spaces/<espace>/scores" \\
  -H "Authorization: Bearer $REPERE_API_KEY"

# Ajouter une question suivie (clé « lecture et écriture »)
curl -s -X POST "${BASE}/v1/spaces/<espace>/questions" \\
  -H "Authorization: Bearer $REPERE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"text":"Quel plombier appeler en urgence à Lyon ?"}'`;

const JS = `// Node 18+ ou navigateur côté serveur : ne mettez jamais la clé dans une page publique.
const BASE = "${BASE}/v1";
const headers = { Authorization: \`Bearer \${process.env.REPERE_API_KEY}\` };

async function all(path) {
  const out = [];
  let cursor = null;
  do {
    const url = new URL(BASE + path);
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url, { headers });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, Number(res.headers.get("retry-after") ?? 60) * 1000));
      continue;
    }
    const body = await res.json();
    if (!res.ok) throw new Error(\`\${body.error.code} : \${body.error.message}\`);
    out.push(...body.data);
    cursor = body.pagination.nextCursor;
  } while (cursor);
  return out;
}

const spaces = await all("/spaces");
for (const s of spaces) {
  const { data } = await (await fetch(\`\${BASE}/spaces/\${s.id}/scores\`, { headers })).json();
  const v = data.aiVisibility;
  console.log(s.name, v ? \`\${v.score.value}/100 (\${v.score.low}–\${v.score.high})\` : "pas encore mesuré");
}`;

const VERIFY = `import crypto from "node:crypto";

// En-tête X-Repere-Signature : "t=<secondes>,v1=<hex>". Signez le corps BRUT reçu.
export function verify(secret, rawBody, header, toleranceSec = 300) {
  const parts = Object.fromEntries(header.split(",").map((x) => x.trim().split("=")));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = crypto.createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(parts.v1 ?? "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}`;

const MCP_CLAUDE_CODE = `claude mcp add --transport http repere ${SITE_URL}/api/mcp \\
  --header "Authorization: Bearer rp_live_…"`;

const MCP_RAW = `POST ${SITE_URL}/api/mcp
Authorization: Bearer rp_live_…
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: scores

{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"scores","arguments":{"espace":"<espace>"},
 "_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientInfo":{"name":"mon-outil","version":"1.0"},"io.modelcontextprotocol/clientCapabilities":{}}}}`;

function paramsOf(r: RouteDef) {
  return (r.params ?? []).filter((x) => x.name !== "limit" && x.name !== "cursor");
}

function MethodBadge({ m }: { m: string }) {
  const tone = m === "GET" ? "bg-[#e6f4ea] text-[#1e6b37]" : m === "POST" ? "bg-[#e8eefc] text-[#1d4ed8]" : "bg-[#fdecec] text-[#b42318]";
  return <span className={`inline-block min-w-[4.2rem] rounded-md px-2 py-0.5 text-center font-mono text-[0.8rem] font-bold ${tone}`}>{m}</span>;
}

export default function DeveloppeursPage() {
  const spec = buildOpenApi(SITE_URL) as { info: { version: string } };
  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: "Développeurs", path: PATH },
  ];
  const jsonLd = graph([
    webPageLd(PATH, { name: TITLE, description: DESCRIPTION, dateModified: UPDATED }, { withContext: false }),
    breadcrumbListLd(PATH, crumbs, { withContext: false }),
  ]);
  const tags = [...new Set(ROUTES.map((r) => r.tag))];

  return (
    <SitePage jsonLd={jsonLd}>
      <PageHero
        crumbs={[{ name: "Accueil", href: "/" }, { name: "Développeurs" }]}
        title="Repéré dans vos outils : API, MCP et webhooks"
        lead="Vos scores SEO, GEO et de visibilité dans les IA, avec leurs marges d’erreur, dans votre tableau de bord, votre CRM ou votre assistant IA. Réservé aux offres Accompagné et Agence ; essayable tout de suite avec la clé de démonstration."
      />

      <section aria-label="Documentation de l’API" className="bg-white py-16 sm:py-20">
        <Container>
          <DocLayout toc={TOC} idBase="dev">
            <div className="space-y-14">
              <section id="presentation" aria-labelledby="presentation-title">
                <h2 id="presentation-title" className={h2}>Présentation</h2>
                <p className={p}>
                  L’API REST (version {spec.info.version}) lit ce que vous voyez dans l’app : espaces, scores et historique, questions suivies et résultats par IA, réponses complètes des IA,
                  concurrents et part de voix, sources citées, constats et priorités du site, propositions de l’agent et rapports. Trois écritures sûres seulement : ajouter une question
                  suivie, la supprimer, demander une nouvelle mesure (dans les limites de votre offre).
                </p>
                <ul className="mt-4 list-disc space-y-1.5 pl-5 text-[1.02rem] text-ink/80 marker:text-primary">
                  <li>Chaque score des IA est livré avec son intervalle à 90 % : ce sont des mesures sur un échantillon de réponses, pas des vérités au point près.</li>
                  <li>L’API ne valide ni ne publie rien chez vos clients : la validation des propositions de l’agent reste humaine, dans l’app.</li>
                  <li>Une valeur non mesurée vaut <code>null</code> : rien n’est estimé ni inventé. Les données démo portent <code>demo: true</code>.</li>
                  <li>
                    Spécification OpenAPI 3.1 générée depuis le code :{" "}
                    <a href={`${API_BASE_PATH}/v1/openapi.json`} className={linkClass}>
                      {API_BASE_PATH}/v1/openapi.json
                    </a>{" "}
                    (importable dans Postman, Insomnia ou un générateur de client).
                  </li>
                </ul>
              </section>

              <section id="authentification" aria-labelledby="auth-title">
                <h2 id="auth-title" className={h2}>Authentification</h2>
                <p className={p}>
                  Créez une clé dans l’app, <strong>Réglages › API</strong> (propriétaire ou administrateur). Elle n’est affichée qu’une fois ; nous n’en gardons qu’une empreinte. Envoyez-la
                  dans l’en-tête <code>Authorization: Bearer rp_live_…</code>, jamais dans l’adresse.
                </p>
                <ul className="mt-4 list-disc space-y-1.5 pl-5 text-[1.02rem] text-ink/80 marker:text-primary">
                  <li><strong>Clé d’espace</strong> : un seul espace. <strong>Clé d’agence</strong> (offre Agence) : tous vos espaces clients, y compris ceux ajoutés ensuite.</li>
                  <li><strong>Lecture seule</strong> (recommandé) ou <strong>lecture et écriture</strong>.</li>
                  <li>Révocable à tout moment ; elle cesse aussi de fonctionner si son créateur perd son rôle d’administrateur ou si l’espace quitte les offres Accompagné et Agence.</li>
                  <li>Un espace hors de la portée de la clé répond 404, comme un espace inexistant.</li>
                </ul>
              </section>

              <section id="exemples" aria-labelledby="ex-title">
                <h2 id="ex-title" className={h2}>Exemples</h2>
                <h3 className="mt-6 text-[1.2rem] font-semibold">curl</h3>
                <Code label="Exemples curl">{CURL}</Code>
                <h3 className="mt-8 text-[1.2rem] font-semibold">JavaScript (fetch, pagination, reprise après 429)</h3>
                <Code label="Exemple JavaScript">{JS}</Code>
              </section>

              <section id="pagination-erreurs" aria-labelledby="pe-title">
                <h2 id="pe-title" className={h2}>Pagination et erreurs</h2>
                <p className={p}>
                  Les listes renvoient <code>{"{ data: [...], pagination: { limit, total, hasMore, nextCursor } }"}</code>. Passez <code>nextCursor</code> dans <code>cursor</code> pour la page
                  suivante ; <code>limit</code> va de 1 à 100 (25 par défaut). Un élément seul : <code>{"{ data: {...} }"}</code>.
                </p>
                <p className={p}>
                  Erreurs, toujours au même format : <code>{'{ "error": { "code", "message", "status", "requestId" } }'}</code>. Codes : {ERROR_CODES.map((c, i) => (
                    <span key={c}>
                      <code>{c}</code>
                      {i < ERROR_CODES.length - 1 ? ", " : "."}
                    </span>
                  ))}
                </p>
              </section>

              <section id="limites" aria-labelledby="lim-title">
                <h2 id="lim-title" className={h2}>Limites</h2>
                <ul className="mt-4 list-disc space-y-1.5 pl-5 text-[1.02rem] text-ink/80 marker:text-primary">
                  <li>{LIMITS.readPerMinute} lectures et {LIMITS.writePerMinute} écritures par minute, {LIMITS.perDay.toLocaleString("fr-FR")} appels par jour, par clé.</li>
                  <li>Clé de démonstration : {LIMITS.demoPerMinute} appels par minute et {LIMITS.demoPerDay.toLocaleString("fr-FR")} par jour, par adresse IP.</li>
                  <li>En-têtes <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code> ; au-delà, 429 avec <code>Retry-After</code>.</li>
                  <li>Nouvelles mesures : une par période de votre offre (semaine pour Accompagné et Agence) ; questions actives : quota de l’offre.</li>
                  <li>Journal d’utilisation de chaque clé (30 jours, derniers appels) dans Réglages › API.</li>
                </ul>
              </section>

              <section id="reference" aria-labelledby="ref-title">
                <h2 id="ref-title" className={h2}>Référence des routes</h2>
                <p className={p}>
                  Générée depuis la spécification OpenAPI. Base : <code>{BASE}</code>.
                </p>
                {tags.map((t) => (
                  <div key={t} className="mt-8">
                    <h3 className="text-[1.25rem] font-semibold">{t}</h3>
                    <div className="mt-3 space-y-4">
                      {ROUTES.filter((r) => r.tag === t).map((r) => (
                        <article key={r.operationId} className="rounded-2xl p-4 shadow-[0_0_0_1px_rgba(27,31,46,.09)]">
                          <p className="flex flex-wrap items-center gap-2">
                            <MethodBadge m={r.method} />
                            <code className="break-all font-mono text-[0.92rem]">{r.path}</code>
                            {r.access === "write" ? <span className="rounded-md bg-[#fff4e5] px-2 py-0.5 text-[0.78rem] font-semibold text-[#8a4b00]">écriture</span> : null}
                            {r.paginated ? <span className="rounded-md bg-canvas px-2 py-0.5 text-[0.78rem] text-ink/70">paginé</span> : null}
                          </p>
                          <p className="mt-2 font-semibold">{r.summary}</p>
                          <p className="mt-1 text-[0.97rem] text-ink/80">{r.description}</p>
                          {paramsOf(r).length ? (
                            <ul className="mt-2 space-y-1 text-[0.92rem] text-ink/80">
                              {paramsOf(r).map((x) => (
                                <li key={x.name}>
                                  <code>{x.name}</code> <span className="text-ink/60">({x.in === "path" ? "chemin" : "requête"})</span> — {x.description}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          <p className="mt-2 text-[0.85rem] text-ink/60">
                            Réponse {r.responseStatus ?? 200} : <code>{r.paginated ? `${r.response}[]` : r.response}</code>
                          </p>
                        </article>
                      ))}
                    </div>
                  </div>
                ))}
              </section>

              <section id="webhooks" aria-labelledby="wh-title">
                <h2 id="wh-title" className={h2}>Webhooks</h2>
                <p className={p}>
                  Ajoutez l’adresse https de votre récepteur dans <strong>Réglages › Intégrations</strong>, puis cochez les événements voulus. Chaque envoi est signé (HMAC-SHA256, secret{" "}
                  <code>whsec_…</code> affiché une fois), repris en cas d’échec, et porte le même identifiant à chaque tentative : dédoublonnez dessus.
                </p>
                <ul className="mt-4 space-y-3 text-[1.02rem] text-ink/80">
                  {WEBHOOK_EVENTS.map((e) => (
                    <li key={e}>
                      <code className="font-semibold">{e}</code> — {WEBHOOK_EVENT_DOCS[e].label}. {WEBHOOK_EVENT_DOCS[e].description}
                    </li>
                  ))}
                </ul>
                <Code label="Exemple de charge utile">{JSON.stringify(WEBHOOK_EVENT_DOCS["score.dropped"].example, null, 2)}</Code>
                <h3 className="mt-8 text-[1.2rem] font-semibold">Vérifier la signature</h3>
                <Code label="Vérification de signature en Node.js">{VERIFY}</Code>
              </section>

              <section id="mcp" aria-labelledby="mcp-title">
                <h2 id="mcp-title" className={h2}>Serveur MCP</h2>
                <p className={p}>
                  Branchez Repéré dans un assistant compatible MCP (Model Context Protocol) pour lui poser des questions sur vos espaces. Adresse : <code>{SITE_URL}/api/mcp</code>, transport
                  HTTP « Streamable », clé dans l’en-tête <code>Authorization</code>. Lecture seule : aucun outil ne modifie ni ne publie quoi que ce soit.
                </p>
                <ul className="mt-4 list-disc space-y-1.5 pl-5 text-[1.02rem] text-ink/80 marker:text-primary">
                  {TOOLS.map((t) => (
                    <li key={t.name}>
                      <code>{t.name}</code> — {t.description}
                    </li>
                  ))}
                </ul>
                <p className={p}>
                  Révision de la spécification suivie : 2026-07-28 (requêtes sans session, en-têtes <code>MCP-Protocol-Version</code>, <code>Mcp-Method</code>, <code>Mcp-Name</code>,{" "}
                  <code>server/discover</code>), avec compatibilité pour les clients qui ouvrent encore par <code>initialize</code> (révisions 2025-03-26 à 2025-11-25).{" "}
                  <a href="https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http" className={linkClass} rel="noopener">
                    Spécification du transport
                  </a>
                  .
                </p>
                <h3 className="mt-6 text-[1.2rem] font-semibold">Claude Code</h3>
                <Code label="Ajouter le serveur MCP dans Claude Code">{MCP_CLAUDE_CODE}</Code>
                <p className={p}>
                  Autres clients : tout client qui accepte un serveur MCP distant avec un en-tête d’autorisation. Les clients qui n’acceptent que la connexion OAuth ne peuvent pas encore
                  utiliser une clé d’API.
                </p>
                <h3 className="mt-6 text-[1.2rem] font-semibold">Requête brute</h3>
                <Code label="Requête MCP brute">{MCP_RAW}</Code>
              </section>

              <section id="demo" aria-labelledby="demo-title">
                <h2 id="demo-title" className={h2}>Clé de démonstration</h2>
                <p className={p}>
                  Pour essayer sans compte : cette clé publique lit <strong>uniquement les trois comptes démo</strong> (Plomberie Martin, Paysia, Maison Sora). Leurs données sont{" "}
                  <strong>fictives</strong> et étiquetées <code>demo: true</code> ; la clé est en lecture seule (toute écriture répond 403).
                </p>
                <Code label="Clé de démonstration">{DEMO_API_KEY}</Code>
                <Code label="Essai avec la clé de démonstration">{`curl -s "${BASE}/v1/spaces" -H "Authorization: Bearer ${DEMO_API_KEY}"`}</Code>
                <p className={p}>
                  Questions sur l’API : <Link href="/contact" className={linkClass}>écrivez-nous</Link>.
                </p>
              </section>
            </div>
          </DocLayout>
        </Container>
      </section>
      <CtaBand title="Essayez l’API sur les comptes démo" text="Copiez la clé de démonstration ci-dessus, ou passez à l’offre Accompagné ou Agence pour créer vos propres clés." />
    </SitePage>
  );
}
