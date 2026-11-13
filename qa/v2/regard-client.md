# Repéré V2 : le regard des clients

Agent REGARD CLIENT, 9 novembre 2026. Parcours joués : Karim (plombier, 11e), Claire (DG de Paysia, SaaS de paie, 40 personnes) et Inès (Maison Sora, cosmétiques solides sur Shopify). Pour chacun : la landing, la sous-landing, /tarifs, un audit (`POST /api/audit` avec le bon segment, puis /rapport/[id]), puis l'espace /app en compte démo.

Captures : `qa/v2/client/*.png`. Réponses brutes du copilote : `qa/v2/client/copilote-reponses-api.txt`. Livrables des 12 tâches de chaque compte démo : `qa/v2/client/tasks-demo*.json`.

> **Incident de test, à traiter par l'orchestration.** Pendant le test, un autre agent a lancé `next dev -p 3800` dans `app/`. Cela a écrasé `.next` : le serveur de production sur le port 3700 a continué à rendre le HTML, mais sans CSS ni JS (les fichiers statiques renvoyaient 400). Mon serveur isolé a ensuite été tué par manque de mémoire (OOM), avec quatre serveurs Next sur 8 Go.
>
> Les écrans interactifs ont donc été testés sur le serveur de dev 3800, qui tourne sur le même code. Le copilote, les tâches, le digest et la fiche de vérité ont été testés par leur API sur 3700, qui répondait encore.
>
> **À corriger :** chaque agent doit utiliser son propre `distDir` (`NEXT_DIST_DIR`) ou une copie du dossier `app/`.
>
> Les données de démo ont aussi changé pendant le test, sans doute sous l'effet des corrections en parallèle. Exemple sur l'accueil de Paysia : on lisait d'abord « 0 question sur 8 » et « 7ᵉ », puis « 3 questions sur 8 » et « 8ᵉ ». Les constats ci-dessous portent sur l'état le plus récent observé.

---

## 1. Verdict par persona

### Verdict global
La V2 n'est plus « basique ». Trois choses peuvent la rendre indispensable :
- l'alerte « l'IA dit faux sur vous » ;
- les sources nommées, avec les concurrents qui y sont présents ;
- les tâches livrées avec un texte prêt.

En l'état, **je ne la paierais pas sans réserve**, pour deux raisons :
1. **Les chiffres ne tiennent pas d'un écran à l'autre.** C'est rédhibitoire pour Claire, qui présente ces chiffres à son comité.
2. **Le copilote et une partie des livrables se cassent dès qu'on sort du script.** Par exemple, la réponse proposée à un avis critique remercie le client pour un avis jugé positif.

Le produit promet « on le fait pour vous ». Pour PME et e-commerce, il livre surtout des gabarits troués (« [à compléter] »).

### (a) Karim, plombier dans le 11e, pressé, pas technophile

| | |
|---|---|
| **Paierais-je ?** | Oui, **29 €/mois**, si le premier écran me dit quoi corriger. À 99 €/mois (Accompagné), seulement si on me prouve que ma fiche Google est réellement tenue. Je ne paierais pas l'audit à 149 € : le rapport gratuit en donne déjà l'essentiel. |
| **Waouh** | « Gemini dit que vous êtes ouvert du lundi au samedi 8 h – 20 h ». Avec le texte correct prêt à copier et la liste « où corriger » (karim-desk-taches.png), je comprends en 5 secondes. Le « 4ᵉ sur 10 plombiers du 11ᵉ » me parle aussi. |
| **Creux ou incompréhensible** | **/tarifs s'ouvre sur l'onglet PME (99 € et 490 €/mois)** (karim-mob-tarifs.png) : je pars. Les tâches « robots.txt » et « llms.txt » sont du chinois pour moi. L'écran Trafic (moyenne glissante, robots GPTBot) ne me sert à rien. « Score +9 » mais « −1 place » : je ne comprends pas si ça va bien ou mal. Sur mobile, l'alerte d'erreur est sous la ligne de flottaison (karim-mob-accueil.png). |
| **Faux** | J'ai demandé au copilote une réponse à un avis 3 étoiles (« Intervention correcte mais délai trop long »). Il propose : « Merci beaucoup pour ce message, il fait plaisir… ravis que la prestation vous ait satisfait » (copilote-reponses-api.txt). Publié tel quel, c'est ridicule. Autre exemple : « Combien de clients m'a envoyé ChatGPT ? » renvoie mes prix (karim-desk-copilote-reponses.png). |
| **Ce qui me ferait revenir** | Un SMS ou WhatsApp quand une IA donne un mauvais numéro ou de mauvais horaires. Un avis Google à répondre, prêt à envoyer. « Guérin vous est passé devant ». Aujourd'hui le digest hebdo est **désactivé par défaut** (Settings.tsx). |

### (b) Claire, DG de Paysia (SaaS de paie, 40 personnes)

| | |
|---|---|
| **Paierais-je ?** | **99 €/mois** (Essentiel) : oui pour la veille, si les chiffres sont cohérents. **490 €/mois** (Accompagné) : non, tant que le « comparatif honnête face à PayFit » se résume à un plan en 5 lignes et que le copilote refuse « Écris-moi une page comparatif Paysia vs Silae ». |
| **Waouh** | « PayFit est présent sur G2, Capterra et Appvizer, pas vous », avec les pourcentages de citation. Le point comité : 5 puces et un CSV de part de voix (claire-desk-copilote-reponses.png). Gemini qui annonce « environ 15 € par mois » au lieu de 8 € HT par bulletin. |
| **Creux ou générique** | Plusieurs tâches viennent visiblement du parcours local :<br>• « Lancer votre demande d'avis (lien, **QR code**) » avec « Merci d'avoir fait appel à Paysia… sur Google » ;<br>• « Mettre à jour votre fiche Google » avec le post « Paie : Paysia vous répond. » ;<br>• l'étape 1 de la correction de prix dit « Corrigez d'abord votre fiche Google ».<br>Pour la tâche Trustpilot, on livre des « textes court/moyen/long » alors que Trustpilot ne demande pas de description, et le texte long est identique au moyen. |
| **Faux ou suspect** | Les concurrents mélangent de vrais acteurs (PayFit, Silae, Cegid, Lucca) et des noms inventés (Orsapaie, Velapaie, Axopaie, Terapaie, Kalipaie). Une DG du secteur voit tout de suite que c'est faux. De plus, on prête à ChatGPT des citations sur de vraies marques (« PayFit : interface simple et support réactif »). Le JSON-LD transforme « Dirigeant » en `founder` (jsonld.ts:218) : c'est faux si la dirigeante n'est pas fondatrice. |
| **Incohérences qui tuent la confiance** | • Rang : 8ᵉ à l'accueil et dans Concurrents, mais « +1 place, 9ᵉ → 8ᵉ » dans le bilan, et 7ᵉ dans le digest de l'API (encore « 0 question sur 8 »).<br>• Questions : « 8 questions » à l'accueil, « 10 questions » dans Concurrents, « 48 réponses » mais « 54 réponses analysées » dans le rapport.<br>• « PayFit cité dans 38 réponses contre 11 pour vous », alors que Paysia a 18 citations. |
| **Ce qui me ferait revenir** | Le rapport mensuel présentable (PDF avec ma marque) et la part de voix contre PayFit dans le temps. Le digest dans Slack ou Teams le lundi (promis dans le doc 06, absent). Des pages comparatif et « alternative à » vraiment rédigées. |

### (c) Inès, Maison Sora (cosmétiques solides, Shopify)

| | |
|---|---|
| **Paierais-je ?** | **Pas aujourd'hui.** À 79 €/mois, oui, le jour où le produit lit mon catalogue Shopify et me rend des fiches réécrites et le CA venu des IA. Aujourd'hui, les « fiches produits » sont un gabarit vide (« Déodorant solide [bénéfice] — [contenance] ») et le JSON-LD Product est rempli de `[prix]`, `[SKU]`, `[URL de la fiche]`. |
| **Waouh** | Les sources : Beauté Test cité dans 72 % des réponses, Reddit, Marie Claire, ELLE, Amazon, avec les marques présentes. Le brouillon d'e-mail à l'auteur du comparatif Beauté Test, signé Inès Morel. C'est la meilleure page du produit pour l'e-commerce. |
| **Creux ou générique** | L'« erreur critique » porte sur l'**adresse de l'atelier**. Une marque en ligne s'en moque. Une erreur de prix, de livraison (« offerte dès 60 € ») ou de composition (« contient des sulfates ») ferait peur. La demande d'avis passe par **Google Business** (« Merci d'avoir fait appel à Maison Sora »), au lieu d'un e-mail après livraison vers Avis Vérifiés ou Trustpilot. La fiche de vérité demande « Services » mais pas les ingrédients, l'INCI, les certifications, les labels ou la politique de retour. |
| **Faux** | « Combien de ventes viennent de ChatGPT ? » renvoie les prix des produits. « Quelles fiches produits dois-je corriger en premier ? » renvoie la réponse de repli générique (ines-desk-copilote-reponses.png). Trafic : 1 980 visites IA par mois et 7,3 % du trafic, pour une marque classée **10ᵉ sur 10** et « citée dans 2 questions sur 8 ». Ce n'est pas crédible. |
| **Ce qui me ferait revenir** | « Vos ventes venues de ChatGPT cette semaine : 14 commandes, 412 € ». « Lamazuna vient d'entrer dans le comparatif Marie Claire ». Fiches réécrites, à valider en un clic, puis poussées sur Shopify. |

---

## 2. Bugs et incohérences

| # | Gravité | Page | Constat | Capture / preuve | Cause probable |
|---|---|---|---|---|---|
| B1 | Bloquant | Copilote | Les questions sur les visites ou les ventes (« Combien de clients / ventes… ChatGPT ») sont routées vers `prices`. « Cette semaine en 20 min », « page comparatif », « quelles fiches produits » tombent en `other` (réponse générique). **5 questions sur 9 échouent.** | karim-desk-copilote-reponses.png, claire-desk-copilote-reponses.png, ines-desk-copilote-reponses.png, copilote-reponses-api.txt | `src/lib/copilot/demo.ts:32-41` : la regex `combien` mène à `prices`, et il manque des intentions. |
| B2 | Bloquant | Copilote, avis | L'avis négatif « délai trop long » reçoit la réponse positive (« ravis que la prestation vous ait satisfait »). C'est **l'exemple suggéré par l'app elle-même.** | copilote-reponses-api.txt | `demo.ts:231` : la regex `negative` ignore `trop`, `long`, `délai`, `mais`, `lent`. |
| B3 | Majeur | /tarifs | Par défaut, l'onglet PME s'ouvre pour tout le monde. Karim voit 99 € et 490 €/mois. | karim-mob-tarifs.png, karim-desk-tarifs.png | `src/app/tarifs/page.tsx:25` (`return "pme"`). |
| B4 | Majeur | Concurrents | Ets Bernard, 5ᵉ (21 citations contre 24 pour Martin), est listé dans « Pourquoi ils passent devant » avec « 1 citation de plus que vous ». | karim-desk-concurrents.png | `src/app/app/concurrents/page.tsx:108` (`Math.max(1, …)`) et liste non filtrée par rang. |
| B5 | Majeur | Concurrents, copilote | « Cité dans 41 réponses contre 5 pour vous » (Martin a 24 citations). Pour Paysia : « 38 contre 11 » (Paysia en a 18). Deux bases de comptage, et le mot « réponses » est faux : 41 sur 48 réponses donnerait 85 %, pas 20 %. | karim-desk-concurrents.png, copilote-reponses-api.txt | `src/lib/engine/insights.ts:72` (`entityCounts`) n'utilise pas la même base que `rankInAudit`. |
| B6 | Majeur | Accueil, Concurrents, Rapport | Le nombre de questions et de réponses varie d'un écran à l'autre : « 8 questions » à l'accueil, « 9 » ou « 10 questions » dans Concurrents, « 16 sur 47 » mais « 48 réponses » dans le rapport de Karim, « 14 sur 48 » mais « 54 réponses analysées » dans le rapport Paysia. | karim-desk-accueil.png, claire-desk-concurrents.png, karim-desk-rapport.png | Plusieurs calculs indépendants. |
| B7 | Majeur | Accueil, Rapports | Le rang est contradictoire : accueil −1 place (3ᵉ → 4ᵉ), bilan trimestriel « +2 places, 6ᵉ → 4ᵉ » (Karim), Paysia « 9ᵉ → 8ᵉ » alors que l'historique montre 10ᵉ en septembre. « Score +9 » et « −1 place » sont affichés côte à côte, sans explication. | karim-desk-accueil.png, karim-desk-rapports.png | Choix de période différent (mois contre trimestre) jamais affiché. |
| B8 | Majeur | Accueil, Concurrents | « Nouveau concurrent » s'affiche pour les n° 1, 2 et 3 de Karim (Plomberie du Square, Atelier Vidal, Guérin) alors qu'il y a 6 mois d'historique. Tout le classement est marqué « Nouveau », et la colonne « Sur un mois » affiche « — ». | karim-desk-accueil.png, karim-desk-concurrents.png | `src/lib/demo-v2.ts` : les audits historiques n'ont pas les mêmes concurrents. |
| B9 | Mineur | Accueil (bureau) | Le bloc Alertes est affiché deux fois (sous les KPI, puis en colonne). | texte de karim-accueil | `src/app/app/page.tsx` |
| B10 | Majeur | Sources et Tâches | Google Maps est marqué « Absent » pour Plomberie Martin (créée en 2009). Pourtant, une tâche propose « Mettre à jour votre fiche Google », la correction des horaires commence par « Fiche Google », et le copilote suggère « S'inscrire sur Google Maps ». | karim-desk-sources.png, karim-desk-taches.png | Présence `google.com` dans les données démo. |
| B11 | Majeur | Trafic (e-commerce) | 1 980 visites IA par mois (7,3 % du trafic) pour une marque 10ᵉ sur 10. « Conversions suivies 42, même page vue » : ni CA ni commandes, alors que la landing promet « trafic et ventes IA via GA4 ou Shopify, produit par produit ». | ines-desk-trafic.png, ines-desk-sublanding.png | Données démo, et `TrafficClient.tsx` sans vue ventes. |
| B12 | Mineur | Trafic | Les pages d'arrivée totalisent 90 jours (193 pour Karim, 2 086 pour Paysia) mais sont affichées à côté de cartes « 30 jours », sans libellé. « Conversions 0 » pour un plombier : il faudrait mesurer les appels (clics `tel:`). Les « Repères » (traits verticaux) ne sont pas légendés. | karim-desk-trafic.png | `src/components/app/TrafficClient.tsx` |
| B13 | Majeur | Livrables PME et e-commerce | Demande d'avis Google pour un SaaS et une marque DTC (« Merci d'avoir fait appel à… », QR code). Fiche Google et posts Google pour un SaaS (« Paie : Paysia vous répond. »). | tasks-demo-pme.json, tasks-demo-ecom.json | `src/lib/execution/reviews.ts:56`, `tasks.ts:514` (`reviewRequestDraft`) |
| B14 | Majeur | Livrables | Erreurs de français et de gabarit :<br>• « souvent repris quand on cherche shampoing solide » ;<br>• « Guide : bien choisir shampoing solide » ;<br>• « Ce que comprend shampoing solide chez Maison Sora » ;<br>• « DSN et absences inclus depuis 2018 » ;<br>• « Adresse de Maison Sora : Atelier : 7 rue Burdeau » (copié tel quel dans le presse-papiers : ines-clipboard) ;<br>• « 1 information(s) fausse(s) », « 2 faite(s) ». | tasks-*.json, ines-desk-taches-copie.png | `tasks.ts:122-133, 385, 664`, `demo.ts` (comité) |
| B15 | Majeur | Livrables | Les textes « moyen (≤ 400) » et « long (≤ 1 000) » sont **identiques** sur toutes les fiches d'annuaire. Le long n'apporte rien. | tasks-*.json | `tasks.ts:249` (même `officialDescription`) |
| B16 | Majeur | FAQ (copilote) | 3 questions sur 12 sont autopromotionnelles (« Quel est le meilleur plombier à Paris 11e ? ») et ont la **même réponse** recopiée trois fois. Publiées en `FAQPage`, elles risquent une action manuelle de Google. | copilote-reponses-api.txt | constructeur FAQ dans `src/lib/copilot/demo.ts` |
| B17 | Mineur | JSON-LD PME | `founder` est rempli avec le dirigeant, et une offre SaaS est typée `Service` au lieu de `SoftwareApplication` + `Offer`. | tasks-demo-pme.json | `src/lib/execution/jsonld.ts:218` |
| B18 | Majeur | Vérité | Aucune validation par champ : « 01 43 55 22 11 » est accepté comme adresse. Le champ est une ligne unique pour des textes longs. Après enregistrement, la carte d'erreur ne change pas (« vérifié lundi prochain »). La pastille « contredit » chevauche la valeur dans la colonne de 120 px. | karim-desk-verite-modifie.png | `src/components/app/TruthEditor.tsx:34-61, 78` |
| B19 | Majeur | Vérité (e-commerce) | Les champs ne sont pas adaptés : « Services » et « Adresse » oui, mais ni ingrédients, ni certifications, ni retours. L'erreur de démo porte sur l'adresse. | ines-desk-verite.png | `TruthEditor.tsx:13`, `mock-v2.ts` (`DEMO_ERROR_FIELD`) |
| B20 | Majeur | Données démo PME et e-commerce | Mélange de vraies marques (PayFit, Silae, Cegid, Lucca, Lamazuna, Respire, Cut by Fred, Oya) et de noms inventés, avec des citations attribuées aux vraies. La landing affiche d'autres concurrents fictifs (Paylo, Netpaie) que le compte démo Paysia. | claire-desk-concurrents.png, karim-desk-landing.png | `demo-v2.ts:79,96` (`knownCompetitors`), pools de `mock-v2.ts` |
| B21 | Mineur | Rapport d'audit | L'accroche dit « ChatGPT recommande Plomberie du Canal et Blanc Plomberie », mais le concurrent le plus cité est Atelier Dubois. « N° 1 sur Perplexity / Gemini : ici, c'est vous », alors que « Plomberie du Canal est cité en premier par 2 IA sur 3 » et le rang global est 5ᵉ. Sentiment « Positif 63 % / Neutre 38 % » : total 101 %. | karim-desk-rapport.png, rapport Karim | `src/components/report/*` |
| B22 | Mineur | Rapport d'audit | Le surlignage de la marque coupe le domaine : « paysia (votre commerce) .fr ». « (votre commerce) » est employé pour un SaaS ou une marque. | texte du rapport Paysia | `src/components/report/Highlighted.tsx:19` et découpage dans `derive` |
| B23 | Majeur | Réglages | Le résumé hebdomadaire et « un concurrent vous dépasse » sont **désactivés par défaut**. C'est pourtant la boucle de rétention n° 1 du doc 06 §2. | src/components/app/Settings.tsx:18 | `DEFAULT_PREFS` |
| B24 | Mineur | Sources | Le titre dit « Vos 10 sources prioritaires » mais la page en liste 9 (Karim) ou 7 (Paysia). Des sources « non citées dans cet audit » ont un score de 3 à 9 sur 100 et sont présentées comme prioritaires. La note de bas de page dit « API ChatGPT, Perplexity et **Claude** », alors que l'en-tête de l'accueil dit « ChatGPT, Perplexity, Gemini ». | karim-desk-sources.png | `src/app/app/sources/page.tsx` |

---

## 3. Les 15 améliorations prioritaires
Classées par valeur perçue par le client, divisée par l'effort (S < ½ j, M ≈ 1–2 j, L > 3 j).

### 1. Copilote : router les vraies questions (valeur très haute, effort M)
**Fichier :** `src/lib/copilot/demo.ts`, fonction `detectIntent`, lignes 32-41. Le même routage sert de garde-fou en mode LLM.

**Ajouter ces intentions avant `prices` :**
```ts
if (/(visite|trafic|clients? .*(envoy|amen)|vente|commande|conversion|chiffre d.affaires|\bca\b)/.test(q)) return 'traffic';
if (/(cette semaine|quoi faire|par ou commencer|\d+ ?min|priorit)/.test(q)) return 'weekly_plan';
if (/(comparatif|\bvs\b|versus|face a|alternative a)/.test(q)) return 'comparison';
if (/(fiche|page)s? produit/.test(q)) return 'product_pages';
```
Puis retirer `combien` de la regex `prices` (garder `prix|tarif|cout|combien (coute|coutent)`).

**Réponses à écrire :**
- **`traffic`** : lire le résumé de trafic du compte (même source que `/app/trafic`). Exemple : « ChatGPT vous a envoyé 64 visites sur 30 jours (64 % du trafic IA), surtout vers /tarifs et /depannage-urgence. » En e-commerce, ajouter commandes et CA quand ils existent ; sinon le dire et proposer de connecter Shopify.
- **`weekly_plan`** : les 3 tâches de `weeklyTasks()`, avec durée et premier livrable.
- **`comparison`** : une vraie page en Markdown et HTML (intro, tableau des faits de la fiche de vérité, « pour qui X, pour qui Y », FAQ de 3 questions, mention datée). Les cellules concurrentes sont marquées « [à vérifier sur leur site] ».
- **`product_pages`** : classer les catégories produits par part de citation perdue, puis renvoyer le gabarit de la tâche `product_feed`.

Ajouter un test par question persona dans `src/lib/copilot/__tests__/copilot.test.ts` (les 9 questions de `copilote-reponses-api.txt`).

### 2. Réponse aux avis : détecter l'avis mitigé (valeur très haute, effort S)
**Fichier :** `src/lib/copilot/demo.ts:231`, et `draftReviewReply` dans `src/lib/execution/reviews.ts:97`.

**À faire :**
- Étendre la regex : `|trop|long|lent|delai|délai|mais|bof|moyen|aurait pu|pas assez|attendu`.
- Ajouter une 3ᵉ variante « mitigé » quand le texte contient `mais` : remercier, **reprendre le point critiqué entre guillemets** (« Vous avez raison sur le délai… »), dire ce qui change, puis signer.
- Ne jamais écrire « ravis que la prestation vous ait satisfait » si une note de 3 étoiles ou moins, ou un mot négatif, est présent.

### 3. /tarifs : ouvrir sur le bon parcours (valeur haute, effort S)
**Fichier :** `src/app/tarifs/page.tsx:20-26`.

**À faire :**
- `toSegment` lit d'abord `searchParams.segment`, puis le cookie `rp_site_segment` posé par `/local`, `/pme` et `/e-commerce` (un `useEffect` dans chaque sous-landing). Par défaut : `local`, le volume principal et le prix le plus bas.
- Dans les CTA « Voir la page Tarifs » des sous-landings, le lien `/tarifs` devient `/tarifs?segment=local|pme|ecommerce`.
- Sur mobile, mettre la carte Essentiel (29 €) avant Accompagné pour Local.

### 4. Concurrents : ne lister que ceux qui passent devant, avec un seul comptage (valeur haute, effort S)
**Fichiers :**
- `src/app/app/concurrents/page.tsx:108` : remplacer `Math.max(1, g.mentions - me.mentions)` par un filtre `gaps.filter((g) => g.mentions > me.mentions)` en amont.
- `src/lib/engine/insights.ts:72` : passer `ctx.clientMentions` (la valeur de `rankInAudit`) et écrire « Cité ${c.mentions} fois contre ${client} pour vous », c'est-à-dire **citations**, pas « réponses ».

Même correction dans le copilote (`why_competitor`), qui reprend ces lignes.

### 5. Accueil : l'erreur IA devient la phrase de la semaine (valeur haute, effort S)
**Fichier :** `src/app/app/page.tsx` (bloc « La phrase de la semaine »), et le titre du digest (`src/lib/digest/*`, même règle, doc 06 §2.1 priorité 1).

**Si `factErrors > 0` :**
- titre : « Gemini donne de mauvais horaires pour Plomberie Martin » ;
- sous-titre : la citation fautive et la valeur juste ;
- bouton primaire « Corriger en 15 min », qui mène à `/app/taches?t=<id>` ;
- la phrase « ChatGPT vous cite dans X questions sur 8 » descend en 2ᵉ ligne.

**Sous le rang**, quand le score monte mais que le rang baisse, afficher : « Vous progressez (+9), mais Guérin progresse plus vite. »

Supprimer le second bloc « Alertes » dupliqué (B9).

### 6. Livrables : corriger les gabarits et la grammaire (valeur haute, effort S)
**Fichier :** `src/lib/execution/tasks.ts`.

| Endroit | Correction |
|---|---|
| L.385 | `quand on cherche « ${c.activity} »` |
| L.392 | « accès de test » seulement pour `pme` ; « des échantillons » en `ecommerce` ; supprimé en `local` |
| L.664, et le titre du guide | Variantes e-commerce : « Guide : bien choisir son ${activity} », « Ce que contient notre ${produit} » |
| L.122-124 | `sinceText` sort de la phrase d'offre : « Paysia : logiciel de paie… DSN et absences inclus. Depuis 2018. » |
| Texte « à reprendre partout » | Enlever le préfixe redondant quand la valeur commence déjà par un libellé (`/^\w+\s?:/`) : on évite « Adresse de Maison Sora : Atelier : … » |
| L.249 | Le texte long ajoute réellement de la matière : historique, méthode, garanties, clients types, preuves issues des faits. Sinon, supprimer le champ |
| Point comité (`demo.ts`) | Pluriels avec une fonction `plural(n, 'information fausse', 'informations fausses')` |

### 7. Livrables adaptés au segment (valeur haute, effort M)
**Demande d'avis** (`src/lib/execution/reviews.ts:26-60`, `reviewKit`, et `tasks.ts:514`) :

| Segment | Plateformes | Message type |
|---|---|---|
| `pme` | G2, Capterra, Trustpilot | « Merci d'utiliser Paysia depuis [3 mois] : votre retour sur G2 aide d'autres DAF » |
| `ecommerce` | Avis Vérifiés, Trustpilot, avis produit Shopify | E-mail J+7 après livraison : « Votre shampoing solide est arrivé ? » |
| `local` | Google, avec QR code | Inchangé |

**Correction d'erreur (`fact_fix`)** : les étapes commencent par « Votre fiche Google » seulement en `local`. En PME : site (pages tarifs et FAQ), G2/Capterra, LinkedIn. En e-commerce : fiche produit, flux Merchant, Amazon et Sephora.

**Tâche `gbp_profile`** : ne pas la générer pour `pme` sans adresse recevant du public.

### 8. FAQ : questions réelles, sans doublons (valeur moyenne-haute, effort S)
**Fichier :** constructeur FAQ dans `src/lib/copilot/demo.ts` (et `faq_page` dans `tasks.ts`).

**À faire :**
- Exclure les questions de classement (`/meilleur|lequel choisir|conseiller un bon/`).
- Dédupliquer les réponses identiques.
- Les remplacer par des questions factuelles dérivées des faits : « Intervenez-vous le dimanche ? », « Le devis est-il gratuit ? », « En combien de temps arrivez-vous dans le 11e ? », « Que comprend le déplacement à 49 € ? ».

Cible : 8 à 12 questions, aucune réponse répétée.

### 9. Données démo crédibles : tout fictif ou tout réel (valeur moyenne-haute, effort S)
**Fichiers :**
- `src/lib/demo-v2.ts:79,96` : remplacer `knownCompetitors` par des noms fictifs cohérents avec les pools de `mock-v2.ts` (Paylo, Netpaie, Orsapaie…).
- `src/components/site/mockups.tsx` : aligner la landing sur les mêmes concurrents que le compte démo Paysia.
- Aucune citation inventée attribuée à une vraie marque.

### 10. E-commerce : une fiche de vérité et une erreur qui comptent (valeur haute, effort S/M)
**Fichiers :**
- `src/components/app/TruthEditor.tsx:13` : `ecommerce: ['site','produits','prix','livraison','retours','ingredients','certifications','adresse','dirigeant','creation']`. Ajouter les nouveaux champs à `BrandFactField` (`src/lib/engine/types-v2.ts:123`) et à `FACT_FIELDS` (`src/lib/engine/perception.ts:22`).
- `src/lib/engine/providers/mock-v2.ts` : `DEMO_ERROR_FIELD.ecommerce = 'livraison'` et `wrongValue('livraison')` renvoie « livraison offerte dès 60 € ; France uniquement ». Le texte d'alerte devient : « ChatGPT annonce une livraison payante sous 60 € : vos clients de 39 € à 59 € pensent payer le port. »

### 11. Un seul calcul des chiffres clés (valeur haute, effort M)
**Nouveau module :** `src/lib/digest/stats.ts`, avec `auditStats(audit) => { questions, answers, clientCitations, rank, of, shareOfVoice, deltaRank: {period:'month'|'quarter', from, to} }`.

**À brancher sur :**
- l'accueil (`src/app/app/page.tsx`) ;
- Concurrents (`concurrents/page.tsx`) ;
- Rapports (bilan) ;
- le copilote (`src/lib/copilot/context.ts`) ;
- le rapport public (`src/components/report/adapters.ts:606`).

**Affichages à unifier :**
- Toujours écrire la période : « −1 place sur un mois », « +2 places sur le trimestre ».
- Toujours afficher « X questions × 3 IA × 2 passages = N réponses ».
- Ajouter un test qui vérifie que les trois comptes démo donnent les mêmes valeurs sur chaque écran.

### 12. Historique démo et alertes « nouveau concurrent » justes (valeur moyenne, effort S)
**Fichiers :**
- `src/lib/demo-v2.ts` : générer les 6 audits historiques avec le même vivier de concurrents (seed commun). Seuls 1 ou 2 entrants réels apparaissent en novembre, et en bas du classement.
- Le badge « Nouveau » et l'alerte ne s'affichent que si le concurrent était absent des 2 audits précédents.
- Corriger la présence `google.com` de Plomberie Martin : « Présent, fiche incomplète » (B10).

### 13. Activer le digest du lundi par défaut et le montrer (valeur haute, effort S)
**Fichiers :**
- `src/components/app/Settings.tsx:18` : `weekly_digest: true`, `competitor_overtook: true`, et la même valeur côté serveur dans `src/lib/db.ts`.
- Dans `/app/reglages`, ajouter « Aperçu de votre e-mail du lundi » : une iframe sur `/api/digest/preview?businessId=…&format=html`. Ajouter ce format (aujourd'hui la route ne renvoie que du JSON).
- Ajouter le champ « Transférer à (associé / agence) ».

### 14. Vérité : valider chaque champ et revérifier tout de suite (valeur moyenne, effort S)
**Fichier :** `src/components/app/TruthEditor.tsx`.

**Validation par champ :**
- téléphone : `/^(\+33|0)[1-9]( ?\d{2}){4}$/` ;
- adresse : doit contenir un code postal à 5 chiffres ;
- site : doit être un domaine.

**Formulaire :** `textarea` pour `horaires`, `services`, `prix` et `produits`. Colonne de libellé à 150 px, et la pastille « contredit » passe sous le libellé.

**Après enregistrement :** comparer immédiatement la nouvelle valeur aux réponses stockées du dernier audit (logique de `refreshFactCheck`, déjà appelée côté API). Afficher « Gemini dit toujours "du lundi au samedi" : l'erreur reste ouverte » ou « Cette valeur correspond désormais aux réponses ». En démo, faire ce calcul dans `localDemo`.

### 15. Trafic : prouver la valeur en € et en appels (valeur très haute, effort L)
**Fichiers :** `src/components/app/TrafficClient.tsx`, `src/app/app/trafic/page.tsx`, script `t.js`.

| Segment | À ajouter |
|---|---|
| `local` | Suivre les clics `tel:` et `mailto:` dans `t.js`. La carte « Conversions » devient « Appels déclenchés » |
| `ecommerce` | Carte « Commandes et CA venus des IA », via webhook Shopify `orders/create` avec `landing_site` / `referring_site` et UTM. Tableau « Produits d'arrivée » avec commandes. En démo : 14 commandes, 412 €, avec un volume de trafic cohérent avec un rang de 10ᵉ (≈ 150 visites par mois, pas 1 980) |
| Tous | Libeller « Pages d'arrivée (90 jours) » et légender les « Repères » (« fiche PagesJaunes créée », « FAQ publiée ») pour relier action et effet |

---

### Ce qu'il ne faut pas toucher
- La structure « tâche, puis livrable copiable, puis où coller » (karim-desk-taches.png).
- La page Sources, avec les concurrents présents source par source.
- Le point comité en 5 puces avec son CSV.
- Le ton honnête (« aucune promesse de position »).

Ce sont les quatre éléments qui donnent envie de payer.
