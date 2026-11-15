# Journal — agent AGENCES (V6, 15 nov. 2026)

## 1. Inventaire honnête de l'existant (code lu le 15 nov. 2026)
| Brique | État | Où |
|---|---|---|
| Plusieurs espaces par compte | OUI : sélecteur en tête de menu (cookie `rp_business`), un seul espace gratuit par compte | src/lib/auth/businesses.ts, shell/BusinessSwitcher.tsx |
| Rôles et invitations | OUI : propriétaire / admin / contributeur / lecteur, invitations par lien (14 j), sièges bornés par l'offre (Agence : 10) | src/lib/auth/roles.ts, team.ts, Reglages › Équipe |
| Validation des propositions de l'agent | admin et propriétaire seulement ; un lecteur voit mais ne valide rien | api/v5/publish/changesets/[id] |
| Rapport PDF par audit, bilan trimestriel | OUI, marque Repéré | api/report/[id]/pdf, /app/rapports |
| Liens de partage (rapport, tableau de bord) | OUI : jeton haché, expiration, mot de passe, compteur ; marque blanche PAR LIEN (nom, logo, couleur, masquer Repéré) | src/lib/share, /r/[token] |
| Rapports planifiés par e-mail | OUI : hebdo / mensuel, 20 destinataires (Agence), double opt-in ; marque blanche PAR ESPACE (saisie à refaire pour chaque client) ; expéditeur toujours celui de Repéré (EMAIL_FROM) | src/lib/notify/reports.ts |
| Exports CSV | OUI par espace : questions, réponses des IA, sources, URL, concurrents, tâches, trafic, scores ; constats SEO en CSV côté écran ; PAS de positions Google ni d'export par client depuis une vue agence | src/lib/exports, seo/model.ts findingsCsv |
| API publique | NON (routes internes à session seulement) | — |
| Tableau de bord multi-clients | NON | — |
| Accès client qui valide sans régler | NON (lecteur = lecture seule stricte) | — |
| Domaine d'envoi de l'agence | NON | src/lib/email.ts |
| Droits Agence | `tier agence` : 20 marques, 10 sièges, whiteLabel, exports ; vente en liste d'attente | src/lib/entitlements.ts, api/checkout |

## 2. Ce que proposent les leaders (pages officielles lues le 15 nov. 2026)
- Semrush (semrush.com/features/agencies) : rapports PDF en marque blanche et planifiés (Semrush + GA4 + GSC + GBP), portails clients en marque blanche (domaine propre en Business), CRM ; Agency Growth Kit 208,95 $ (5 clients) / 398,95 $ (15) / 748,95 $ (40) par mois avec Pro/Guru/Business.
- SE Ranking (seranking.com/agency-pack.html, /white-label.html) : logo, couleurs, domaine de la plateforme, rapports envoyés au nom de l'agence (expéditeur, réponse, couleur d'en-tête, SMTP propre), sièges clients en lecture seule réglables par outil (10 inclus), widget d'audit pour capter des prospects ; Agency Pack dès 69 $/mois (annuel).
- Peec AI (peec.ai/for-agencies) : un espace isolé par client, bascule en un clic, espaces « pitch » de 7 jours hors quota, liens de tableau de bord en lecture sans compte, sièges clients illimités, CSV sur toutes les offres, API, gabarits Looker Studio clonables ; 205 $ / 420 $ / 675 $ par mois (annuel).
- Otterly.AI (help.otterly.ai/white-label, /monitor-multiple-clients) : espaces par client, rapports illimités ; PAS de marque blanche native (contournement par Looker Studio, offres Standard et plus).
- Ahrefs (help.ahrefs.com/en/articles/8361796, ahrefs.com/blog/reports) : Portfolios (regroupement de sites, métriques agrégées, Standard et plus) ; Report Builder en bêta depuis le 16 sept. 2024, partage et envoi aux clients annoncés « à venir » à cette date ; pas de marque blanche mentionnée.
Écart à combler (priorité) : marque blanche au niveau de l'agence + domaine d'envoi ; vue portefeuille ; accès client qui valide ; CSV par client (constats, positions, réponses).

## Fait (15 nov. 2026)
- Droits : `Entitlements.agency` {portfolio, clients 20, branding, senderDomain, clientPortal, clientExports}, vrais en
  Agence (et en démo), faux ailleurs ; `assertAgency()` (src/lib/entitlements.ts).
- src/lib/agency : profile.ts (marque de l'agence, appliquée aux espaces dont un propriétaire/admin a un profil),
  sender.ts (expéditeur : domaine VÉRIFIÉ via l'API domaines de Resend, sinon nom de l'agence + adresse Repéré ; sans
  RESEND_API_KEY : statut « unavailable », rien simulé), clients.ts (accès client = Lecteur marqué « valideur », pas de
  nouveau rôle en base), portfolio.ts (lignes, alertes au-delà de la marge, tri, filtres, synthèse), load.ts (réel + démo),
  exports.ts, links.ts (pas de redirection ouverte), brand.ts. Tests : src/lib/agency/__tests__/agency.test.ts (19).
- src/lib/reports/monthly.ts : modèle du rapport mensuel (marque agence ou Repéré, écarts comparés à la marge).
- Écrans : /app/agence (portefeuille, filtres À traiter / À valider / Au vert, recherche, tri, ouvrir en un clic, menu :
  rapport mensuel, propositions, 3 CSV, inviter le client), /app/agence/marque (marque, aperçu rapport + e-mail, domaine
  d'envoi et DNS), /app/validation (le client valide ou refuse ; l'agence applique), /app/rapports/mensuel (imprimable,
  A4, PDF via le navigateur), routes /app/agence/{demo,ouvrir,export}. Lien « Tous mes clients » dans la coquille et
  « Plus » ; « À valider » dans Agir ; lien « Rapport mensuel » dans /app/rapports.
- Démo : `/app?compte=demo-agence` → « Agence Exemple » (fictive) + Plomberie Martin, Paysia, Maison Sora (mêmes mesures
  que les démos existantes) + Atelier Verne (nouveau client sans mesure). Tout étiqueté démo, rien enregistré.
- Captures : qa/v6/AGENCES/ (1440 et 390, clair et sombre : agence, marque, validation, rapport mensuel).
- Demande OPS (MesureError → reportClientError) faite.

## Modifications minimales hors périmètre (nécessaires, relues avant)
- src/lib/email.ts : `from?` et `replyTo?` facultatifs dans sendEmail (3 lignes).
- src/lib/notify/reports.ts : l'envoi programmé prend la marque de l'agence par défaut et son expéditeur ; pied
  « Rapport préparé par <agence> ».
- src/lib/auth/routing.ts : `?compte=demo-agence` → /app/agence/demo.

## Reste
- Vente de l'offre Agence : toujours en liste d'attente (api/checkout) — décision du fondateur.
- Pas d'API publique ; pas de domaine propre pour la PLATEFORME (portail client sur le domaine de l'agence, comme
  Semrush Business / SE Ranking) ; pas d'espaces « pitch » (Peec) ; PDF serveur du rapport mensuel (aujourd'hui :
  impression navigateur) ; retrait d'un client valideur ne retire pas son accès Lecteur (Réglages › Équipe).
- Domaine d'envoi : à tester avec une vraie clé Resend à la mise en ligne.
- CGV / confidentialité à compléter (domaine d'envoi, client valideur) : juridique.

## À faire par d'autres
- SITE-SEO-90 : /tarifs, FAQ, features-data, comparatif → docs/v6/demandes-SITE-SEO-90.md § « De AGENCES ».
