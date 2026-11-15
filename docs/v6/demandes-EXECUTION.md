# Demandes au propriétaire de src/lib/execution (fiches officielles /p/<slug>, /api/schema) — à router par l'orchestrateur

## De SITE-SEO-90 (15 nov. 2026)
Notre propre audit (build de production) relevait un constat **élevé** `seo.sd.required_missing` sur les fiches des comptes
démo liées depuis /local et /e-commerce. Côté page (app/p, mon périmètre), les fiches DÉMO ne publient plus de JSON-LD
(entreprise fictive : adresse et téléphone inventés lus comme réels ; lien vers le fichier brut à la place). Restent
valables pour les vrais clients (même générateur) :
1. **/p/maison-sora** : nœuds `Product` sans `image` (exigée par Google pour les fiches marchandes). Proposition :
   `schemaForBusiness` n'émet `image` que si une image réelle existe et, sinon, n'émet pas le nœud `Product` (garder la
   liste en texte), ou ajouter des images aux produits du compte démo (illustrations marquées « démo »).
2. **/p/plomberie-martin** : `hasOfferCatalog.itemListElement[].Offer` sans `price` / `priceSpecification`. Pour des
   services sans prix fixe, Google n'exige rien, mais le nœud `Offer` vide n'apporte rien : proposition, lister les services
   en `itemListElement: { "@type": "Service", name }` directement (OfferCatalog accepte Service), ou mettre un
   `priceSpecification` (minPrice) quand la fiche de vérité donne un prix (« intervention à partir de 89 € TTC »).
   (Le contrôle est aussi signalé comme trop large dans demandes-SEOAUDIT.md, n° 10.)
3. Environnement : `hostedPageUrl` dérive de NEXT_PUBLIC_APP_URL sans le garde-fou « jamais localhost » de
   src/lib/seo/site.ts (`SITE_URL`) : sur un build de production avec APP_URL locale, canonical et @id des fiches pointent
   vers http://localhost. Proposition : même repli que SITE_URL.
