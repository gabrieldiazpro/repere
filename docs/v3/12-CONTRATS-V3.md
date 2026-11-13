# Repéré V3 — contrats de construction (à respecter à la lettre)

Lire d'abord docs/v3/00-BRIEF-V3.md. Code : /home/claude/auditia/app (Next 15.5, React 19, Tailwind v4, TS strict).
État de départ : build OK (217 pages), 302 tests verts. **Tout doit rester vert.**

## Règles de la machine (IMPORTANT : 2 CPU, 7 Go de RAM, ~15 agents en parallèle)
- **Jamais** de `next build`, `next dev` ni `next start` (ni dans le dossier principal, ni dans une copie) pendant cette
  vague : l'orchestrateur fait les builds d'intégration entre les vagues.
- Toute commande lourde passe par le verrou commun, une seule à la fois sur la machine :
  `flock /tmp/repere-heavy.lock npx tsc --noEmit -p . 2>&1 | grep -E "<vos chemins>"` (2 exécutions max par agent)
  `flock /tmp/repere-heavy.lock npx vitest run <votre dossier>` (jamais toute la suite).
- N'installez aucune dépendance npm (signalez-le si c'est indispensable : l'orchestrateur tranche).
- Chaque agent ne modifie QUE son périmètre. Besoin d'un changement ailleurs → notez-le dans votre rapport final
  (section « À faire par d'autres »), ou créez un adaptateur dans VOTRE dossier.

## Décisions de l'orchestrateur
1. **Fondations d'abord** (audit technique 10, note 4,9/10) : compte créé au paiement, session serveur, droits par
   offre, file de tâches, RGPD, observabilité. Sans ça rien n'est vendable.
2. **Offre gratuite permanente** « Découverte » par parcours : 1 marque, 5 questions suivies, 1 mesure par mois,
   3 IA, pas d'exécution. Essentiel / Accompagné inchangés (docs/v2/07-plans-v2.json). Agence : reste en liste d'attente
   pour l'achat, mais les briques (rapports en marque blanche, lien de partage) sont construites.
3. **IA suivies** : ChatGPT, Perplexity, Gemini (sans ancrage, pas de sources), Claude, + **Mistral (Le Chat)** en
   option (`MISTRAL_API_KEY`). Pas de suivi des AI Overviews / AI Mode en V3 (pas d'API propre) : dit honnêtement.
4. **Volumes de questions** : jamais de faux volumes. On affiche un « indice de demande » (faible / moyen / fort)
   étiqueté « estimation », dérivé de signaux déclarés (méthode publiée), ou rien.
5. **Logos** : pas de logos de marques tierces (ChatGPT, Google…) ni de faux logos clients. Noms en toutes lettres
   dans des pastilles typographiques. Aucun faux témoignage, aucune note inventée.
6. **Cloner = reproduire l'idée fonctionnelle** avec notre design, notre code et nos mots. Jamais de texte, visuel,
   marque ou code d'un concurrent.
7. **Mode démo** : tout fonctionne sans clé, sur les 3 comptes démo (`demo`, `demo-pme`, `demo-ecom`), données
   étiquetées. Les comptes démo sont en lecture seule côté serveur (déjà le cas).
8. **Vidéos** : composant `DemoVideo` (agent MOTION) lit `/videos/<id>.mp4|.webm` + poster `/videos/<id>.jpg`,
   ids : `hero`, `mesurer`, `comprendre`, `agir`, `prouver`. Fichier absent → repli sur une scène animée.
   Les vidéos sont enregistrées en vague 2c dans l'app réelle.

## Modules de la vague 2a (bibliothèques, API, site) et périmètres exclusifs
| Agent | Périmètre exclusif | Livre |
|---|---|---|
| COMPTES | src/middleware.ts, src/lib/auth/**, src/lib/entitlements.ts, src/lib/db.ts, src/lib/plans.ts, src/lib/stripe.ts, src/app/api/{stripe,checkout,account,team}/**, src/app/(auth)/** ou src/app/{connexion,inscription,bienvenue}/**, src/app/app/connexion/**, supabase/migrations/0003_comptes.sql, supabase/schema.sql | Inscription/connexion par lien magique, compte + commerce (bon segment) créés au paiement et à l'inscription gratuite, session serveur (cookies httpOnly), `getSession()`, `requireBusiness()`, rôles (owner/admin/membre/lecteur), invitations, multi-commerces, `getEntitlements(business)` (quotas : questions, IA, fréquence, exécution, sièges, exports, marque blanche), portail Stripe, offre Découverte |
| TACHES-FOND | src/lib/jobs/**, src/lib/env.ts, src/lib/log.ts, src/app/api/{health,jobs}/**, src/app/api/cron/**, src/app/api/account/data/** (export/suppression RGPD), next.config.ts, vercel.json, .github/**, supabase/migrations/0004_jobs.sql, scripts/ops/**, README.md, .env.example | File de tâches (table jobs + worker par cron, reprises, idempotence), premier audit lancé après achat/inscription, ré-audits planifiés selon l'offre, validation des variables d'env au démarrage, journal structuré + point d'accroche Sentry sans dépendance, /api/health, export et suppression RGPD, CSP appliquée, workflow CI, doc sauvegardes |
| MOTEUR | src/lib/engine/** | Questions personnalisées (`runAudit(input,{queries})`), fournisseur Mistral, marge d'erreur par indicateur, part de voix par thème × IA, citations URL par URL (agrégat `urls`), `explainChange(prev,next)` (pourquoi le score a bougé), `buildContentBrief(gap)`, cohérence des comptages et du sentiment (bugs de docs/v3/09-audit-app.md §3), mock mis à jour |
| QUESTIONS | src/lib/prompts/**, src/app/api/prompts/** | Gestionnaire de questions suivies : CRUD, tags, sujets, intention, import CSV, suggestions depuis l'URL du site et le secteur (sans doublons), indice de demande étiqueté, historique par question × IA (réponses brutes avec positions de surlignage), respect des quotas (`getEntitlements`) |
| DONNEES | src/lib/{share,exports,notify,integrations,annotations,measure}/**, src/app/api/{export,share,notifications,integrations,annotations,measure,alerts}/**, src/app/r/** (rapport public partagé) | Exports CSV (toutes les vues), lien de partage public à jeton (révocable, expiration, marque blanche : logo/couleur/nom), rapports planifiés par e-mail, préférences d'alerte CÔTÉ SERVEUR, centre de notifications, Slack + webhook sortant (signé), annotations sur les courbes, mesure avant/après d'une action (relance ciblée des questions liées) |
| AUDIT-SITE | src/lib/siteaudit/**, src/app/api/siteaudit/**, src/app/api/tools/** | Récupération d'URL sûre (anti-SSRF, robots.txt respecté, délais, taille max), audit « prêt pour les IA » (robots par robot IA, rendu sans JavaScript, JSON-LD présent/valide, sitemap, llms.txt, vitesse brute), score de citabilité d'une page par règles (réponse en tête, structure Q/R, chiffres sourcés, auteur, date, longueur, tableaux), audit de fiche produit (Product/Offer/Review, attributs), comparateur « mon site vs un concurrent », générateurs (JSON-LD, llms.txt). Voir endpoints ci-dessous |
| COPILOTE | src/lib/copilot/**, src/app/api/copilot/** | Corriger les 17 réponses génériques sur 30 (qa/v3/app/_copilote.json), routeur d'intention large, entités (le bon concurrent, la bonne IA, la bonne période), outils sur les données du compte, mode LLM réel avec appels d'outils, « Expliquer ce changement », jamais un chiffre hors données |
| LOCAL | src/lib/local/**, src/app/api/local/** | Audit de fiche Google /100 (API Places si `GOOGLE_PLACES_KEY`, sinon saisie guidée + démo ; ne pas stocker le contenu Google au-delà de ce que les règles permettent), carte de visibilité par quartier (simulation étiquetée : quartier injecté dans la question), audit NAP sur annuaires (liste par métier, statut déclaré/vérifié), calendrier de posts avec rappels, thèmes des avis |
| ECOMMERCE | src/lib/ecommerce/**, src/app/api/ecommerce/** | Suivi par produit (marques ET produits cités), revendeurs/marketplaces cités à la place de la marque, comparatif prix/avis cités vs fiche, CA attribué aux IA (valeur de conversion dans t.js + connecteur Shopify préparé, désactivé sans clé), FAQ produit et guide d'achat générés |
| MOTION | src/components/motion/**, src/app/globals.css, src/app/page.tsx, src/app/{local,pme,e-commerce}/**, src/components/site/** SAUF Header.tsx/HeaderNav.tsx/MobileMenu.tsx/Footer.tsx/nav.ts | Système d'animation (docs/v3/07-design-benchmark.md), nouveau hero avec action au premier écran, bandeau des IA suivies (typographique), grille bento animée, 4 scènes produit animées, mur de preuves honnêtes, composant `DemoVideo`, landings refaites |
| PAGES-SITE | src/app/{fonctionnalites,demo,nouveautes,securite,integrations,contact,aide,cas-usage,tarifs,merci}/**, src/components/site/{Header,HeaderNav,MobileMenu,Footer}.tsx, src/components/site/nav.ts, src/components/pages/** | Pages fonctionnalités par pilier, /demo (vidéos + démo guidée), /nouveautes, /securite, /integrations, /contact, /aide, cas d'usage par métier, tarifs (offre Découverte, calculateur de rentabilité), navigation |
| OUTILS | src/app/outils/**, src/components/tools/** | 8 outils gratuits (docs/v3/11-outils-gratuits.md) branchés sur les endpoints AUDIT-SITE |
| ENTONNOIR | src/app/audit/**, src/app/rapport/**, src/components/report/**, src/lib/pdf/** | Corrections de l'audit UX sur formulaire et rapport, rapport V3 (marge d'erreur, URL citées, « expliquer »), PDF |
| CROISSANCE | src/lib/growth/**, src/app/api/growth/**, src/app/{badge,classement,parrainage,carte}/** | Carte de score partageable (image OG dynamique), badge à intégrer (SVG + code), classement public opt-in par ville/secteur (vide tant qu'il n'y a pas 10 inscrits réels), parrainage |
| CONTENU | src/app/{comparatif,guides,methode,cgv,confidentialite,mentions-legales,geo,glossaire,questions,etudes,a-propos,visibilite-ia}/**, src/lib/seo/**, src/app/sitemap.ts, src/app/robots.ts, public/llms.txt | /comparatif mis à jour avec les teardowns (prix sourcés et datés), /methode V3, CGV (Découverte, partage, exports), 4 nouveaux guides, sitemap/llms.txt avec toutes les nouvelles pages |

## Endpoints AUDIT-SITE (contrat pour OUTILS, ENTONNOIR et l'app)
Tous `POST` JSON, publics, limités par IP (réutiliser src/lib/ratelimit.ts), réponse `{ ok, data | error }` :
- `/api/tools/robots` `{url}` → par robot IA : autorisé / bloqué / non mentionné, ligne concernée, recommandation.
- `/api/tools/readiness` `{url}` → score /100 + contrôles `{id, label, status: 'ok'|'warn'|'fail', detail, fix}`.
- `/api/tools/citability` `{url}` ou `{html}` → score /100 + règles `{id, label, status, detail, fix}` + extraits.
- `/api/tools/jsonld/validate` `{url|jsonld}` → blocs trouvés, erreurs, champs manquants.
- `/api/tools/jsonld/generate` `{type: 'LocalBusiness'|'Organization'|'Product'|'FAQPage', fields}` → JSON-LD.
- `/api/tools/llms` `{url}` → llms.txt proposé (avec la mention honnête sur son utilité réelle).
- `/api/tools/product` `{url}` → audit de fiche produit /100.
- `/api/tools/compare` `{url, competitorUrl}` → tableau comparatif des signaux techniques.
- `/api/tools/review-link` `{placeId|name+city}` → lien d'avis + QR SVG (réutiliser `reviewKit` de src/lib/execution).
Fonctions serveur équivalentes exportées par `@/lib/siteaudit` (pour l'app, protégée par session).

## Vague 2b (après intégration) : écrans de l'app
Coquille (onboarding, recherche Cmd+K, notifications, mode sombre, réglages équipe/facturation/intégrations),
écrans Mesure (Questions, Réponses, Citations, Concurrents thème × IA, filtres, comparaison de périodes,
annotations, exports), écrans Action (Centre d'actions avec avant/après, Pages, Technique, Rapports partagés,
Trafic/CA), écrans Local et E-commerce. Ne construisez PAS ces écrans en 2a : livrez bibliothèques, API et tests.

## Vague 2c : vidéos de démo, démo guidée, intégration finale. Vague 3 : contrôle qualité.

## Signatures partagées (à importer telles quelles ; si le module n'existe pas encore au moment de votre vérification, adaptateur local dans VOTRE dossier)
```ts
// @/lib/auth (agent COMPTES)
export interface Session { userId: string; email: string }
export type Role = 'owner' | 'admin' | 'member' | 'viewer';
export async function getSession(req?: Request): Promise<Session | null>;
/** Comptes démo (`demo`, `demo-pme`, `demo-ecom`) : lisibles sans session, jamais modifiables côté serveur. */
export async function requireBusiness(req: Request, businessId: string, opts?: { minRole?: Role; write?: boolean }): Promise<{ business: Business; role: Role | 'demo' }>;
export class HttpError extends Error { status: number }
// Les helpers existants de src/lib/execution/auth.ts et db.canAccessBusiness restent exportés et délèguent à @/lib/auth.

// @/lib/entitlements (agent COMPTES)
export interface Entitlements {
  planId: string; tier: 'decouverte' | 'essentiel' | 'accompagne' | 'agence' | 'demo';
  prompts: number; engines: ProviderId[]; frequency: 'monthly' | 'weekly' | 'daily';
  execution: boolean; seats: number; brands: number; exports: boolean; shareLinks: boolean;
  whiteLabel: boolean; historyMonths: number | null; copilotDaily: number; integrations: boolean;
}
export function getEntitlements(business: Business): Entitlements;
export function assertEntitled(e: Entitlements, feature: keyof Entitlements): void; // lève HttpError(402)

// @/lib/jobs (agent TACHES-FOND)
export type JobType = 'audit.run' | 'audit.scheduled' | 'tasks.generate' | 'digest.send' | 'report.scheduled' | 'measure.action' | 'siteaudit.run' | 'webhook.deliver';
export async function enqueue(type: JobType, payload: Record<string, unknown>, opts?: { runAt?: Date; dedupeKey?: string; businessId?: string }): Promise<{ id: string }>;
export function registerHandler(type: JobType, handler: (payload: Record<string, unknown>) => Promise<void>): void;
// En mode démo / sans base : exécution immédiate en mémoire (même API).
```
Persistance des nouveaux modules : `src/lib/store.ts` (putDoc/getDoc/listDocs/updateDoc/deleteDoc/incrDoc), collections
préfixées par module (`prompts.*`, `share.*`, `notify.*`, `local.*`, `ecom.*`, `siteaudit.*`, `growth.*`, `jobs.*`…).
