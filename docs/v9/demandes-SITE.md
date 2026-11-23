
## De PARTENAIRES (23 nov. 2026)
Pages livrées : `/partenaires` (programme + annuaire + candidature) et `/rendez-vous` (réserver une démo ;
paramètres `?offre=accompagne|agence` et `?segment=local|pme|ecommerce` pré-remplissent le formulaire).
Bouton secondaire = `buttonClasses({ size: "lg", variant: "secondary" })` (ou `variant: "light"` sur fond sombre),
libellé exact « Réserver une démo », à côté de « Tester gratuitement » / de l'appel principal existant, jamais à sa place.

1. **Accueil, héros** (src/components/site/HomeHero.tsx, sous QuickAuditForm l. ~43) : lien secondaire
   « Réserver une démo » → `/rendez-vous?offre=accompagne`.
2. **/tarifs** (src/components/site/PricingExplorer.tsx et/ou PlanCard.tsx) : sous le bouton de la carte Accompagné,
   lien secondaire « Réserver une démo » → `/rendez-vous?offre=accompagne&segment=<segment affiché>` ; carte Agence
   → `/rendez-vous?offre=agence`. Carte « Partenaire » (agency_partner, cta « Devenir partenaire ») → `/partenaires#candidature`.
3. **/agences** (src/app/agences/page.tsx) : dans le héros, après « Voir la démo agence » / « Rejoindre la liste
   d'attente », « Réserver une démo » → `/rendez-vous?offre=agence` ; carte « Partenaire » (section tarifs) : lien
   « Devenir partenaire » → `/partenaires#agences` ; FAQ « Comment fonctionne le partenariat sans abonnement ? » :
   ajouter « Détail et candidature : /partenaires ».
4. **/pme** (src/app/pme/page.tsx ou SegmentLanding) : « Réserver une démo » → `/rendez-vous?offre=accompagne&segment=pme`.
5. **Pied de page** (src/components/site/Footer.tsx, colonne BRAND) : « Partenaires » → `/partenaires` et
   « Réserver une démo » → `/rendez-vous`.
6. **Sitemap / llms.txt** : ajouter `/partenaires` et `/rendez-vous` (PAGE_UPDATED : 2026-11-23). Pas d'annuaire
   séparé (section `#annuaire` de /partenaires).
7. **Admin** (src/app/admin/page.tsx, hors périmètre) : liens « Partenaires » → `/admin/partenaires` et « Demandes de
   démo » → `/admin/partenaires/rendez-vous`.
Cohérence : /agences, /tarifs et PriceTable affichent déjà « 30 % de commission pendant 12 mois » ; /partenaires
reprend ce chiffre (src/lib/partners/program.ts). Si le fondateur le change, changer les trois endroits ensemble.

## De FICHE-OFFICIELLE (23 nov. 2026)
Livré : fiche officielle unifiée (src/lib/execution/fiche/**), page publique /p/<slug> retravaillée, /p/<slug>.md,
/p/<slug>/llms.txt, encart /encart/<slug>/e.js (script < 5 Ko) et /encart/<slug> (cadre), écran /app/fiche.
1. **Nouvelle page /fonctionnalites/fiche-officielle** (H1 proposé : « Une fiche officielle que Google et les IA
   peuvent croire ») : une seule source de faits (horaires et exceptions, prix « à partir de », labels avec n° et lien
   de vérification, moyens de paiement, langues, liens officiels) ; chaque fait daté, avec sa source et « vérifié par
   vous » ; page publique sobre (balisage schema.org exact, version Markdown et llms.txt pour les IA) ; encart
   « Faits vérifiés » pour votre site (script < 5 Ko sans cookie ni traceur, cadre ou HTML à copier) ; alertes quand
   votre site, votre fiche Google ou une IA disent autre chose ; rappel tous les 90 jours. Exemple : lien vers
   /p/plomberie-martin (démo, noindex). Honnêteté : « aucune garantie qu'une IA reprenne une information ni dans quel
   délai » ; page indexée seulement si l'entreprise l'active.
2. **Menus** : entrée « Fiche officielle » dans le menu Fonctionnalités (src/components/site/**) et dans la page
   /fonctionnalites (carte). Sitemap + llms.txt du site : ajouter /fonctionnalites/fiche-officielle.
3. **Pied de la fiche publique** (src/app/p/[slug]/FicheDocument.tsx, « avec Repéré ») : pointe sur `/` en attendant
   la page ; la remplacer par `abs('/fonctionnalites/fiche-officielle')` une fois publiée.
4. **Page officielle maison /p/repere** : src/lib/seo/house.ts `checkHousePage` doit aussi exiger
   `loadPublicFicheByBusiness(id).indexable` (opt-in ; vrai par défaut pour le compte maison) avant de l'inscrire au
   sitemap.
5. **robots.ts** : rien à bloquer ; /encart/ porte X-Robots-Tag noindex (inutile de le refuser aux robots).
6. **vercel.json** (crons) : ajouter `{ "path": "/api/fiche/rappels", "schedule": "40 6 * * *" }` (rappels de
   vérification à 90 jours ; Bearer CRON_SECRET comme les autres crons).

## Demandes de VEILLE (23 nov. 2026)
1. **Menu principal** (Ressources ou équivalent) : « Veille Google et IA » → `/veille`.
2. **Pied de page** : « Veille » → `/veille`, « Lettre mensuelle » → `/veille/lettre`, « Guide 2027 (gratuit) » → `/ressources/guide-2027`, « Flux RSS de la veille » → `/veille/rss.xml`.
   Optionnel : formulaire d'inscription compact dans le pied de page :
   `import { NewsletterForm } from '@/lib/newsletter/ui/NewsletterForm';` puis `<NewsletterForm source="site" compact title={null} />`.
3. **Guides** (src/app/guides/[slug]/page.tsx, après la FAQ) : `<NewsletterForm source="guide" />` ; et un lien « Ce qui a changé récemment : la veille » → `/veille`.
4. **Sitemap** (src/app/sitemap.ts) : `/veille` (changeFrequency weekly), `/veille/lettre`, `/ressources`, `/ressources/guide-2027`, et chaque fiche :
   `import { VEILLE_ENTRIES, veillePath } from '@/lib/veille';` → `VEILLE_ENTRIES.map(e => ({ url: abs(veillePath(e)), lastModified: e.updated }))`.
   NE PAS inclure `/ressources/guide-2027/lire`, `/ressources/guide-2027/pdf` (liens personnels, noindex).
5. **llms.txt** : ajouter une section « Veille » : `/veille` (fiches datées et sourcées sur Google et les IA) et `/veille/rss.xml`.
6. **<head> du site** (facultatif) : `<link rel="alternate" type="application/rss+xml" title="Veille Google et IA" href="/veille/rss.xml">`.
7. **robots** : `/admin/newsletter` reste couvert par la règle `/admin` existante (vérifier).
