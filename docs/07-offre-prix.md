# 07 — Offre et prix (agent OFFRE ET PRIX)

Tous les prix sont **HT** (cible B2B). Si le fondateur est en franchise en base de TVA (art. 293 B du CGI), HT = TTC et la mention légale doit figurer sur les factures : à confirmer avec le comptable et l'agent juridique.

## 1. Ce que dit le marché (recherches)

| Source | Constat |
|---|---|
| [La Fabrique du Net](https://www.lafabriquedunet.fr/logiciels/comparateur/partoo-vs-guest-suite) | Guest Suite : à partir de 39 € (Pack Étoiles) ou 49 € (Pack Visibilité) par mois et par établissement, pour indépendants. Partoo : tarifs sur devis, options facturées à part. Custplace : tarif non publié. |
| [Software Advice](https://www.softwareadvice.com/local-marketing/brightlocal-profile/) | BrightLocal : 39 $ (Track), 49 $ (Manage), 59 $ (Grow) par mois. Essai gratuit. |
| [Hayot Expertise](https://hayot-expertise.fr/blog/frais-stripe-paypal-mollie-klarna-comparatif-optimisation-ecommerce-2026) | Stripe France : 1,5 % + 0,25 € (cartes françaises), 1,4 % + 0,25 € (autres cartes EEE), 3,25 % + 0,25 € (hors EEE). |
| [dev.to comparatif 2026](https://dev.to/jettfu/stripe-vs-paddle-vs-lemon-squeezy-fee-comparison-2026-2c77) | Paddle et Lemon Squeezy : 5 % + 0,50 $, merchant of record (TVA calculée, collectée, déclarée). Stripe Tax : +0,5 %, calcule mais ne déclare pas. Litige Stripe : 15 $. |
| [Userpilot / ChartMogul 2026](https://userpilot.com/blog/saas-average-conversion-rate) | Freemium standard : 3-5 % gratuit vers payant (bon), 8-12 % (excellent). Essai sans carte : 4-6 %. Essai avec carte : 25-35 %. |

Limites : les prix Partoo/Custplace ne sont pas publics (donc pas de comparaison chiffrée fiable, ne pas les citer dans la com'). Les chiffres Stripe Billing (environ 0,7 % du récurrent) et SEPA (environ 0,8 %, plafonné) viennent de ma connaissance, non revérifiés : à confirmer sur stripe.com/fr/pricing avant le lancement.

## 2. Verdict sur 29 €/mois

**Oui, 29 € est un bon prix d'entrée, à garder.** Raisons :
- Les outils d'avis/visibilité locale coûtent 39-59 € par mois et par établissement ; 29 € se place sous le seuil psychologique des 30 € pour un artisan, sans passer pour un gadget.
- Notre coût marginal est faible (quelques appels API par audit, estimé 0,3 à 1 € par audit mensuel, à mesurer) : marge brute supérieure à 90 % après frais Stripe.
- Le produit est nouveau (visibilité dans les IA) : pas d'ancre de prix existante, donc on s'ancre sur Guest Suite/BrightLocal.
- Ne pas monter à 39 € avant d'avoir 50 abonnés : test A/B 29 vs 39 € une fois le trafic suffisant.

## 3. Paliers retenus

| Palier | Prix HT | Pour qui | Rôle |
|---|---|---|---|
| Audit gratuit | 0 € | Tout le monde | Aimant à leads, tient lieu d'essai |
| Plan d'action | 149 € une fois | Veut agir maintenant | Revenu immédiat, preuve de valeur |
| **Démarrage (bundle, mis en avant)** | **199 € une fois** (plan + 3 mois de suivi) | Le choix par défaut | Économise 37 €, installe l'habitude |
| Suivi | 29 €/mois ou 290 €/an | Veut surveiller | Revenu récurrent |
| Pro | 79 €/mois ou 790 €/an | Multi-établissements (jusqu'à 5) : groupes de 2-5 restaurants, cabinets, franchisés | Soit environ 16 € par établissement |
| Agence | 149 €/mois ou 1 490 €/an | Agences web/SEO/community managers : 20 clients inclus, +6 €/client, marque blanche | Canal de distribution |

**Pro : oui**, car 3 abonnés Suivi du même groupe seraient à 87 € ; 79 € pour 5 est une remise visible et réduit le churn. À livrer en phase 2 (mois 3-4), le code multi-établissement est le plus lourd.
**Marque blanche agences : oui, mais en phase 3 (mois 4-6)** et d'abord en précommande/liste d'attente. Les agences amènent 10-30 clients chacune : c'est le meilleur levier d'acquisition pour un fondateur solo.

## 4. Annuel, garantie, essai

- **Annuel = 10 mois pour 12** (290 €, 790 €, 1 490 €). Proposé sur la page de paiement et par e-mail au mois 2 (quand l'utilisateur a vu une évolution de score). Le churn mensuel TPE est élevé (8-10 %) ; l'annuel le supprime pour ces clients et avance la trésorerie.
- **Pas d'essai gratuit du Suivi** : l'audit gratuit est l'essai. Un essai sans carte convertit 4-6 % seulement, un essai avec carte freine l'inscription. Le Suivi reste « sans engagement, résiliable en un clic ».
- **Garantie** : plan d'action remboursé sous 14 jours si non satisfait ; Suivi remboursé le premier mois sur demande. Pas de garantie de résultat (« +X points ») : les IA sont non déterministes, le risque juridique et commercial est trop élevé. Le droit de rétractation consommateur ne s'applique en principe pas au B2B : à valider par l'agent juridique, mais l'engagement commercial reste.

## 5. Enchaînement du parcours

1. **Audit gratuit** (e-mail obligatoire pour recevoir le PDF). Le PDF montre le score, 3 concurrents cités à la place du commerce et **un seul** conseil détaillé ; le reste est verrouillé.
2. **J0, sur la page rapport** : bandeau « Démarrage 199 € » (offre principale), lien secondaire « Plan d'action seul 149 € ».
3. **J+1, J+3, J+7 (e-mails Resend)** : concurrent qui progresse, étude de cas, rappel de l'offre. J+14 : dernière relance, sans remise permanente.
4. **Achat du Plan d'action seul** : à la livraison (J+2), proposer « Ajoutez 3 mois de suivi pour 50 € de plus » (199 - 149 = 50), valable 7 jours.
5. **Mois 2 du suivi** : e-mail montrant l'évolution du score + offre annuelle (2 mois offerts).
6. **Mois 3** : audit de contrôle, avant/après, puis proposition de Pro si plusieurs établissements, ou parrainage (1 mois offert).

**Vente incitative** : (a) bump de commande « 3 mois de suivi +50 € » sur le plan d'action seul ; (b) annuel au mois 2 ; (c) Pro si un second établissement est ajouté ; (d) audit d'un concurrent ou d'un second métier à la demande (option future, 19 €).

**Remises** : aucune remise permanente (elle ancre un prix bas). Une seule offre de lancement : 10 premiers clients à 99 € le plan d'action en échange d'un témoignage. Les remises passent par des coupons Stripe à durée limitée.

## 6. Agences revendeuses

- **Plan Agence : 149 €/mois, 20 clients inclus, +6 €/client**, soit 7,45 € le client à pleine charge, marge de l'agence si elle revend 29 € : environ 21 € par client. Marque blanche (logo, couleurs, domaine de rapport), audits prospects illimités.
- **Plans d'action à tarif revendeur : 99 €** (au lieu de 149 €), l'agence les revend 149-299 €.
- **Alternative sans abonnement** (agences qui testent) : commission de 30 % sur les ventes via un lien partenaire, versée au mois suivant. À lancer d'abord, car sans développement marque blanche : code promo/lien Stripe avec metadata `partner_id`.
- Cibler : agences web locales, community managers, courtiers en réputation, réseaux d'experts-comptables. Pitch : « un audit gratuit à envoyer à vos 30 clients ».

## 7. Frais de paiement et TVA : Stripe, Lemon Squeezy ou Paddle

| Critère | Stripe | Lemon Squeezy / Paddle |
|---|---|---|
| Frais | 1,5 % + 0,25 € (cartes FR) + Billing (~0,7 %, à vérifier) | 5 % + 0,50 $ |
| Sur 29 € | environ 0,69 € + 0,20 € = 0,9 € (3,1 %) | environ 1,95 € (6,7 %) |
| Sur 199 € | environ 3,2 € (1,6 %) | environ 10,5 € (5,3 %) |
| TVA | Stripe Tax (+0,5 %) calcule ; vous déclarez. En France B2B, on peut aussi fixer simplement un taux 20 % | MoR : ils déclarent et reversent |
| Factures FR | Stripe Invoicing OK (SIREN, TVA client à saisir) | Facture au nom du MoR, pas de votre entité |
| Litiges | 15 $ par litige | Pris en charge |

**Décision : Stripe seul.** Un MoR sert surtout pour la vente B2C internationale (OSS, TVA dans 27 pays). Ici, clientèle B2B 100 % française : la TVA est la TVA française à 20 %, simple à déclarer. Un MoR coûterait 2 à 3 fois plus cher en frais (4 à 6 points de marge perdus sur chaque vente) et la facture ne serait pas au nom de l'entreprise, ce qui gêne une TPE française. Stripe Tax : inutile au départ (taux fixe 20 %, économie de 0,5 %) ; à activer si l'on vend hors de France. **Quand reconsidérer** : vente B2C hors UE ou hors France à plus de 10 % du CA.

Autres points : Stripe est déjà dans la stack, le webhook et les Payment Links sont prévus, et le fondateur est aligné avec le budget 0-50 €. Activer le SEPA Direct Debit pour l'annuel et le Pro (frais plafonnés, plus bas que la carte), et le portail client Stripe pour résilier et changer de plan sans développement.

## 8. Projections à 3, 6 et 12 mois

Hypothèses explicites (modèle recalculable, mois 1 = lancement) :

| Hypothèse | Prudent | Base | Optimiste |
|---|---|---|---|
| Audits gratuits/mois (mois 1 → 12) | 40 → 340 | 60 → 700 | 100 → 1 400 |
| Audit → Plan d'action seul | 1,5 % | 2 % | 3 % |
| Audit → Suivi direct | 1,5 % | 2 % | 3 % |
| Audit → Démarrage 199 € | 0,4 % | 0,6 % | 1 % |
| Plan d'action seul → Suivi | 30 % | 40 % | 45 % |
| Démarrage → Suivi payant après 3 mois | 65 % | 65 % | 65 % |
| Churn mensuel du Suivi | 10 % | 8 % | 7 % |
| Pro : audits → Pro dès le mois 4 | 0 | 0,2 % | 0,2 % |
| Agences (abonnées en fin de période) | 0 | 4 | 10 |

Conversion totale audit → client payant : 3,4 % (prudent), 4,6 % (base), 7 % (optimiste), dans la fourchette « bon » d'un freemium (3-5 %, 8-12 % excellent). Un audit gratuit à valeur perçue forte (score + concurrents nommés) justifie le haut de la fourchette, mais c'est une hypothèse à valider dès les 100 premiers audits.

| Scénario | Mois | Abonnés Suivi | MRR | Ventes uniques du mois | CA du mois | CA cumulé |
|---|---|---|---|---|---|---|
| Prudent | 3 | 4 | 110 € | 303 € | 414 € | 830 € |
| Prudent | 6 | 12 | 416 € | 576 € | 992 € | 3 196 € |
| Prudent | 12 | 36 | 1 327 € | 1 031 € | 2 358 € | 13 957 € |
| **Base** | 3 | 9 | 261 € | 710 € | 971 € | 1 863 € |
| **Base** | 6 | 31 | 1 180 € | 1 461 € | 2 640 € | 8 021 € |
| **Base** | 12 | 105 (+ 7 Pro, 4 agences) | 4 219 € | 2 922 € | 7 141 € | 39 380 € |
| Optimiste | 3 | 26 | 747 € | 2 067 € | 2 815 € | 5 248 € |
| Optimiste | 6 | 95 | 3 476 € | 4 522 € | 7 998 € | 23 821 € |
| Optimiste | 12 | 338 (+ 14 Pro, 10 agences) | 12 429 € | 9 044 € | 21 473 € | 117 121 € |

Lecture : à 3 mois, le revenu vient surtout du Plan d'action et du bundle (ventes uniques), pas de l'abonnement. À 12 mois en scénario de base, environ 4 200 € de MRR, dont 1 800 € (4 agences + 7 Pro environ) hors Suivi. Chiffres HT, avant frais Stripe (environ 2 à 3 %) et avant coûts API. Le trafic (audits/mois) est l'hypothèse la plus risquée : elle dépend du SEO programmatique et de la prospection, pas du prix. Indicateurs à suivre : audit → e-mail, e-mail → achat, churn à 90 jours.

## 9. Objets Stripe à créer

Convention : mode live et test identiques. Tous les prix en EUR, `tax_behavior: exclusive`, TVA 20 % via un `tax_rate` fixe (`txr_...` créé une fois) appliqué sur chaque ligne de Payment Link/Checkout. Chaque Price a un `lookup_key` stable utilisé par le code (`src/lib/stripe.ts`), pas d'ID en dur.

**Produits (`metadata` commune : `app=auditia`, `plan_id` = id de `07-plans.json`)**

| Product | metadata | Price (lookup_key) |
|---|---|---|
| Plan d'action AuditIA | `kind=one_time`, `plan_id=action_plan`, `delivers=action_plan_pdf` | `action_plan_once` : 14 900 c, one_time |
| Démarrage AuditIA | `kind=bundle`, `plan_id=bundle_start`, `includes_months=3`, `delivers=action_plan_pdf` | `bundle_start_once` : 19 900 c, one_time |
| Suivi AuditIA | `kind=subscription`, `tier=suivi`, `max_businesses=1`, `competitors=3` | `suivi_month` : 2 900 c / month ; `suivi_year` : 29 000 c / year |
| Pro AuditIA | `kind=subscription`, `tier=pro`, `max_businesses=5`, `competitors=5` | `pro_month` : 7 900 c ; `pro_year` : 79 000 c |
| Agence AuditIA | `kind=subscription`, `tier=agency`, `max_businesses=20`, `whitelabel=true` | `agency_month` : 14 900 c ; `agency_year` : 149 000 c ; `agency_extra_client` : 600 c / month, metered ou quantité (client supplémentaire) |
| Plan d'action revendeur | `kind=one_time`, `tier=agency_reseller` | `action_plan_reseller` : 9 900 c, one_time |

**Payment Links**

| Lien | Contenu | Paramètres |
|---|---|---|
| `pl_bundle` | `bundle_start_once` + `suivi_month` | `subscription_data.trial_period_days=90` pour que le 29 € démarre après les 3 mois inclus ; carte enregistrée ; mention explicite du renouvellement automatique et de la résiliation libre ; metadata `plan_id=bundle_start` |
| `pl_action_plan` | `action_plan_once` | Option `optional_items`/order bump : `suivi_month` avec `trial_period_days=90` pour +50 € (créer un Price `bump_3m` 5 000 c one_time si on préfère un montant fixe) ; `invoice_creation.enabled=true` |
| `pl_suivi_month`, `pl_suivi_year` | Suivi | `allow_promotion_codes=true`, `billing_address_collection=required`, `tax_id_collection.enabled=true` (SIREN/TVA client) |
| `pl_pro_month`, `pl_pro_year` | Pro | idem |
| `pl_agency_month`, `pl_agency_year` | Agence | `adjustable_quantity` sur `agency_extra_client` (0 à 100) |

Chaque lien : `client_reference_id` ou `metadata.audit_id` ajoutés côté Checkout Session (via l'API) quand on vient du rapport, afin de relier le paiement à l'audit. Les Payment Links statiques servent aux e-mails et aux partenaires.

**Autres objets**
- **Coupons** : `launch99` (100 € de remise sur le plan d'action, 10 utilisations max) ; `agency30` (partenaires, 30 %, durée `forever` pour la commission, `metadata.partner_id`).
- **Customer portal** : activé (résiliation, changement mensuel/annuel, mise à jour de la carte, factures).
- **Webhook** `/api/stripe/webhook` : `checkout.session.completed` (livrer le plan d'action, créer le droit d'accès), `customer.subscription.created|updated|deleted` (activer/couper le suivi selon `tier` et `max_businesses`), `invoice.payment_failed` (relance), `charge.dispute.created`. Idempotence sur `event.id`.
- **Clés métadonnées côté Customer** : `business_id`, `audit_id`, `source` (landing, seo, agence), `partner_id`.

## 10. Plan de mise en œuvre

1. Semaine 0 : Stripe test, produits et prix Démarrage/Plan d'action/Suivi, trois Payment Links, webhook.
2. Mois 1 : lancement avec ces trois offres + annuel du Suivi.
3. Mois 3-4 : Pro (multi-établissements) et lien de parrainage/commission agence.
4. Mois 4-6 : marque blanche, plan Agence, plans d'action revendeur.
5. Revue à 100 audits : taux audit → paiement ; à 50 abonnés : test 29 vs 39 €.

## 11. Risques et points ouverts

- Statut TVA du fondateur (franchise ou non) : à trancher avant la première facture.
- Droit de rétractation et CGV (renouvellement automatique du bundle) : agent juridique.
- Coût API réel par audit : à mesurer pour confirmer les marges (Pro à 5 établissements, Agence à 20 clients).
- Frais Stripe Billing/SEPA à revérifier sur la page tarifs officielle.
- Churn TPE potentiellement supérieur à 10 % : l'annuel et le rapport d'évolution sont les deux leviers.
