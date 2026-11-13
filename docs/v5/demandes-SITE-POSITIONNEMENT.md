# Demandes de SITE-POSITIONNEMENT aux autres modules (13 nov. 2026)

1. **MISE-EN-LIGNE — src/lib/seo/site.ts** : la phrase d'identité doit suivre le positionnement V5 (elle est reprise mot
   pour mot dans /a-propos, llms.txt et le JSON-LD Organization) :
   ```ts
   export const DESCRIPTOR = 'le SEO et le référencement IA (GEO) des sites professionnels';
   export const ONE_LINER =
     'Repéré est un service français de SEO et de référencement IA (GEO) : il analyse réellement le site d’une entreprise, mesure si Google et les IA (ChatGPT, Gemini, Perplexity, Claude) la recommandent, explique quoi corriger et applique les corrections validées par le client.';
   ```
   et, dans `PAGE_UPDATED`, passer à `'2026-11-13'` : `'/'`, `'/tarifs'`, `'/local'`, `'/pme'`, `'/e-commerce'`,
   `'/methode'`, `'/comparatif'`, `'/guides'`, `'/fonctionnalites'` (contenus réécrits ce jour).
2. **MISE-EN-LIGNE — next.config.ts** : Next 15 « diffuse » les métadonnées (title, description, canonical) dans le
   `<body>` des pages rendues dynamiquement, sauf pour les robots de sa liste `htmlLimitedBots` — qui ne contient ni
   OAI-SearchBot, ni PerplexityBot, ni Claude-SearchBot, ni RepereBot. Notre propre audit le voit (« pages sans
   description / sans canonical » en développement, et sur les pages dynamiques en production, ex. /tarifs). Ajouter :
   ```ts
   // Métadonnées toujours dans <head> pour les robots de recherche et d'IA (V5 : GEO de notre propre site).
   htmlLimitedBots: /bot|crawl|spider|slurp|search|perplexity|claude|chatgpt|gpt|mistral|bing|google|duckduck|yandex|baidu|applebot|facebookexternalhit|linkedin|twitter|slack|discord|whatsapp|repere/i,
   ```
3. **ANALYSE-UI** : l'accueil, les parcours et toutes les pages (`MainActions`, CTA des guides) envoient vers
   `/analyse?segment=…` ; le héros et le bandeau final utilisent `QuickAuditForm` (déjà branché par vous). Ajouter
   `/analyse` au sitemap et à `v3Routes` si ce n'est pas fait.
4. **Pages légales (propriétaire des pages /cgv, /mentions-legales, /confidentialite, /dpa)** : elles sont exclues du
   sitemap comme « noindex », mais servies sans noindex sur la copie de test : aligner l'un ou l'autre (constat
   `seo.sitemap.missing_pages` de notre propre audit).
5. **SEO-AUDIT (info)** : un lien externe injoignable (erreur réseau) est compté « cassé » ; depuis un réseau filtré (environnement de
   test) ; un statut `unverified` éviterait ce faux positif dans les audits faits depuis un réseau restreint.
6. **ANALYSE-UI — src/app/analyse/page.tsx** (relevé par notre propre audit, seuls constats restants hors de mon périmètre) :
   `WebApplication` sans `aggregateRating`/`review` = constat **élevé** `seo.sd.required_missing` (Google l'exige pour ce
   résultat enrichi) → typer `Service` (comme l'entité Repéré et les outils, voir `softwareAppLd` et `webApplicationLd`) ou
   retirer le bloc ; title 64 car. avec le suffixe → `title: { absolute: TITLE }` ou titre ≤ 51 car. ; description
   204 car. → ≤ 160 (`fitDescription` de src/lib/seo/meta.ts) ; ajouter une image og:image (`/opengraph-image`).
