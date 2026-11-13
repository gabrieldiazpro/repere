# Mission CROISSANCE (journal : docs/v3/progress/CROISSANCE.md)

## À lire
- docs/v3/11-outils-gratuits.md (§ boucles de croissance, points à valider : CNIL, parrainage), docs/01-marque.md.
- Code : src/app/opengraph-image.tsx et les images OG existantes (grep "ImageResponse"), src/lib/publicAudit.ts,
  src/lib/db.ts (getAudit), src/lib/store.ts, src/lib/seo/**, src/components/site/ScoreGauge.tsx.
- Un agent précédent a déjà écrit une bonne partie (src/lib/growth : 11 fichiers ; pages carte, badge, classement,
  parrainage ; routes api/growth) : inspecte, termine, teste.

## Périmètre exclusif
src/lib/growth/**, src/app/api/growth/**, src/app/{badge,classement,parrainage,carte}/**.

## À livrer
1. **Carte de score partageable** /carte/[auditId] : page publique minimale, noindex (score, rang, date, marge
   d'erreur, lien « Testez votre entreprise »), image OG dynamique 1200×630 (next/og, jauge, couleurs de la marque).
   N'existe que si le propriétaire a activé le partage (`growth.cards`). Boutons LinkedIn, X, copie du lien.
2. **Badge** /badge/[businessId].svg : « Visibilité IA mesurée par Repéré — {mois année} », score facultatif. Code
   d'intégration HTML avec lien vers la page publique. Uniquement si mesure réelle de moins de 45 jours, sinon « Mesure
   expirée ». Ne dit JAMAIS « recommandé par ChatGPT ». Page d'explication /badge.
3. **Classement public opt-in** /classement et /classement/[metier]/[ville] : seuls les commerces ayant accepté
   (révocable). « Classement en préparation » tant qu'il y a moins de 10 inscrits réels ; jamais de données démo ;
   noindex tant que vide ; JSON-LD ItemList quand rempli.
4. **Parrainage** : code par compte, page /parrainage, suivi ; récompense paramétrable (défaut : un mois offert au
   parrain et au filleul après le premier paiement) ; fonction exportée pour le coupon Stripe (décris l'appel à
   ajouter au webhook, sans le modifier).
5. Routes /api/growth/* (requireBusiness), tests (jetons, expiration du badge, seuil du classement, attribution).
