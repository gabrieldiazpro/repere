# QA contenu — Repéré (revue du 9 novembre 2026)

Périmètre : `/home/claude/auditia/app/src/**`, `app/public/llms.txt`, `app/scripts/write-emails.ts`, `/home/claude/auditia/demo/index.html`, `docs/06-juridique.md`, `docs/07-offre-prix.md`. Lecture seule, aucun fichier du projet modifié.
Les numéros de ligne sont ceux de la lecture du jour. D'autres agents modifient le code en parallèle : rechercher le texte exact plutôt que la ligne.

Légende gravité : **P0** à corriger avant toute vente ou envoi ; **P1** avant le lancement public ; **P2** confort et finition.

---

## 0. Synthèse

**78 corrections numérotées** (15 P0, 34 P1, 29 P2 ; quelques-unes se recoupent, par exemple J2b et L1).

Les 5 plus importantes :
1. **Aucune mention « TVA non applicable, art. 293 B du CGI » dans le produit**, et le copy dit le contraire : « Prix hors taxes… la TVA applicable est ajoutée » (landing, /tarifs), « Prix TTC » (démo). Faux pour un micro-entrepreneur en franchise (C1, C2).
2. **La garantie « remboursé sous 14 jours si non satisfait »** (plan d'action) **contredit les CGV art. 7**, qui disent que le droit de rétractation est perdu à la livraison. Les CGV ne couvrent pas non plus Démarrage, Pro, Agence ni les formules annuelles (C3, C4, J3).
3. **Pro et Agence sont vendus (CTA, prix) alors que `docs/07` les planifie aux mois 3 à 6** et que le code ne contient ni marque blanche ni tableau de bord multi-établissements : risque de pratique commerciale trompeuse (C5).
4. **Case de consentement unique** (obligatoire, texte « réaliser mon audit + envoyer le rapport ») **enregistrée comme `marketing_consent`**. Le lien de désinscription des e-mails de prospection (`/desinscription?h=…`) **n'existe pas**. Le script signe « AuditIA Local » (J1, J2, L1).
5. **Promesses de résultat implicites** : « passer devant {concurrent} », « Soyez celui que l'IA recommande », « Ces 3 gestes font déjà bouger les choses », « En 14 jours, la plupart des commerces appliquent… » (J5 à J9).

Chiffres externes : 6 sur 7 vérifiés à la source primaire ou secondaire fiable. **Un chiffre inexact ou à nuancer** : « un Français sur deux » (la source dit 52 %, un article dit 50 %). La base statistique de « 43 % à Paris » est fragile (F2, F3).
Aucun prix de concurrent n'est affiché dans `src/**` ni dans la démo (recherche par mots-clés : aucun résultat). Les prix de `docs/07` sont en revanche périmés (F8).

---

## 1. Vérification des faits

### 1.1 Tableau de vérification

| # | Affirmation affichée | Où | Verdict | Valeur correcte / source |
|---|---|---|---|---|
| F1 | « 48 % des Français ont déjà utilisé une IA comme ChatGPT en 2025 » (Crédoc / Arcep, Baromètre du numérique 2026) | `app/page.tsx` PROOF ; démo | **Vérifié, à préciser** | Arcep, communiqué du 9 février 2026 : « L'IA générative est désormais utilisée par 48 % de la population » (+15 pts en un an). Base : 4 145 personnes de **12 ans et plus**, terrain en juin 2025. Étude réalisée par le Crédoc pour **l'Arcep, l'Arcom, le CGE et l'ANCT**, pas pour l'Arcep seule. Le PDF Crédoc cité confirme 48 % (33 % en 2024, 20 % en 2023). |
| F2 | « Un Français sur deux s'en sert chaque semaine » (Eskimoz × Ipsos, mai 2026) | `app/page.tsx` PROOF ; démo | **Inexact à la marge** | CB News (27 mai 2026) et un second blog : **52 %** utilisent une IA générative au moins une fois par semaine (29 % un an plus tôt). SiècleDigital (le lien cité) écrit 50 %. Base : 1 000 personnes de **18 à 75 ans**, en ligne, terrain du 27 février au 2 mars 2026 ; publication le 27-28 mai 2026. Source primaire Eskimoz introuvable : le lien cité est un article secondaire. |
| F3 | « À Paris, 43 % des habitants utilisent la recherche conversationnelle, contre 24 % dans le reste du pays » | `app/page.tsx` (graphique), démo | **Vérifié, à nuancer** | SiècleDigital : « À Paris, 43 % des habitants recourent déjà à la recherche conversationnelle » ; CB News : « 43 % des Parisiens utilisent une IA pour effectuer leurs recherches, contre 24 % ailleurs ». Aucune fréquence n'est précisée. **Inférence de ma part** : avec 1 000 répondants au total, le sous-échantillon parisien compte probablement quelques dizaines de personnes, donc une marge d'erreur large. Aucun des articles lus ne donne sa taille. |
| F4 | « Des travaux publiés en 2026 (SparkToro et Gumshoe) montrent qu'obtenir deux fois la même liste est très rare, alors que certaines marques reviennent dans la majorité des réponses » | `app/methode/page.tsx` | **Vérifié** | Search Engine Land : étude Rand Fishkin (SparkToro) et Patrick O'Donnell (Gumshoe), 600 volontaires, 12 prompts, près de 3 000 exécutions : probabilité d'obtenir la même liste < 1 sur 100 ; certaines marques présentes dans 60 à 90 % des réponses. Ajouter un lien. |
| F5 | PagesJaunes « désormais aussi accessible depuis ChatGPT (application lancée en juin 2026) » | `lib/seo/index.ts` (const `PJ`), affiché sur les pages métier | **Vérifié** | Communiqué Solocal du 29 juin 2026 ; accessible aux utilisateurs français depuis le 22 juin. Application gratuite, construite avec l'Apps SDK d'OpenAI. |
| F6 | « Le nombre d'avis Google est le signal le plus corrélé à la présence dans les réponses des IA » | `lib/engine/data/actions.json` A03 (affiché dans le plan) | **Vérifié, source non citée** | Insites, rapport « AI Visibility » du 5 mai 2026, 10 000 commerces, ChatGPT et Perplexity : 133 avis en moyenne pour les commerces visibles sur les deux, contre 11 pour les invisibles. C'est une corrélation, sans causalité, et l'échantillon n'est pas français. |
| F7 | « Facebook est la source d'avis la plus présente dans les résultats Bing Places selon Whitespark » | `actions.json` A11 | **Vérifié, périmètre à indiquer** | Whitespark : 153 requêtes, 17 catégories, **9 grandes villes américaines**. Facebook apparaît chez environ 1,5 fois plus d'entreprises que Yelp. Transposition à la France non démontrée. |
| F8 | Prix BrightLocal « 39 $ (Track), 49 $ (Manage), 59 $ (Grow) » | `docs/07-offre-prix.md` §1 (non affiché sur le site) | **Inexact** | brightlocal.com/pricing : Track 31 $/mois en annuel (41 $ en mensuel), Manage 40 $ (54 $), Grow 49 $ (65 $). Le Local AI Visibility Tracker est inclus dans Track. `docs/02-concurrence.md` est correct (31 $ / 41 $). Corriger `docs/07` : le prix de Guest Suite (39 / 49 €) n'a pas été revérifié. |
| F9 | Otterly Lite 29 $ (15 prompts), Standard 189 $, Premium 489 $ | `docs/02` (non affiché) | **Vérifié** | otterly.ai/pricing : Lite 29 $ (25 $ en annuel), Standard 189 $, Premium 489 $ ; 15, 100 et 400 prompts. |
| F10 | « Reddit est l'un des sites les plus cités par ChatGPT et Perplexity » | `actions.json` A25 | **Non revérifié** | La source (Semrush, 230 000 requêtes) vient de `docs/05`, qui note « très instable » (60 % début août, environ 10 % mi-septembre). Ajouter « selon une étude Semrush de 2025, variable dans le temps ». |
| F11 | Dates légales de `docs/06` : démarchage téléphonique avec consentement préalable au **11 août 2026** | `docs/06` §0, §1.2 | **Vérifié** (secondaire) | Entrée en vigueur le 11 août 2026, décret publié au JO le 25 juillet 2026. Aucune source lue ne dit si le B2B est couvert. `docs/06` a raison de rester prudent. **Correction de `docs/06` : la page economie.gouv « Bloctel professionnels » n'est pas obsolète de 2018.** Elle porte une date de mise à jour du 30 juillet 2026 dans les résultats de recherche, mais la lecture de la page ne montre que le contenu de 2018. Revérifier à la main. |
| F12 | Seuils micro-entreprise 2026 : 83 600 € (services) ; franchise de TVA 37 500 € | `docs/06` §6 | **Vérifié** (secondaire) | Plafond micro de services 83 600 € pour 2026-2028 (77 700 € avant) ; seuil de franchise de TVA 37 500 €, inchangé. **Seuil majoré 41 250 € : non confirmé par la page lue**, à vérifier sur impots.gouv.fr. |
| F13 | AI Act : obligations de transparence (art. 50) applicables depuis le 2 août 2026 | `docs/06` §7 | **Plausible** | Un cabinet d'avocats (Goodwin, août 2026) titre « transparency obligations now in force ». Source secondaire seulement, à valider sur EUR-Lex. |
| F14 | Articles de loi cités dans les CGV : L.441-10 (40 € d'indemnité de recouvrement), L.221-25, 1218 du Code civil, CNIL 72 h | `app/cgv/page.tsx`, `confidentialite/page.tsx` | **Cohérents avec le droit connu** | Non relus sur Légifrance (non consulté), ils restent marqués [À VÉRIFIER] : à conserver. |

### 1.2 Corrections factuelles

**C-F2 (P1)** — `app/src/app/page.tsx`, tableau `PROOF`, 2e entrée.
- Actuel : `strong: "Un Français sur deux"`, `text: "s'en sert chaque semaine."`, `source: "Eskimoz × Ipsos, 2026"`
- Proposé : `strong: "52 % des Français"`, `text: "utilisent une IA générative au moins une fois par semaine."`, `source: "Observatoire Eskimoz × Ipsos, mai 2026 (1 000 personnes de 18 à 75 ans)"`. Remplacer aussi le lien par la source primaire d'Eskimoz si elle est retrouvée, sinon par l'article CB News.
- Même correction dans `demo/index.html` (bloc « Un Français sur deux s'en sert chaque semaine ») : « 52 % des Français utilisent une IA générative chaque semaine ».

**C-F1 (P2)** — `page.tsx` PROOF 1re entrée, et `demo/index.html`.
- Actuel : `text: "ont déjà utilisé une IA comme ChatGPT en 2025."`, `source: "Crédoc / Arcep, Baromètre du numérique 2026"` (démo : « Crédoc pour l'Arcep, Baromètre du numérique 2026 »).
- Proposé : `text: "(12 ans et plus) ont utilisé une IA générative comme ChatGPT en 2025."`, `source: "Crédoc pour l'Arcep, l'Arcom, le CGE et l'ANCT, Baromètre du numérique 2026"`.

**C-F3 (P1)** — `page.tsx`, figure « Utilisent la recherche conversationnelle », et `demo/index.html` (« À Paris, 43 % des habitants utilisent la recherche conversationnelle »).
- Ajouter sous le graphique : « Enquête en ligne auprès de 1 000 personnes de 18 à 75 ans ; l'écart Paris / reste de la France porte sur un petit échantillon parisien. »
- Définir le jargon : remplacer « Utilisent la recherche conversationnelle » par « Font leurs recherches avec une IA conversationnelle (type ChatGPT) ».
- Démo, ligne « Même source, contre 24 % dans le reste du pays » : conserver, mais ajouter « (enquête Observatoire Eskimoz × Ipsos, mai 2026) ».

**C-F4 (P2)** — `app/src/app/methode/page.tsx`, paragraphe « Pourquoi plusieurs exécutions ».
- Actuel : « Des travaux publiés en 2026 (SparkToro et Gumshoe) montrent… »
- Proposé : transformer « SparkToro et Gumshoe » en lien vers l'article Search Engine Land, et ajouter « (600 volontaires, près de 3 000 exécutions) ».

**C-F6 (P2)** — `lib/engine/data/actions.json`, A03 `why`.
- Actuel : `"Le nombre d'avis Google est le signal le plus corrélé à la présence dans les réponses des IA."`
- Proposé : `"Dans une étude de 10 000 commerces (Insites, 2026), le nombre d'avis Google est le signal le plus lié à la présence dans les réponses de ChatGPT et Perplexity. Il s'agit d'un lien statistique, pas d'une garantie."`

**C-F7 (P2)** — `actions.json`, A11 `why`.
- Actuel : `"Facebook est la source d'avis la plus présente dans les résultats Bing Places selon Whitespark."`
- Proposé : `"Dans une étude américaine de Whitespark (9 villes), Facebook est la source d'avis la plus présente dans les résultats Bing Places. Peu de données existent pour la France."`

**C-F10 (P2)** — `actions.json`, A25 `why`.
- Actuel : `"Reddit est l'un des sites les plus cités par ChatGPT et Perplexity, notamment pour les avis et recommandations."`
- Proposé : `"Selon une étude Semrush de 2025, Reddit figure parmi les sites les plus cités par ChatGPT et Perplexity, avec de fortes variations d'un mois à l'autre."`

**C-F8 (P1)** — `docs/07-offre-prix.md` §1, ligne BrightLocal.
- Actuel : « BrightLocal : 39 $ (Track), 49 $ (Manage), 59 $ (Grow) par mois. Essai gratuit. »
- Proposé : « BrightLocal : 31 $ / 40 $ / 49 $ par mois en facturation annuelle (41 $ / 54 $ / 65 $ en mensuel), essai 14 jours ; Local AI Visibility Tracker inclus dans Track. » Le verdict « 29 € se place sous les 39-59 € des concurrents » doit être reformulé : BrightLocal démarre à 31 $.

**C-F11 (P1)** — `docs/06-juridique.md` §1.2, dernière puce : remplacer « La page economie.gouv "Bloctel professionnels" … date de 2018 : elle est obsolète » par « Page consultée le 9 novembre 2026 : contenu daté de 2018, qui ne mentionne pas la réforme du 11 août 2026 ; ne pas en tirer de conclusion sur le B2B ». Pas de changement de règle interne.

**C-F12 (P2)** — `docs/06` §6, ligne « Franchise en base de TVA, services » : ajouter « [seuil majoré 41 250 € non confirmé, à vérifier sur impots.gouv.fr] ».

### 1.3 Autres affirmations factuelles internes à contrôler

**C-F15 (P1)** — `app/page.tsx`, `PROBLEMS[1].text`.
- Actuel : « Dans une réponse d'IA, il n'y a souvent que trois recommandations. »
- Statut : **introuvable** dans les sources lues, et contredit par `/methode` (rang jusqu'à 6, « 1er = 100 %, 6e et au-delà = 0 % »).
- Proposé : « Une réponse d'IA ne cite en général que quelques noms. » Même retouche pour `ChatScene.tsx` et la section « Quand un client demande… l'IA répond avec trois noms » (c'est un exemple : ajouter « par exemple »).

**C-F16 (P1)** — `app/page.tsx` ligne 294.
- Actuel : « Même question, trois IA : souvent le même nom en tête. »
- Problème : contredit `/methode` (la même liste est très rare) et la section « Les IA ne répondent pas toutes pareil » du rapport.
- Proposé : « Même question, trois IA : pas toujours les mêmes noms. »

---

## 2. Cohérence de l'offre

### 2.1 Matrice

| Élément | Landing | /tarifs | Rapport web | PDF | App (/app/reglages) | CGV | Démo |
|---|---|---|---|---|---|---|---|
| Plan d'action | 149 € (non cité en carte) | 149 €, une fois | 149 € | 149 € | n/a | prix [À COMPLÉTER] | absent |
| Démarrage | 199 € | 199 € | 199 € | **absent** | n/a | **absent** | 199 € |
| Suivi | « Suivi » 29 €/mois | « Suivi » 29 €/mois | « Suivi mensuel » | « Suivi mensuel » | « Suivi mensuel » | « Suivi mensuel » | « Suivi » |
| Annuel / Pro / Agence | « Voir les 9 offres » | oui | **absent** | absent | Pro, Agence | **absent** | absent |
| HT / TTC | « hors taxes » | « hors taxes… TVA ajoutée » | **rien** | **rien** | rien | placeholder « 293 B / HT » | **« Prix TTC »** |
| Garantie | rien | plan d'action 14 j | plan d'action 14 j | rien | rien | **perte du droit après livraison** | rien |
| Résiliation | « 1 clic » | « 1 clic » | « 1 clic » | « sans engagement » | « 1 clic » | « [3 clics maximum] » | « résiliable en 1 clic » |
| Délai plan d'action | rien | rien | « livré par e-mail et espace » | rien | e-mail « sous 48 h » | « [48 h ouvrées] » | n/a |

### 2.2 TVA : franchise en base, art. 293 B du CGI (le point le plus important)

**C1 (P0)** — Ajouter la mention de franchise, définie une seule fois. Aujourd'hui `293 B` n'apparaît que dans deux placeholders : `mentions-legales/page.tsx` (ligne TVA) et `cgv/page.tsx` art. 2b. Aucune page tarifaire, aucun e-mail ni PDF ne la porte.
- `app/src/lib/plans.ts` : ajouter `export const VAT_NOTICE = "TVA non applicable, art. 293 B du CGI";` et l'importer partout. Quand le seuil de 37 500 € sera dépassé, ce sera le seul fichier à changer (avec le `STRIPE_TAX_RATE_ID`).
- Dans Stripe : renseigner le pied de facture avec « TVA non applicable, art. 293 B du CGI » et laisser `STRIPE_TAX_RATE_ID` vide (le README et `.env.example` le prévoient déjà).

**C2 (P0)** — Remplacer partout « hors taxes » / « TTC ».

| Fichier | Texte actuel | Texte proposé |
|---|---|---|
| `app/page.tsx` (sous les cartes) | « Prix hors taxes. Paiement sécurisé par Stripe. Facture disponible pour votre comptabilité. » | « Prix nets : TVA non applicable, art. 293 B du CGI. Paiement sécurisé par Stripe. Facture disponible pour votre comptabilité. » |
| `app/tarifs/page.tsx` (sous le tableau) | « Prix hors taxes. Paiement sécurisé par Stripe. Facture disponible pour votre comptabilité. » | même texte que ci-dessus |
| `app/tarifs/page.tsx` FAQ « Les prix sont-ils HT ou TTC ? » | « Les prix affichés sont hors taxes. La TVA applicable est ajoutée au moment du paiement et figure sur votre facture, disponible pour votre comptabilité. » | « Les prix affichés sont les prix à payer : TVA non applicable, art. 293 B du CGI. Aucune TVA n'est ajoutée et votre facture le mentionne. » |
| `demo/index.html` (sous les offres) | « Prix TTC. Aucun résultat n'est garanti : personne ne contrôle les réponses des IA. » | « Prix nets, TVA non applicable (art. 293 B du CGI). Aucun résultat n'est garanti : personne ne contrôle les réponses des IA. » |
| `app/tarifs/page.tsx` `metadata.description` | « Audit gratuit, plan d'action à 149 €, suivi à 29 €/mois… » | ajouter « , prix nets sans TVA » (facultatif) |
| `components/report/ReportView.tsx` bloc `reassure` | « Facture fournie » | « Facture fournie · TVA non applicable, art. 293 B du CGI » |
| `lib/pdf/Report.tsx` ligne 291 | « Plan d'action : 149 € une fois. Suivi mensuel : 29 €/mois, sans engagement. » | « Plan d'action : 149 € une fois. Suivi mensuel : 29 €/mois, sans engagement. Prix nets, TVA non applicable (art. 293 B du CGI). » |
| `cgv/page.tsx` art. 2b, 2c | `[À COMPLÉTER : TVA non applicable, art. 293 B du CGI / HT, TVA en sus]` | « Prix en euros, TVA non applicable, art. 293 B du CGI. » (choisir la variante « micro » et supprimer l'autre) |
| `docs/07-offre-prix.md` en-tête | « Tous les prix sont HT » | « Prix nets (franchise en base, art. 293 B du CGI) ; si le seuil est dépassé : prix HT + 20 % » |
| `docs/08-copy.md` ligne 172 | « Prix TTC. » | même texte que ci-dessus |

Ne pas écrire « HT » à côté des prix tant que le fondateur est en franchise : « HT » laisserait croire qu'une TVA va s'ajouter.

**C2b (P1)** — Prévoir le changement : au franchissement du seuil, « 29 € » devient soit « 29 € TTC » (marge réduite), soit « 29 € HT ». `docs/06` §6 le chiffre (29 € → 24,17 €). Le texte « Prix nets » doit être lié à `VAT_NOTICE` pour ne pas rester affiché après le basculement.

### 2.3 Garanties et remboursements

**C3 (P0)** — Contradiction CGV ↔ copy.
- `cgv/page.tsx` art. 7, 2e paragraphe : « Pour le Plan d'action, le Client qui demande une livraison immédiate reconnaît que, une fois le document livré, le droit de rétractation est perdu… »
- `plans.ts`, `tarifs`, `ReportView` : « Remboursé sous 14 jours si non satisfait ».
- Proposé, art. 7 : « Plan d'action : satisfait ou remboursé. Le Client peut demander le remboursement intégral dans les 14 jours suivant la livraison du document, sans justification, en écrivant à [e-mail]. Cet engagement commercial s'ajoute aux droits légaux du Client. » Supprimer ou réserver le paragraphe sur la perte du droit de rétractation (art. L.221-25) au cas où la garantie commerciale serait retirée.
- Préciser dans `plans.ts` (action_plan) : « Remboursé sous 14 jours après réception si non satisfait ».

**C4 (P0)** — `cgv/page.tsx` art. 2 et 6 ignorent Démarrage, les formules annuelles, Pro et Agence.
- Ajouter à l'art. 2 : « d) Démarrage : paiement unique de 199 €, comprenant le Plan d'action et trois mois de Suivi. À l'issue des trois mois, le Suivi continue à 29 € par mois, sauf résiliation avant la fin de la période incluse. e) Formules annuelles du Suivi, de Pro et d'Agence : paiement annuel, reconduction tacite [À COMPLÉTER : rappel par e-mail avant échéance]. f) Pro et Agence : [À COMPLÉTER ou supprimer si l'offre n'est pas ouverte]. »
- `stripe.ts` ligne 95 active un essai de 90 jours (`trial_period_days = 90`) : le passage automatique à 29 €/mois doit être annoncé avant paiement, pas seulement dans les fonctionnalités (« Ensuite 29 €/mois, sans engagement » est déjà là : bien).
- Préciser si la garantie 14 jours couvre Démarrage (le plan d'action en fait partie). Proposé : « Démarrage : plan d'action remboursé sous 14 jours si non satisfait ; le Suivi inclus peut être arrêté à tout moment. »

**C4b (P1)** — `docs/07` §4 prévoit « Suivi remboursé le premier mois sur demande », mais CGV art. 7, 3e paragraphe : « [À COMPLÉTER, option commerciale : premier mois remboursé… ] » et rien sur le site. Trancher : soit l'ajouter à `plans.ts` (suivi_month : « Premier mois remboursé sur demande »), soit supprimer la ligne du doc et de la CGV.

### 2.4 Résiliation et délais

**C6 (P1)** — « en un clic » (landing, tarifs, `PlanCard`, `reglages`) contre « [À COMPLÉTER : 3 clics maximum] » (`cgv` art. 6). Proposé : « Le Client peut résilier à tout moment, en ligne depuis son espace client en un clic, ou par e-mail à [adresse]. »

**C7 (P1)** — « 48 h » contre « 48 h ouvrées ».
- `plans.ts` : « Livré en PDF sous 48 h » ; `email.ts` (achat) : « sous 48 h » ; `cgv` art. 2c : « [48 h ouvrées] » ; footer : « sous 48 h ouvrées » (réponse du support).
- Proposé partout : « livré en PDF sous 2 jours ouvrés ». Ajouter la même formule dans `merci/page.tsx` (« préparé à partir de votre audit et livré par e-mail et dans votre espace » → « …livré par e-mail et dans votre espace sous 2 jours ouvrés »).

**C7b (P2)** — `ReportView.tsx` ligne 237 et `ActionChecklist.tsx` ligne 168 : « Débloquer mon plan : 149 € » / « Débloquer le plan (149 €) ». « Débloquer » laisse penser à un accès immédiat alors que la livraison prend 2 jours ouvrés. Proposé : « Recevoir mon plan d'action : 149 € ».

### 2.5 Offres vendues mais non livrées, noms et écarts

**C5 (P0)** — Pro et Agence affichés avec CTA (`tarifs/page.tsx`, `plans.ts` : « Passer Pro », « Devenir agence partenaire ») alors que `docs/07` §10 place Pro aux mois 3-4 et la marque blanche aux mois 4-6, et que la recherche de « marque blanche », « multi-établissements » et « revendeur » ne retourne aucune ligne de code applicatif. `/app` n'a ni tableau de bord multi-établissements ni rapports à votre nom.
- Proposé : retirer Pro et Agence de `/tarifs` et du `featured` landing tant que non livrés, ou remplacer les CTA par « Rejoindre la liste d'attente » et la mention « Disponible bientôt », et bloquer `isPlanId('pro_*' | 'agency_*')` dans `api/checkout/route.ts`. Même chose pour `plans.ts` : « Tableau de bord multi-établissements », « Rapports PDF à votre nom », « Marque blanche… », « Accès équipe et export des données ».

**C8 (P1)** — `app/page.tsx` ligne 522.
- Actuel : « Voir les {planCount} offres, dont Pro et Agence » (affiche « 9 offres » : `PLANS.length` compte les variantes annuelles et l'audit gratuit).
- Proposé : « Voir toutes les offres, dont Pro et Agence ».

**C9 (P1)** — Fonctionnalité non listée dans l'offre. `app/app/requetes/page.tsx` ligne 74 : « …nous l'ajoutons à votre prochain audit (5 questions personnalisées incluses). » Aucune offre, aucune page de prix ni CGV ne mentionne cette inclusion. Soit l'ajouter à `plans.ts` (Suivi : « Jusqu'à 5 questions personnalisées »), soit retirer la parenthèse.

**C10 (P2)** — Nom de l'offre mensuelle : « Suivi » (landing, tarifs, démo, `plans.ts`) contre « Suivi mensuel » (rapport, PDF, CGV, `reglages`, `docs/06`). Proposé : « Suivi » partout dans les cartes, « Suivi mensuel » seulement quand on le distingue de « Suivi annuel » (CGV, réglages).

**C11 (P2)** — Landing et démo ne montrent que 3 offres (gratuit, Démarrage, Suivi) : cohérent. Mais `/tarifs` compare 5 colonnes dont « Gratuit » et omet Agence du comparatif. Ajouter une 6e colonne ou une phrase « Agence : voir le détail ci-dessus ».

**C12 (P2)** — Écarts démo ↔ app (la démo est une vue « sans serveur », mais les chiffres affichés doivent rester alignés) :
- Démo « Gratuit · 6 questions posées 2 fois · environ 1 minute » ; `/methode` « 8 requêtes, 2 exécutions, 48 réponses ». Si la démo reste à 6 questions, écrire « 6 questions dans cette démo (8 dans l'audit complet) ».
- Démo « tirant les questions au hasard 400 fois » ; `/methode` « 500 tirages » (`scoring.ts` : `BOOTSTRAP_B = 500`). Aligner la démo (« 500 fois ») ou préciser « 400 dans cette démo ».
- Démo « Fiabilité » ; app « niveau de confiance » / « indice de confiance » ; PDF « Fiabilité » + « Niveau de confiance ». Choisir « niveau de confiance » partout.
- Démo, composante C : « part des questions où vous êtes cité au moins une fois » ; `/methode` : « part des IA qui vous citent dans au moins 2 réponses sur 16 ». La formule est la même, pas la définition. Ajouter dans la démo : « (version simplifiée avec une seule IA) ».

---

## 3. Juridique

### 3.1 Consentement, désinscription, prospection

**J1 (P0)** — Consentement marketing fantôme.
- `api/audit/route.ts` : `consent` est commenté « Case "conseils" non pré-cochée (consentement marketing) » puis enregistré par `saveLead({ consent: body.consent })` → `db.ts` : `marketing_consent`.
- Or `AuditForm.tsx` ne contient **qu'une** case, obligatoire (« Cochez cette case pour que nous puissions réaliser votre audit »), dont le texte limite l'usage à « réaliser mon audit et… m'envoyer le rapport ». Cette case valant toujours `true`, tout lead sera marqué « consentement marketing = oui ».
- Proposé : soit renommer le champ (`audit_consent`) et ne jamais alimenter `marketing_consent` avec lui ; soit ajouter une 2e case facultative non pré-cochée : « Je souhaite recevoir par e-mail des conseils pour améliorer ma visibilité IA (désinscription en un clic). »

**J2 (P0)** — Lien de désinscription cassé dans les e-mails de prospection.
- `app/scripts/write-emails.ts` ligne 60 : `const stop = \`${site}/desinscription?h=${sha(email)}\``. Il n'existe pas de page `/desinscription` dans `src/app`. L'API réelle est `/api/unsubscribe?e=…&t=<HMAC>` (`lib/email.ts`).
- Impact : règle E6 de `docs/06` (« lien fonctionnel en un clic ») non respectée ; en cas d'envoi, risque CNIL.
- Proposé : utiliser `unsubscribeUrl(email)` de `lib/email.ts` dans le script, ou créer la route `/desinscription` qui redirige vers l'API.

**J2b (P0)** — Même script, marque : « ${sender}, AuditIA Local, ${address} » → « ${sender}, Repéré, ${address} ». Et dans le texte : « J'ai demandé à ChatGPT… » : passer au « nous » ou garder le « je » mais signer d'une personne (nom du fondateur), car « AuditIA Local » n'existe plus.

**J2c (P1)** — `lib/email.ts` : `sendReportEmail` est de type `transactional`, donc **ignore la liste d'opposition** (`isSuppressed` n'est testé que pour `service` et `marketing`). Si la fonction sert un jour pour un audit de prospection (A1 de `docs/06`), elle enverrait un e-mail à une adresse opposée. Proposé : ajouter `kind: source === 'prospection' ? 'marketing' : 'transactional'` ou interdire cet usage.

**J2d (P1)** — La page de désinscription dit « Vous ne recevrez plus nos e-mails de suivi ni de conseils. » Or l'alerte mensuelle (`kind: 'service'`) est supprimée pour un abonné qui clique « Se désinscrire » : il perd le service payé sans avertissement. Proposé :
- Page de désinscription : « Vous ne recevrez plus nos e-mails de conseils. Si vous êtes abonné, vos alertes mensuelles sont aussi arrêtées : pour les conserver, écrivez-nous. »
- Ou faire passer l'alerte mensuelle en `transactional`.

**J3 (P1)** — Parcours e-mails de `docs/07` §5 (J+1, J+3, J+7, J+14 vers les demandeurs d'audit gratuit) ou ce qui servira à les envoyer ; contre `AuditForm.tsx` : « Pas de spam, promis. » et « Vos informations servent uniquement à réaliser l'audit et à vous envoyer le rapport. » Si ces relances sont envoyées, il faut une base légale (case J1 ou intérêt légitime documenté) et corriger ces deux phrases. Aucun envoi de relance n'est implémenté aujourd'hui (recherche dans `src` et `scripts` : rien).

**J4 (P1)** — Droit d'effacement et rectification (règle A5 de `docs/06`) : lien « Contester ou supprimer cet audit » attendu dans le rapport. `ReportView.tsx` offre seulement « Une erreur ? Un souhait de retrait ? Écrivez à contact@… » ; `confidentialite` §7 garde `[À COMPLÉTER : lien de contestation]`. Proposé : « Contester ou supprimer cet audit » → `mailto:{CONTACT}?subject=Suppression rapport {id}`, et même lien dans la politique de confidentialité. Ajouter aussi la mention « réponse sous 30 jours » (A5).

**J5b (P1)** — `docs/06` A3 : « Pas de "votre commerce est invisible" » dans un audit non sollicité. Or l'échelle de score (`score-bands.ts`, `lib/engine/index.ts`) affiche l'étiquette **« Invisible »** (0 à 39) dans le rapport, le PDF et l'e-mail, y compris pour les rapports de prospection ; et `ReportView.tsx` : « où vous êtes invisible ».
- Proposé : pour `source=prospection`, afficher « Peu cité » à la place ; en titre de matrice : « où vous apparaissez, où vous n'êtes pas cité » ; la page `/methode` « 0 à 39 : Invisible » peut rester pour le grand public.

### 3.2 Pages légales

**J6 (P0)** — Pages `/cgv`, `/mentions-legales`, `/confidentialite` : placeholders `[À COMPLÉTER]` et `[À VÉRIFIER]` visibles, et bandeau « Modèle à faire valider » (`lib/seo/shell.tsx` : `ValidationNotice`) **sur des pages indexables** (`robots: { index: true }`). À régler avant toute vente : compléter, retirer `ValidationNotice`, passer en `noindex` tant que les textes ne sont pas validés par un avocat.

**J7 (P1)** — `mentions-legales/page.tsx` : l'éditeur est « entrepreneur individuel (micro-entrepreneur) exerçant sous le nom commercial « Repéré » », alors que `cgv` art. 1 reste générique (« [À COMPLÉTER : Prénom NOM / raison sociale], [À COMPLÉTER : forme] »). Aligner : « Repéré, nom commercial de [Prénom NOM], entrepreneur individuel (micro-entrepreneur), SIREN [..] ». Même chose dans `confidentialite` §1.

**J8 (P1)** — `confidentialite/page.tsx` : le tableau §2 ne cite pas les **notifications push** (`Settings.tsx`, `SwRegister`) ni le stockage local (progression des actions « sur cet appareil »). §8 dit « Le site n'utilise que des cookies strictement nécessaires (session de connexion) ». Proposé : ajouter une ligne « Notifications (facultatives) : jeton d'abonnement push, préférences ; consentement ; jusqu'à désactivation » et une phrase « Votre progression est mémorisée dans le stockage local de votre appareil ».

**J9 (P1)** — Incohérence périmètre « métiers réglementés ».
- `visibilite-ia/page.tsx` : « Les professions de santé et les professions juridiques ou comptables réglementées ne sont pas auditées sur ce site. »
- `audit/options.ts` (formulaire d'audit) propose pourtant « Dentiste », « Ostéopathe », « Kinésithérapeute », « Avocat », « Expert-comptable » ; `lib/engine/queries.ts` contient 'médecin généraliste', 'psychologue', 'pharmacie'.
- `docs/06` et `docs/12` §6 les excluent.
- Proposé : retirer ces métiers de `options.ts` et du moteur, ou corriger la phrase publique en « ne sont pas **publiées** sur les pages par métier ».

**J10 (P2)** — Noms fictifs « Plombier Express Bastille », « SOS Plomberie Oberkampf », « Allô Plomb 11 », « Plomberie Martin » (landing, `ChatScene.tsx`, démo). Recherche web : aucun résultat exact, mais « Plomberie Express » est un nom courant. Les mentions « Exemple fictif » sont présentes (bien). Garder, ou prendre des noms manifestement inventés (« Plomberie Exemple »).

**J11 (P2)** — `app/page.tsx` ligne 126 : « Serrurier honnête à Paris 20e, sans arnaque ? » : question type, mais elle associe le métier à l'arnaque sur la page d'accueil. Proposé : « Serrurier de confiance à Paris 20e, avec un tarif annoncé à l'avance ? ».

### 3.3 Promesses et chiffres de gain

Aucune promesse de classement explicite (« garantie d'apparaître ») : bien, les FAQ « Garantissez-vous… ? » sont correctes. Aucun pourcentage de gain promis. Mais les formulations suivantes impliquent un résultat.

| # | Fichier | Texte actuel | Texte proposé | Gravité |
|---|---|---|---|---|
| J5 | `ReportView.tsx` l. 209 | « Le plan complet pour passer devant {leader} » / « …pour devenir la référence locale » | « Le plan complet pour vous rapprocher de {leader} » / « …pour améliorer votre visibilité locale » | P0 |
| J6b | `app/layout.tsx` (openGraph.title) | « Soyez celui que l'IA recommande. » | « Découvrez si l'IA vous recommande. » | P0 |
| J6c | `lib/pdf/Report.tsx` l. 305 | « Soyez celui que l'IA recommande. » | « Découvrez si l'IA vous recommande. » | P0 |
| J7b | `ReportView.tsx` l. 200 | « Ces 3 gestes font déjà bouger les choses. » | « Ces 3 gestes sont les plus simples à faire pour commencer. » | P1 |
| J8b | `ReportView.tsx` l. 301 | « En 14 jours, la plupart des commerces appliquent les premières actions. On re-mesure ensuite votre score. » | « Les premières actions se font en général en quelques jours. Nous refaisons ensuite la mesure (incluse avec Démarrage et le Suivi). » (aucune source pour « la plupart des commerces » ; le plan d'action seul n'inclut pas de nouvelle mesure) | P1 |
| J9b | `components/report/derive.ts` (verdict < 25) | « …c'est aussi la situation où les premières actions font la plus grande différence. » | « …c'est aussi la situation où il y a le plus de marge de progression. » | P1 |
| J9c | `derive.ts` (verdict 25 à 49) | « Quelques ajustements bien choisis peuvent vous faire passer devant. » | « Quelques ajustements bien choisis peuvent améliorer votre position. » | P1 |
| J9d | `derive.ts` (verdict ≥ 75) | « Ce type de position se perd aussi vite qu'il se gagne… » | « Ce type de position peut évoluer quand les IA se mettent à jour… » | P2 |
| J9e | `ReportView.tsx` l. 298 / `Report.tsx` l. 305 | « Reprenez la main. » | « Voyons comment progresser. » (impératif de résultat) | P2 |
| J9f | `app/page.tsx` hero | « Vos clients posent désormais ces questions à ChatGPT, Gemini et Perplexity. » | « De plus en plus de clients posent ces questions à une IA comme ChatGPT. » (les chiffres cités sont de 48 % et 52 % d'usage, pas de recherche de commerces) | P1 |
| J10b | `app/page.tsx`, `visibilite-ia`, démo | « les vraies questions de vos clients », « Ce que vos clients demandent vraiment », « requêtes réelles », « questions que vos clients posent réellement » | « des questions types de vos clients », « Des questions typiques de vos clients », « requêtes types » (aucun journal de requêtes réelles ; `/methode` dit « requêtes types », il faut s'aligner) | P1 |
| J11b | `app/page.tsx` FAQ « Pourquoi l'audit est-il gratuit ? » | « Le rapport gratuit est complet. » | « Le rapport gratuit comprend votre score, les réponses des IA, vos concurrents cités et 3 actions à faire. » (le plan complet reste payant et verrouillé dans le même rapport) | P1 |

---

## 4. Langue, vocabulaire, marque

### 4.1 Marque (AuditIA ou Repéré)

Texte visible : « Repéré » partout, **sauf** les points suivants.

| # | Fichier | Constat | Correction | Gravité |
|---|---|---|---|---|
| L1 | `app/scripts/write-emails.ts` | signature « AuditIA Local » | « Repéré » (voir J2b) | P0 |
| L2 | `lib/seo/index.ts` l. 23 | domaine par défaut `https://auditia-local.fr` | une seule URL de production (voir L3) | P0 |
| L3 | domaines | trois domaines : `auditia-local.fr` (SITE_URL, `public/llms.txt`), `repere-ia.fr` (e-mail de contact : `Footer.tsx`, `ReportView.tsx`), `repere.fr` (`lib/pdf/derive.ts`, lien dans le PDF) | choisir un domaine (`docs/01-marque.md` : « repere.fr probablement pris, repere-ia.fr ») et remplacer partout ; réécrire `llms.txt` avec le même domaine | P0 |
| L4 | `.env.example` l. 2 | « Repéré (AuditIA Local) » | « Repéré » | P2 |
| L5 | `lib/engine/scoring.ts`, `types.ts` | `METHOD_VERSION = 'auditia-score-v1.0'` (présent dans le JSON de l'API et le test) alors que `/methode` affiche « v1.0 » | `'repere-score-v1.0'` (modifier aussi le test `audit.test.ts` et le type) ; interne mais visible dans les exports | P2 |
| L6 | `docs/06-juridique.md`, `docs/07`, `docs/00-ARCHITECTURE.md` | « AuditIA Local » (titre, modèles de mentions légales et CGV : « exerçant sous le nom commercial « AuditIA Local » », domaine `hello.auditia.fr` en E9) | remplacer par « Repéré » et le sous-domaine d'envoi définitif | P1 |
| L7 | `stripe.ts` | `appInfo: { name: 'repere-auditia' }`, `metadata.app: 'auditia'` | interne, sans impact visible ; harmoniser à terme | P2 |
| L8 | `mentions-legales`, `footer` | « Repéré » seul ; `docs/01` demande d'afficher le descripteur « Repéré — visibilité IA des commerces locaux » | présent dans les e-mails, le PDF et le manifest : à ajouter au pied de `Footer.tsx` et au `<title>` de `/tarifs` (« Tarifs | Repéré » est correct, descripteur facultatif) | P2 |

### 4.2 Tutoiement

Aucun tutoiement adressé au lecteur dans `src/**`, la démo, les e-mails ou le PDF.
Seuls cas : les **requêtes simulées d'un client à une IA** (« Tu peux me conseiller un bon plombier… », « …tu as des noms ? »), dans `lib/engine/queries.ts` (gabarits T2 et suivants) et leur reprise sur `/methode`, plus le prompt système de la démo. C'est voulu (les clients tutoient souvent une IA), mais à signaler.
- **L9 (P2)** — `app/methode/page.tsx`, `QUERIES` : ajouter au-dessus des exemples « (certaines formulations sont familières, comme le ferait un client) ».

### 4.3 Jargon non expliqué

| # | Fichier | Terme | Correction | Gravité |
|---|---|---|---|---|
| L10 | `app/page.tsx` | « recherche conversationnelle » | « recherches avec une IA conversationnelle (type ChatGPT) » (voir C-F3) | P1 |
| L11 | `methode/page.tsx` CHANGELOG | « fourchette par bootstrap » | « fourchette calculée par rééchantillonnage » ; dans le texte : « percentiles 5 à 95 d'un rééchantillonnage » → « fourchette où le score se situe 9 fois sur 10 » | P1 |
| L12 | `methode/page.tsx` | « AI Overviews de Google » | « aperçus IA de Google (les résumés affichés en haut des résultats) » | P2 |
| L13 | `actions.json` A07, A14, A15, A16, A20, A21 | « Bing Webmaster Tools », « IndexNow », « NAP », « JSON-LD », « schema.org », « balisage FAQPage » | ajouter dans `why` ou `how` : « (à confier à la personne qui gère votre site) » ; remplacer « NAP » par « nom, adresse, téléphone » partout (A14 le fait déjà dans le titre, mais le champ `title` garde « (NAP) ») ; la landing promet « sans jargon » | P1 |
| L14 | `app/concurrents/page.tsx`, rapport | « part de voix » (app) contre « part des recommandations » (landing, rapport) | un seul terme : « part des recommandations » ; si « part de voix » reste, l'expliquer à la 1re occurrence dans chaque écran | P2 |
| L15 | `methode`, PDF, rapport | « requêtes » (méthode, PDF « Requête ») contre « questions » (landing, rapport, app) | « questions » partout côté client | P2 |
| L16 | `reglages`, `Settings.tsx` | « jalons »/« palier » (« Nouveau palier atteint ») | expliquer ou supprimer : « Nouveau palier atteint (par exemple 40 ou 70 sur 100) » | P2 |

### 4.3b Incohérences de contenu

**L17 (P1)** — Exemple du rapport, `app/page.tsx` : « Plomberie Martin » score **34/100** classé « Invisible : les IA ne vous citent presque jamais » (`score-bands.ts`) alors que la même carte affiche « Cité dans 4 réponses sur 12 » (un tiers). Plus haut, la même entreprise est « Cité par 0 IA sur 3 ». Proposé : préciser « Cité par 0 IA sur 3 **pour cette question** » (section scène), et corriger la bande 0-39 : « Les IA vous citent rarement. » (`score-bands.ts`, `lib/engine/index.ts` n'a pas de message) ; `/methode` dit « rarement, voire jamais », plus juste.

**L18 (P1)** — Seuils incohérents : étiquettes à 40 et 70 (`score-bands.ts`) contre commentaires de `derive.ts` à 25, 50, 75. Exemple : 55/100 affiche l'étiquette « Peu visible : d'autres passent avant vous » et le commentaire « Bonne nouvelle : les IA vous recommandent régulièrement ». Aligner `derive.ts` sur les bandes (<40, 40-69, ≥70).

**L19 (P1)** — Durée : `app/audit/page.tsx` (description) « Découvrez **en une minute** si ChatGPT… » ; `not-found.tsx` « relancer un audit gratuit en une minute » ; `AuditForm.tsx` « Cela prend en général **quelques minutes** ». Proposé : « Remplissez le formulaire en une minute ; le résultat arrive en quelques minutes. »

**L20 (P2)** — Landing : « Trois informations suffisent » (`audit/page.tsx`, hero) ; le formulaire en demande plus (site, e-mail, case de consentement). Proposé : « Trois informations suffisent ; le site et l'e-mail sont facultatifs. » (vérifier d'abord que l'e-mail est bien facultatif dans `AuditForm.tsx`).

**L21 (P2)** — Liens cassés dans les e-mails (hors périmètre langue mais visibles par le client) : `lib/email.ts`, paiement échoué → `/app/compte` ; alerte mensuelle → `/app/{business.id}` ; achat → `/app/{id}`. Ces routes n'existent pas dans `src/app/app` (réglages, plan, ia, concurrents, requêtes, historique, plus). Remplacer par `/app/reglages` et `/app`.

**L22 (P2)** — `email.ts` objet « Merci ! Votre offre Plan d'action est active » : « active » convient à un abonnement, pas à un livrable. Proposé : « Merci ! Votre commande {plan.name} est confirmée ».

### 4.4 Orthographe et typographie

Aucune faute d'orthographe relevée dans les textes lus (landing, tarifs, méthode, CGV, e-mails, PDF, démo).

**L23 (P2)** — Apostrophes mixtes : droites (`'`) dans `page.tsx`, `ReportView.tsx`, CGV ; typographiques (`’`) dans `AuditForm.tsx`, `Settings.tsx`, `email.ts` (« n’a pas abouti » à côté de « n'a pas pu »). Choisir l'apostrophe typographique (`’`) pour le texte affiché ; pas de modification automatique du code.

**L24 (P2)** — Espaces avant « : », « ? », « ! », « % » : la landing utilise `&nbsp;` dans le hero, mais « 43 %» et « 100 % » sont corrects ; vérifier « Cité par 0 IA sur 3 » et les titres de FAQ (« Les IA changent tout le temps. Votre score a-t-il un sens ? ») : espace insécable avant « ? » absent dans les chaînes JavaScript (`tarifs`, FAQ). Ajouter ` ` avant `?`, `!`, `:` dans les chaînes de FAQ.

**L25 (P2)** — Registre : FAQ landing « Je peux arrêter le suivi quand je veux ? » (1re personne) contre `/tarifs` « Puis-je arrêter le suivi quand je veux ? » ; et rapport « Comment **on** calcule ce score → » (`ReportView.tsx`) contre « nous » partout ailleurs. Proposé : « Comment calcule-t-on ce score → » devient « Comment nous calculons ce score → », et « Puis-je arrêter le suivi quand je veux ? » sur la landing.

**L26 (P2)** — Footer : « Fait à Paris. » est une affirmation factuelle non vérifiable tant que l'adresse de l'éditeur n'est pas renseignée ; si l'adresse de domiciliation est ailleurs, retirer.

---

## 5. Liste de contrôle de relecture avant mise en ligne

1. Compléter tous les `[À COMPLÉTER]`, valider les `[À VÉRIFIER]`, retirer `ValidationNotice` (J6).
2. `VAT_NOTICE` partout + pied de facture Stripe (C1, C2).
3. Un seul domaine (L3) et `contact@` fonctionnel.
4. Garantie 14 jours alignée entre CGV, `plans.ts`, rapport (C3).
5. Pro et Agence : retirer ou mettre en liste d'attente (C5).
6. Case de consentement et désinscription corrigées (J1, J2).
7. Promesses implicites retirées (J5 à J9e).
8. Relire les chiffres externes le jour de la mise en ligne (F2 : 52 %).

---

## 6. Récapitulatif chiffré

| Gravité | Nombre | Identifiants principaux |
|---|---|---|
| P0 | 15 | C1, C2, C3, C4, C5, J1, J2, J2b (= L1), J5, J6, J6b, J6c, L2, L3 |
| P1 | 34 | C-F2, C-F3, C-F8, C-F11, C-F15, C-F16, C2b, C4b, C6, C7, C8, C9, J2c, J2d, J3, J4, J5b, J7, J7b, J8, J8b, J9, J9b, J9c, J9f, J10b, J11b, L6, L10, L11, L13, L17, L18, L19 |
| P2 | 29 | C-F1, C-F4, C-F6, C-F7, C-F10, C-F12, C7b, C10, C11, C12, J9d, J9e, J10, J11, L4, L5, L7, L8, L9, L12, L14, L15, L16, L20, L21, L22, L23, L24, L25, L26 |

### Points vérifiés et conformes (pas d'action)
- Mention « Méthode et limites », « aucun résultat n'est garanti » et « produit avec l'aide de l'IA » : présentes dans le rapport, le PDF, les CGV, les mentions légales (règle A7 de `docs/06`, art. 50 de l'AI Act).
- Conservation 12 mois des audits gratuits : cohérente entre `AuditForm`, `not-found`, `confidentialite` et `docs/06`.
- Pages SEO par ville et métier : statistiques agrégées, aucun nom de commerce, seuil de 5 audits (règle A9).
- Désinscription : en-têtes `List-Unsubscribe` et `List-Unsubscribe-Post`, jeton HMAC, stockage haché de l'adresse (cohérent avec `confidentialite` : « e-mail hashé »).
- Poids de la formule (45/20/20/15), cible de 25 % de part de voix, seuil de couverture 2/16, 500 tirages, « 1er = 100 %, 6e = 0 % » : conformes à `lib/engine/scoring.ts`.
- Polices auto-hébergées (pas d'appel à Google Fonts) : cohérent avec « aucun appel réseau à Google » et la politique de confidentialité.
- Aucun prix de concurrent affiché sur le site, le PDF ou la démo.
