# Journal GUIDES (V6)

## 15 nov. 2026
- Lecture : brief V6, positionnement V5, guides.ts / guides-v3.ts / guides-v5.ts, page /guides/[slug], test content.test.ts.
- Existant : 13 guides (4 V2, 4 V3, 5 V5). Sujets déjà couverts, donc exclus : robots d'IA, page citable, fiche produit,
  suivi des questions, trafic GA4, avis clients, erreurs des IA, PME dans ChatGPT, SEO local (pilier), données
  structurées, Search Console, Core Web Vitals, pilier SEO + GEO.
- Plan : 20 guides satellites (local, GEO, CMS, e-commerce, SEO de fond) dans src/lib/seo/guides-v6.ts.
- Contrainte gabarit : pas de lien dans le corps ni d'image hors GuideFigure → demande à SITE-SEO-90.
- Recherche : sources primaires lues le 15 nov. 2026 (aide Google Business Profile, Merchant Center, Search Console ;
  Google Search Central dont le guide « AI optimization » de mai 2026 et le lancement FR des aperçus IA du 22 juil. 2026 ;
  OpenAI bots ; Perplexity crawlers et centre d’aide ; Microsoft Learn Copilot ; blogs Bing (Places oct. 2025,
  AI Performance juin 2026) ; IndexNow ; Apple Newsroom ; WordPress Core ; Shopify ; Wix ; PrestaShop ; W3Techs ;
  Ahrefs llms.txt ; Answer.AI ; Cloudflare ; G2 ; Forrester ; Zyppy ; web.dev ; arXiv GEO et Toronto).
- Livré : src/lib/seo/guides-v6.ts (20 guides, 1 505 à 1 657 mots, FAQ 3 à 5 questions, 3 à 8 sources datées chacune),
  enregistrement dans guides.ts (import + spread), 5 SVG dans public/guides/v6/ déclarés dans GUIDE_V6_FIGURES,
  test src/lib/seo/__tests__/guides-v6.test.ts (64 cas : slugs, titre ≤ 60, description 120–160, mots, sources citées
  et datées, routes internes, schémas, absence de promesse).
- tsc et eslint verts. vitest complet : 2 échecs hors périmètre (compteur /outils/* = 20 au lieu de 9, agent OUTILS ;
  hero de l’accueil à 2 boutons submit, SITE-SEO-90).
- Demande à SITE-SEO-90 (docs/v6/demandes-SITE-SEO-90.md) : afficher GUIDE_V6_FIGURES, liens internes dans le corps,
  regroupement de /guides par grappes.
- Points incertains signalés dans les textes : effet des posts GBP, effet de Bing sur ChatGPT, disponibilité en France
  des achats dans les assistants (Shopify Agentic Storefronts, Instant Checkout), données FR sur les aperçus IA,
  accusation Cloudflare/Perplexity contestée, études G2/Forrester centrées logiciels et anglophones.
