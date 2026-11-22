# ECOM — journal (V8) — terminé le 22 nov. 2026
## Fait
- Simulateur /outils/simulateur-boutique : src/components/tools/v8/{simulateur.ts,SimulatorTool.tsx,registry.ts} ; fourchette bas/médian/haut, avant/après étiqueté « simulation », 5 hypothèses sourcées/datées/modifiables (Pew, Seer, Semrush, Contentsquare, Conductor, Kaiser & Schulze, Adobe ; manques dits), plafond honnête, liens /analyse et /e-commerce ; rangé dans le hub (groupe « estimer », hors schéma du chemin). Tests v8-simulateur (10) ; comptes d'outils 31 → 32.
- Connecteur Magento / Adobe Commerce : connectors/magento.ts (OAuth 1.0a HMAC-SHA256 ou Bearer, produits/catégories/CMS méta + texte, alt d'images produit ; redirections/robots/llms guidés car pas de route REST du cœur) ; assistant /app/agent (platforms.ts) ; tests magento (14). Doc : docs/v8/magento.md.
- WooCommerce produits : connectors/woocommerce.ts + crochets « V8 ECOM » dans wordpress.ts ; tests woocommerce (5).
- Captures : qa/v8/ECOM (1440, 390, 390 sombre), aucun débordement horizontal.
- tsc 0 erreur ; vitest 2195/2197 (2 échecs hors périmètre : copilot-v3 demo-ecom, notify « already_sent », src/lib/demo-v2.ts modifié à 20:44 par un autre agent) ; eslint : 1 erreur hors périmètre (src/components/app/contenu/Facts.tsx, AGENT-CONTENU, en cours).
## À faire par d'autres
- AGENT-CONTENU : brancher MAGENTO_STEPS dans export.ts / service.ts (demandes-AGENT-CONTENU.md §2) ; Facts.tsx ligne 120 (<a> → Link).
- SITE : noms texte des plateformes et mise en avant du simulateur sur /e-commerce (demandes-SITE.md, section ECOM).
