# Mission METIERS (journal : docs/v3/progress/METIERS.md)

Lis _COMMUN.md puis _APP-COMMUN.md. Journaux utiles : LOCAL, ECOMMERCE, AUDIT-SITE, DONNEES.

## À livrer
### Parcours Local (compte démo `demo`, Plomberie Martin)
1. **/app/local/fiche-google** : score /100 de la fiche, critères (état, détail, correctif, lien vers l'action),
   source des données affichée (API Places, saisie guidée ou démo), formulaire de saisie guidée.
2. **/app/local/carte** : carte SVG schématique de la visibilité par quartier (taux de mention, rang, concurrent
   dominant par zone), mention « simulation » visible et expliquée, budget et plafond selon l'offre, relance.
3. **/app/local/annuaires** : audit NAP (présent vérifié / déclaré / absent, incohérences nom-adresse-téléphone,
   score), ajout d'une URL de fiche pour vérification, lien vers l'action « s'inscrire sur… ».
4. **/app/local/avis** : kit de demande d'avis (lien, QR, modèles conformes), thèmes des avis (positifs / négatifs),
   brouillons de réponse selon la tonalité, calendrier de posts Google (idées, planification, rappel, texte à coller).

### Parcours E-commerce (compte démo `demo-ecom`, Maison Sora)
5. **/app/produits** : catalogue suivi (ajout par URL, import), score de fiche produit par produit (audit de fiche de
   '@/lib/siteaudit'), produits cités par les IA (par question : recommandés, rang, le vôtre y est-il ?).
6. **/app/produits/revendeurs** : quand l'IA envoie vers une marketplace, un revendeur ou un comparatif plutôt que
   vers votre site (part par type, exemples, recommandations).
7. **/app/produits/prix-avis** : prix et notes cités par les IA comparés à vos fiches ; écarts → fiche de vérité.
8. **/app/produits/ventes** : chiffre d'affaires attribué aux IA (par moteur, panier moyen, conversion comparée),
   source affichée (script, Shopify, démo), connexion Shopify (état réel), livrables (FAQ produit, guide d'achat).

Les écrans d'un parcours ne s'affichent que pour les commerces de ce parcours (sinon message + lien). Pose les
attributs `data-visite` (`"local-carte"`, `"local-fiche"`, `"produits"`, `"ventes"`).
