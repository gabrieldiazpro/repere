# Orchestration V8 (22 nov.)
- PUBLICITE : livré (6 reels, 12 visuels, 48 accroches, annonces, plan de test 300 €, règles Meta/conso/ARPP). Restent :
  pixel Meta + consentement, page /agences (404), simulateur en ligne, captures à refaire après V8.
- API-PUBLIQUE : livré (19 routes lecture + 3 écritures, OpenAPI 3.1, clés hachées, MCP /api/mcp, webhooks score.dropped et
  proposal.pending, /developpeurs, clé démo). Restent : lien Réglages → /app/reglages/api ; champ `api` dans entitlements ;
  proposal.pending en mode app (AGENT-CONTENU) ; menus/sitemap (SITE) ; échecs vitest notify/inscription-libre/copilot/rank à revoir.
- ECOM : livré (/outils/simulateur-boutique fourchette sourcée ; connecteur Magento OAuth 1.0a : méta, texte, alt ; 301/robots/
  llms/JSON-LD guidés ; WooCommerce produits ajouté). Restent : patch Magento dans export.ts/service.ts (AGENT-CONTENU),
  demandes SITE (/e-commerce), échecs vitest copilote demo-ecom + notify.
- TEST-MARQUE : livré (/analyse « Votre marque est-elle citée par les IA ? », tableau question × IA, « pourquoi eux »,
  garde-fous cache 24 h / 3 tests par domaine / 5 €/j ; inscription libre + POST /api/v5/analysis/[id]/claim ; comptes réels
  en DEMO_MODE sans Supabase). Restent : 4 variables ANALYSIS_* dans .env.example ; demandes SITE ; capture questions suivies.
- MOTEURS-IA : livré (AI Overviews, AI Mode, Copilot via DataForSEO ; DeepSeek, Grok API ; Mistral = « Vibe » ; bloc méthode
  par IA sur /app/ia ; 10 IA possibles). Décisions fondateur : annoncer AI Overviews/AI Mode dans les offres payantes
  (AUDIT_PAID_EXTRA_ENGINES en attendant) ; BUDGET PAR AUDIT trop bas (2,50–2,70 €) vs ~25 € pour une mesure complète 5 IA
  → revoir économie des offres. Restent : ROI DataForSEO AI, santé admin nouvelles clés, export CSV 4 IA, Réglages liste 5.
- AGENT-CONTENU : livré (/app/contenu : détection preuves, rédaction faits-only, brouillon chez le client, validation humaine,
  retour arrière, mentions à obtenir ; quotas proposés 0/2/6/6 par client). Restent : vérifs plateformes réelles, mesure
  J+30/J+90 en tâche planifiée, demandes SITE.
## FINALE-V8 lancé
