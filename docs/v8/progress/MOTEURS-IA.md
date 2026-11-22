# MOTEURS-IA (V8) — journal (22 nov. 2026)

## Inventaire (avant V8)
5 IA dans src/lib/engine/providers : ChatGPT (OpenAI Responses + web_search, position), Perplexity (Agent API Sonar,
position), Gemini (Interactions API, SANS recherche web par défaut), Claude (Messages + web_search, position), Mistral
(Conversations + web_search, en option). Mesure : questions (gabarits ou questions suivies) × 2 passages (gratuit) / 3
(suivi) × IA ; extraction des noms (LLM bon marché, sinon heuristique) ; citations lues dans les annotations ; coût par appel
déclaré par chaque fournisseur → `details.estimatedCostEur` (compteur OPS « Audits (IA) ») ; garde-fou budget par audit ;
marges : bootstrap des questions (score, taux, part de voix) + Wilson.

## Fait
- 5 IA ajoutées, chacune derrière sa variable, retirée de l'audit (jamais simulée) si non configurée :
  google_aio / google_ai_mode / copilot (DataForSEO Live Advanced, France, fr ; providers/serp.ts ; AUDIT_SERP_ENGINES +
  DATAFORSEO_*), deepseek (Chat Completions + deepseek_web_search, deepseek.ts), grok (xAI Responses + web_search, grok.ts).
- « Aperçu IA absent » = mesure valide (`absent`), comptée « sans recommandation » (hors dénominateur) et en taux d'affichage.
- `AuditResult.engines` (engines.ts) : via API/SERP, fournisseur, modèle, date, recherche web, pays, langue, appareil,
  passages, réponses, taux d'affichage, taux de mention + Wilson 90 %, note `methodNote()` (providers/methods.ts).
- Mistral : libellé « Mistral Vibe » (renommage du 28 mai 2026 vérifié : mistral.ai/fr/news/vibe-agent, siecledigital 1er juin).
- Démo : demo-v2 simule 6 IA (local) / 8 IA (PME, e-com) dont AIO, AI Mode, Copilot, DeepSeek ; absences d'aperçu simulées.
- Écrans (modif. minimale) : /app/ia (liste pilotée par PROVIDER_ORDER + bloc « Comment chaque IA est mesurée »,
  components/app/mesure/EngineMethods.tsx), params ?ia= (ALL_PROVIDERS) ; /app/reponses, /app/concurrents, /app/questions,
  rapports : pilotés par providersUsed/PROVIDER_ORDER (étendus). PDF : 2 colonnes et libellés courts au-delà de 5 IA.
- Libellés ajoutés : tokens, report/derive+adapters, alerts, email, pdf/derive, copilot (entities : détection AIO/AI Mode/
  DeepSeek/Grok/Vibe ; tools ; prompt), site demo-figures/offer-facts (compte « N IA » inchangé), barometre cost/simulate.
- Offres inchangées (plans.ts / entitlements.ts : test « IA annoncées = IA suivies », décision 3 V3) ; interrupteur
  `AUDIT_PAID_EXTRA_ENGINES` (audit.ts) ajoute les IA en option configurées aux mesures payantes. exec/tasks : enum étendu.
- Variables : env.ts, .env.example, scripts/ops/lib/catalog.mjs. Docs : MISE-EN-LIGNE §6 bis (coûts, sources), demandes-SITE.
- Tests : src/lib/engine/__tests__/v8-engines.test.ts (faux serveur local) ; tests ajustés (données démo dérivées, non
  figées) : copilot-v3, qa-fonctionnel (délai 20 s), barometre catalog-names, measure (dates futures : test daté cassé).

## Sources (vérifiées le 22 nov. 2026)
api-docs.deepseek.com/guides/web_tools, /guides/search, /quick_start/pricing ; docs.x.ai/developers/tools/web-search,
/tools/citations, /pricing ; docs.dataforseo.com/v3/serp/google/ai_mode/overview, /serp/google/organic/live/advanced ;
dataforseo.com/pricing/serp/google-ai-mode-serp-api, /apis/serp-api/bing-serp-api, help-center parse-google-ai-overviews-ai-mode,
explaining-the-copilot-search-serp-feature-in-bing-serp-api ; serpapi.com/bing-copilot-api (écarté : abonnement, même
périmètre Bing) ; mistral.ai/fr/news/vibe-agent.

## Reste / à décider
- Fondateur : AIO/AI Mode dans Essentiel et Accompagné local ? `AUDIT_BUDGET_PAID_EUR` (2,5–2,7 € par défaut) coupe déjà
  les mesures à 100 questions : à fixer par offre. Grok laissé désactivé (≈ 0,03 €/réponse, audience faible en France).
- ROI (/admin/roi) : la dépense SERP-IA DataForSEO est comptée dans « Audits (IA) », pas dans `otherUsd` du calcul
  d'engagement Backlinks (estimation prudente). ops/health.ts AI_KEYS sans les nouvelles clés. exports CSV : colonnes de
  sous-scores limitées aux 4 IA historiques (API-PUBLIQUE). verrou.engineAccess (Réglages) liste encore 5 IA.
- Échecs hors périmètre vus en suite complète : analysis (TEST-MARQUE en cours), notify (test daté), content.test.ts
  ('openai' n'est pas un ProviderId, AGENT-CONTENU), magentofake (ECOM), why.ts (TEST-MARQUE).
