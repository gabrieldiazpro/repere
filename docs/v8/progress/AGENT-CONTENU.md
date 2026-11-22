# AGENT-CONTENU — journal (22 nov. 2026)
## Fait
- src/lib/publish/pages/** : création chez le client (WordPress pages+articles, Shopify pages+blog, Webflow articles CMS, Wix Blog en Ricos, PrestaShop pages CMS), toujours en brouillon d'abord, mise en ligne, retrait, corbeille/suppression ; export ZIP (page.html, page.md, jsonld.json, LISEZ-MOI). Doc : docs/v5/publication.md § V8.
- publish/service.ts : createRewriteChangeSet (réécriture d'une page existante → ChangeSet `rewrite` dans /app/agent). Demandes traitées : Magento dans l'export (ECOM), webhook proposal.pending en mode « app » (API-PUBLIQUE, publish/agent.ts).
- src/lib/content/** : détection (questions IA « concurrent cité, vous jamais / rarement », Search Console ≥ 30 impressions sans page, GEO : pages types absentes + sous-questions non couvertes, 3 pages les plus minces), chaque proposition avec preuves datées ; fiche faits clés (prime sur Vérité) ; modèles structurés ; IA du moteur (CONTENT_WRITER=off pour désactiver) rejetée si fait nouveau, marqueur supprimé ou superlatif ; contrôles (citabilité src/lib/geo, title/description/structure/longueur, JSON-LD depuis les faits, FAQPage seulement sur questions visibles complètes, maillage, cannibalisation, sources publiques citées par les IA) ; quota ; mentions à obtenir (annuaires, avis, comparatifs, presse, institutions ; pas forums/Wikipédia) ; effet J+30/J+90 (IA avec marge, GSC, positions) ; journal chaîné content.journal ; démo.
- Interface /app/contenu (Pages, Mentions à obtenir, Faits clés, Journal) + /app/contenu/[id] (texte, aperçu + extrait Google, différences / avant-après, contrôles, une action principale). Démo simulée dans le navigateur.
- Raccords (ajouts minimaux hors périmètre) : nav.ts (entrée « Contenus », pilier Agir), ActionCenter.tsx (« Rédiger avec l'agent » pour content, « Voir le message rédigé » pour source_outreach/directory), /app/agent (carte vers Contenus).
- Tests : src/lib/content/__tests__ (25), src/lib/publish/__tests__/pages.test.ts (11), faux serveurs. Vitest complet : 2 234 verts, 1 échec hors périmètre (notify.test.ts « rapports planifiés », déjà signalé). tsc 0 erreur, eslint 0 erreur.
- Captures : /home/claude/auditia/qa/v8/AGENT-CONTENU/ (propositions local/pme/e-commerce, brouillon texte/aperçu/différences, contenu en ligne + effet, mentions, faits clés ; 1440/390, clair/sombre ; aucun défilement horizontal). Serveur 4102 arrêté.
## Décision fondateur (proposition)
- Quotas : Découverte 0, Essentiel 2/mois, Accompagné 6/mois, Agence 6/mois/client (src/lib/content/quota.ts).
## Reste / À confirmer
- Sur de vrais sites : chemin Wix `draft-posts/{id}/unpublish`, Shopify portée write_content pour pageCreate/articleCreate, Webflow PATCH isDraft.
- Mesure J+30/J+90 calculée au chargement de /app/contenu (pas de tâche planifiée dédiée) ; reconnexion Shopify avec write_content nécessaire.
- Rédaction IA : garde-fou strict (tout mot à majuscule absent des faits = rejet) → souvent repli sur le modèle structuré.
## À faire par d'autres
- SITE : mentionner l'agent de contenu (pages manquantes, quotas, pas d'échange de liens) sur /tarifs et /fonctionnalites ; variable CONTENT_WRITER dans .env.example / MISE-EN-LIGNE.
