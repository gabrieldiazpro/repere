# Repéré V2 — contrats de construction (à respecter à la lettre)

Lire d'abord : docs/v2/00-BRIEF-V2.md. Code : /home/claude/auditia/app (Next 15.5, React 19, Tailwind v4, TS strict).
Le build V1 passe (146 pages, 107 tests). **Il doit toujours passer à la fin** de votre travail sur vos fichiers.

## Décisions de l'orchestrateur (fixes)
- Nom : **Repéré — référencement IA**. Promesse : « Le référencement IA clé en main des entreprises françaises.
  On mesure, on explique, on le fait pour vous, au prix d'un logiciel. » Slogan : « Les IA recommandent. On travaille
  pour que ce soit vous. » (docs/v2/07-positionnement.md fait foi pour le copy).
- Grille : docs/v2/07-plans-v2.json (segment local/pme/ecommerce/agency). Prix nets, « TVA non applicable, art. 293 B du CGI ».
  Garantie 14 j uniquement sur les audits approfondis et plans d'action ponctuels. Accompagné = 3 mois minimum.
  Agence : liste d'attente (available:false) tant que la marque blanche n'est pas livrée.
- Sources : seules ChatGPT, Perplexity, Claude fournissent des URL citées via API. **Gemini sans ancrage** (CGU) :
  utilisé pour la perception/vérité, pas pour les sources ; le rapport le dit honnêtement.
- Exécution jour 1 sans approbation Google : textes GBP prêts à coller, JSON-LD servi côté serveur (page hébergée,
  plugin WordPress, snippet à coller dans le <head>), page FAQ hébergée, kit avis conforme (pas de gating, pas
  d'incitation, pas de contenu imposé), brouillons de réponses, fiches Bing/Apple/annuaires guidées.
  llms.txt : proposé comme « bonus sans preuve d'effet ». Pas de promesse Bing→ChatGPT.
- Tracking : snippet sans cookie + endpoint agrégé, pas d'IP stockée ; GA4 en connecteur optionnel (préparé).
- Tout fonctionne en **mode démo sans clé** (données réalistes étiquetées « démo ») ; le commerce démo « Plomberie
  Martin » (local) + **2 nouveaux comptes démo** : « Paysia » (PME : logiciel de paie pour PME, id `demo-pme`) et
  « Maison Sora » (e-commerce : cosmétiques solides, id `demo-ecom`).

## Types partagés
`src/lib/engine/types-v2.ts` (déjà écrit, NE PAS modifier sans nécessité ; ajout additif seulement, prévenir dans le
rapport). `AuditInput` doit être étendu par ENGINE avec `AuditInputV2` ; `AuditResult` avec `AuditResultV2Ext`.

## Persistance
`src/lib/store.ts` (déjà écrit) : putDoc/getDoc/updateDoc/listDocs/deleteDoc/incrDoc — chaque module V2 utilise SES
collections préfixées (`exec.*`, `track.*`, `facts.*`, `digest.*`, `copilot.*`, `bench.*`). Ne pas modifier db.ts sauf
agent RETENTION (seul propriétaire de db.ts et schema.sql en V2).

## Modules, propriétaires, exports attendus
| Agent | Fichiers (périmètre exclusif) | Exports / routes |
|---|---|---|
| ENGINE | src/lib/engine/** (sauf types-v2.ts), engine/data/domains.json | `runAudit` accepte segment (requêtes par parcours) ; remplit `sources`, `perception`, `gaps`, `benchmark` ; `factCheck(result, facts): FactCheckReport` ; `buildSourcesReport(answers, input)` ; `classifyDomain(domain)` ; `createMockAudit(input, seed)` gère les 3 segments (sources, perception, claims dont 1 erreur démo) |
| EXECUTION | src/lib/execution/**, src/app/api/exec/**, src/app/p/** (pages hébergées), src/app/api/schema/**, /home/claude/auditia/integrations/wordpress/** | `generateTasks(result, facts?, opts): ExecTask[]` ; `weeklyTasks(businessId): ExecTask[]` (3) ; `listTasks/updateTaskStatus` ; `buildJsonLd(business, facts, segment)` ; `buildFaq(result, facts)` ; `reviewKit(business)` ; `draftReviewReply(review)` ; `seedDemoExec(businessId)` ; routes `GET/POST /api/exec/tasks`, `POST /api/exec/tasks/[id]`, `GET /api/schema/[businessId]` (JSON-LD), page `/p/[slug]` (FAQ/fiche citable hébergée) |
| TRACKING | src/lib/tracking/**, public/t.js, src/app/api/t/**, src/app/api/connect/ga4/** | `recordHit(...)`, `getAiTraffic(businessId, days): AiTrafficSummary` ; `snippetFor(businessId)` ; `seedDemoTraffic(businessId)` ; `POST /api/t` (beacon), `POST /api/t/bot` (logs robots IA depuis plugin WP) |
| RETENTION | src/lib/db.ts, supabase/schema.sql, src/lib/plans.ts, src/lib/facts.ts, src/lib/digest/**, src/lib/copilot/**, src/lib/alerts.ts, src/lib/demo-v2.ts, src/app/api/{facts,copilot,digest,benchmark,cron/weekly}/**, src/app/api/checkout (adapter v2), vercel.json, .env.example, src/lib/email.ts | `getFacts/saveFacts` ; `buildWeeklyDigest(businessId)` + e-mail ; `detectAlerts(prev, next, facts)` ; `askCopilot(businessId, messages)` (LLM avec contexte audit+sources+vérité+tâches ; mock sans clé) ; `getDemoWorkspace(segment)` → {business, audits, facts} pour `demo`, `demo-pme`, `demo-ecom` ; plans v2 ; schema SQL V2 (inclure `DOCUMENTS_SQL` de store.ts) |
| APP | src/app/app/**, src/components/app/** | Espace client V2 (voir ci-dessous) |
| SITE | src/app/page.tsx, src/app/local|pme|e-commerce/**, src/app/tarifs/**, src/app/merci/**, src/components/site/**, src/components/ui/**, src/app/layout.tsx, globals.css | Landing + 3 sous-landings + tarifs v2 |
| RAPPORT | src/app/audit/**, src/app/rapport/**, src/components/report/**, src/lib/pdf/** | Formulaire 3 parcours + rapport V2 + PDF V2 |
| CONTENU | src/app/methode/**, src/app/visibilite-ia/**, src/lib/seo/**, src/app/{cgv,mentions-legales,confidentialite}/**, public/llms.txt, src/app/sitemap.ts, src/app/guides/** | Méthode V2, CGV V2, SEO PME/e-com, guides |

Dépendances croisées : importez les exports ci-dessus même s'ils n'existent pas encore ; si à la fin de votre travail
un export manque, créez un **adaptateur local** dans VOTRE dossier (jamais dans celui d'un autre) et signalez-le.

## Espace client V2 (APP) — navigation
Accueil (« le lundi de Repéré » : phrase de la semaine, rang, score+tendance, 3 tâches, alertes) · Ce que disent les IA
(verbatims, sentiment, thèmes) · Vérité (fiche de vérité éditable + erreurs détectées + bouton corriger → tâche
fact_fix) · Sources (top 10 opportunités, carte des domaines, présence) · Concurrents (pourquoi ils passent devant,
part de voix dans le temps) · Tâches (kanban simple, livrables copiables, « c'est fait ») · Trafic IA (courbe, moteurs,
pages, robots, installation du snippet) · Copilote (chat) · Rapports (historique, PDF, bilan trimestriel) · Réglages.
Sélecteur de compte démo (Local / PME / E-commerce).

## Règles communes
- Français, vouvoiement, aucune promesse de résultat, données démo étiquetées.
- Tokens de marque existants (globals.css) ; composants ui/site existants réutilisables.
- Pas de `next build` pendant votre travail (d'autres écrivent) ; vérifiez `npx tsc --noEmit -p . 2>&1 | grep <vos chemins>`
  et `npx vitest run <vos tests>`. N'installez aucune dépendance (signalez si indispensable).
