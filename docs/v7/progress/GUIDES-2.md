# Journal GUIDES-2 (V7)

## 15 nov. 2026
- Lecture : brief V6, journal GUIDES (V6), guides.ts / v3 / v5 / v6, page /guides et /guides/[slug], registre des outils (V1, V6, puis V7 d’OUTILS-2).
- Doublons écartés : Search Console pas à pas (search-console-debutants), GA4 et IA (trafic-chatgpt-ga4), Review/AggregateRating
  (donnees-structurees-utiles), vitesse mobile (core-web-vitals-sans-jargon). Squarespace/Webflow et marketplaces non traités (place).
- Livré : src/lib/seo/guides-v7.ts (20 guides, 1 806 à 2 065 mots, FAQ 3 à 6 questions, 2 à 6 sources datées chacune,
  liens [texte](/chemin) vers 3 à 5 guides et au moins un outil par guide), 8 SVG dans public/guides/v7/ (GUIDE_V7_FIGURES).
- Enregistrement : import + spread dans src/lib/seo/guides.ts (53 guides) ; 2 lignes dans src/app/guides/[slug]/page.tsx
  (import GUIDE_V7_FIGURES, `GUIDE_V6_FIGURES[slug] ?? GUIDE_V7_FIGURES[slug]`) ; grappes de src/app/guides/page.tsx complétées
  + nouvelle grappe « Par métier ». content.test.ts : aucun compteur de guides à changer (v6-site-seo lit GUIDES.length).
- Outils d’OUTILS-2 liés (présents dans le registre V7 au 15 nov.) : coherence-nap, fiche-faits-cles, fraicheur-page,
  https-contenu-mixte, textes-alternatifs, structure-titres, contenu-duplique, resultats-enrichis, generateur-utm.
  Le test guides-v7 échouera si l’un d’eux est renommé ou retiré.
- Test : src/lib/seo/__tests__/guides-v7.test.ts (86 cas). tsc OK, vitest complet 141 fichiers / 2 103 tests OK, eslint 0 erreur.
- Points incertains signalés dans les textes : moteur de la recherche web de Claude (Brave, rapporté par TechCrunch en 2025,
  non confirmé) ; recherche web de Vibe (ex-Le Chat, renommé le 28 mai 2026) ; critères Wikidata lus via une source secondaire
  (page officielle non lisible par l’outil) ; consignes aux évaluateurs Google lues sur une copie (Search Engine Roundtable) ;
  décret médecins 2020 via la MACSF (source secondaire) ; données LinkedIn/IA via Blog du Modérateur ; étude Ahrefs = corrélations.
