# Journal ROBUSTESSE (V6, 15 nov. 2026)

## Fait
- **Batterie « web réel »** : src/lib/crawl/__tests__/hardsites.ts (≈ 70 faux sites, fusionnés dans fakesites.ts) ;
  tests : crawl/__tests__/hardsites.test.ts (49), render.test.ts (4, vrai Chromium), analysis/__tests__/robustesse.test.ts (21).
  Couvre lenteurs (TTFB, corps au compte-gouttes, gzip lent, robots.txt lent, coupure), SPA, robots (tout bloqué, RepereBot,
  500, HTML, IA), redirections (boucle, chaîne 8, meta refresh, JS, déménagement, http seul, cookie obligatoire), sitemaps
  (index 500 × 40 000, auto-référence, HTML, tronqué, gzip cassé, bombe gzip, tiers, SSRF), encodages (latin-1 déclaré,
  méta tardive, sans charset, BOM, UTF-16, charset inconnu), HTML pathologique, 5 Mo, binaire, vide, JSON, 404/500/503,
  parking, 401, Shopify sous mot de passe, noindex, Cloudflare/DataDome/403, 429 + Retry-After, canonicals (doublés, en-tête
  Link, vers 404, vers accueil, autre domaine), hreflang invalides, pièges (calendrier, facettes, relatif récursif, session),
  plateformes (Wix, Shopify, Squarespace, WordPress+WooCommerce, Webflow, PrestaShop, Jimdo, Next, Nuxt), IDN, IPv6, SSRF
  (rebinding, ::ffff:127.0.0.1, 0x7f000001, 2130706433, 127.1, localhost., metadata, ports, identifiants, gopher, fd00:ec2::254).
- **Bugs trouvés et corrigés** (avant/après mesurés) :
  1. HTML jamais fermé : regex paresseuses quadratiques → 31 s de crawl + 58 s d'audit sur UNE page, serveur bloqué (aucun
     délai ne peut se déclencher). Balayages linéaires (siteaudit/html.ts findBlocks/removeBlocks…, seoaudit/util.ts) : 0,5 s.
  2. Transport : corps gzip coupé ou lent → promesse jamais réglée (l'erreur ne traverse pas pipe()) ; filet de délai ajouté.
  3. robots.txt lent : consommait tout le budget (0 page) → 4 s max puis on continue (signalé).
  4. Notes calculées sur un site non lu (timeout, 403 Cloudflare, robots, 404, 503 : 15 à 50/100) → plus aucun score.
  5. Verdict « la page d'accueil n'a pas répondu » pour un site qui bloque RepereBot → vraie raison.
  6. Cookie posé puis redirection sur soi → « boucle » ; meta refresh / redirection JS non suivis (accueil vide) ; 5 sauts max
     (Google : 10). Tous corrigés (cookies du crawl, redirections molles, 10 sauts).
  7. 429 : 40 requêtes martelées et 40 faux « liens internes cassés » → ralentissement, une attente courte, arrêt poli.
  8. Latin-1 sans charset, méta après 2 Ko, UTF-16 → texte illisible ; binaire en text/html → 37 857 « mots ».
  9. Sitemaps tiers et SSRF lus (relais) ; bombe gzip décompressée à 30 Mo → refusés / 10 Mo max, messages dédiés.
  10. Pièges à URL : 60 pages sur 60 gâchées en facettes → 5 variantes par chemin, segments répétés, URL longues.
  11. IPv6 publiée en premier → injoignable sans sortie v6 (serverless) → IPv4 d'abord, seconde adresse sur échec réseau.
  12. Faux « SPA » (Nuxt/Next SSR avec script module, vitrine courte de 49 mots) côté crawl ET GEO (note plafonnée à 35).
  13. Page > 1,5 Mo : HTML jeté → GEO à 20/100 → début gardé (`htmlTruncated`). Mémoire : 40 M caractères de HTML max/crawl.
  14. Domaine IDN : marque « Xn--… » → décodée. Analyse : l'exploration part de l'adresse saisie (voit les redirections).
  15. Les 10 demandes de SITE-SEO-90 (demandes-SEOAUDIT.md) : faites (scripts RSC, HEAD 400, dev.wix.com, Offer de Service…).
- **Diagnostic** : `SiteCrawl.diagnosis` (crawl/diagnose.ts : 20 états, 18 signaux), `SiteCrawl.platform` (crawl/platform.ts,
  18 plateformes, preuves, extensions WordPress), `CrawledPage.canonicalHeader`, `redirectChain[].via`.
- **Analyse** : `FullAnalysis.access` (analysis/access.ts) : état, titre, message, marche à suivre adaptée à la plateforme,
  signaux ; illisible ⇒ seo/geo « non lancé », scores null, verdict vrai, `priorities[0] = access.<état>` ; `adaptFinding`
  ajoute « Sur Wix : … » / « Repéré peut l'appliquer… » aux priorités.
- **Rendu JS** (crawl/render.ts) : CRAWL_RENDER=off par défaut ; CDP direct (sans npm), navigateur SANS réseau (toutes les
  requêtes servies par notre récupérateur anti-SSRF, robots respectés ; proxy trou noir + DNS coupé), 3 pages / 10 s / 15 s,
  un navigateur par processus, profil effacé. Testé avec le Chromium de la machine (≈ 1 s par page). Doc : MISE-EN-LIGNE.md
  étape 16 (recommandé : off au lancement ; sinon navigateur distant CRAWL_RENDER_WS sans sortie Internet). Variables
  documentées dans .env.example.
- Vérifs : tsc vert ; eslint vert (1 avertissement préexistant seoaudit/demo-crawl.ts:541) ; vitest complet : seuls échecs
  = 2 tests d'autres agents (v4-site.test.tsx, seo/content.test.ts), déjà signalés dans ORCHESTRATION.md.

## À faire par d'autres
- SITE-SEO-90 : afficher `a.access` (encadré, étapes, plateforme) — demandes-SITE-SEO-90.md.
- AGENCES : garde `accessReport(crawl).readable` avant `auditSeo` dans src/app/app/seo/actions.ts — demandes-AGENCES.md.
- Orchestrateur : même garde pour src/app/api/v5/seoaudit et geo (propriétaire à confirmer).

## Risques restants au premier contact du vrai web
- Signatures anti-robots et plateformes relevées de mémoire (pas d'accès Internet) : à confirmer sur 20 vrais sites.
- Cloudflare peut laisser passer l'accueil et défier les pages suivantes, ou servir un 200 de défi non reconnu.
- TLS réel (certificats expirés, chaînes incomplètes, SNI) et HTTP/2 seul jamais testés : « injoignable » générique.
- Retry-After respecté seulement ≤ 3 s ; sites très lents (> 8 s par page) : peu de pages lues.
- Rendu JS jamais testé contre de vrais sites lourds (React + API tierces) ni contre un navigateur distant réel.
