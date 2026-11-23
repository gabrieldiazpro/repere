# Prospection B2B par e-mail, conforme CNIL

Résumé de pages officielles de la CNIL relues le 15 novembre 2026. Ce n'est pas un avis juridique : faites relire
§1 et les pieds de message par un juriste avant le premier envoi.

## 1. Les règles (sources : cnil.fr)

**Pas de consentement préalable en B2B, mais trois conditions.** La CNIL écrit : « Le consentement préalable n'est pas
systématiquement requis pour la prospection B to B si : elle est en lien avec l'activité professionnelle de la personne
contactée ; la personne est informée de l'origine de ses données et de la finalité du message ; elle peut s'opposer
simplement à la réception de nouvelles sollicitations. »
— [Communications par voie électronique aux prospects et clients : quelles règles respecter ?](https://www.cnil.fr/fr/communication-electronique-quelles-regles) (page datée du 10 juin 2026)

**Objet en rapport avec la fonction.** La prospection vers des professionnels peut reposer sur l'intérêt légitime
« lorsque l'objet de la sollicitation est en rapport avec la profession de la personne démarchée » (exemple de la CNIL :
présenter un logiciel à un directeur informatique).
— [La prospection commerciale par courrier électronique, SMS-MMS et automate d'appel](https://www.cnil.fr/fr/la-prospection-commerciale-par-courrier-electronique-sms-mms-et-automate-dappel)

**Dans chaque message** : l'identité de l'organisation qui l'émet, et un moyen « simple et gratuit » de refuser de
nouvelles sollicitations. **Adresses génériques** (contact@, info@, commande@) : elles concernent des personnes morales
et « ne sont pas soumises à ces principes » (même page) — on garde quand même l'identité et la désinscription, c'est la
même délivrabilité et la même courtoisie.

**Opposition durable.** « Lorsqu'une personne s'oppose à recevoir une communication, cette demande doit être prise en
compte durablement » : la CNIL recommande une liste d'opposition (repoussoir). — [page « quelles règles respecter »](https://www.cnil.fr/fr/communication-electronique-quelles-regles)

**Adresses reconstituées (prenom.nom@entreprise.fr).** Possible sur la base de l'intérêt légitime seulement sous
conditions, « ni automatique ni systématique », au cas par cas ; les personnes sans présence en ligne identifiable ou qui
protègent leurs coordonnées « ne peuvent, a priori, pas s'attendre raisonnablement à la reconstitution de leur adresse » ;
ne garder l'adresse que si un premier contact a lieu dans un délai raisonnable ; sinon, s'abstenir.
— [Reconstitution d'adresses électroniques professionnelles : dans quel cadre est-ce autorisé ?](https://cnil.fr/fr/reconstitution-adresses-professionnelles-quel-cadre) (16 octobre 2026)
→ Notre règle : **pas d'adresse devinée** pendant le lancement. Adresse générique publiée par l'entreprise, ou adresse
nominative publiée par la personne elle-même pour être contactée professionnellement.

**Durée de conservation des prospects** : trois ans « à compter de leur collecte ou du dernier contact venant du
prospect » ; ensuite, recontacter une fois pour demander, sinon supprimer.
— [Questions-réponses sur les référentiels relatifs à la gestion des activités commerciales](https://www.cnil.fr/fr/questions-reponses-sur-les-referentiels-relatifs-la-gestion-des-activites-commerciales-et-des)

**Téléphone vers des professionnels** : même logique (intérêt légitime si l'objet est lié à la profession ; identité de
l'organisation et moyen simple de refuser à chaque appel). Le nouveau régime de consentement entré en vigueur le
11 août 2026 vise les consommateurs. — [Prospection commerciale par téléphone (hors automate d'appel)](https://www.cnil.fr/fr/prospection-commerciale-par-telephone-hors-automate-dappel-quelles-sont-les-regles)

**Attention, entrepreneurs individuels** : un artisan en nom propre est un professionnel, mais son adresse est souvent
aussi personnelle. Restez sur l'adresse publiée pour l'activité et sur un objet strictement professionnel.

> Mise à jour de `docs/09-prospection.md` (V1) : elle limitait la prospection aux adresses génériques et interdisait toute
> adresse « moissonnée » ; les pages CNIL de 2026 ci-dessus sont plus précises. En cas de doute, la règle la plus prudente
> de ce dossier s'applique.

## 2. Notre règle d'envoi (checklist avant chaque envoi)

1. L'adresse vient d'une page publique de l'entreprise (site, fiche Google) ; on note l'URL source et la date.
2. Le contenu parle de **son** site, mesuré pour de vrai (analyse réelle, jamais un résultat démo).
3. Objet honnête, sans « Re: » ni « Fwd: » factice, sans urgence inventée.
4. Pied de message complet (§3) avec lien de désinscription en un clic et réponse « STOP ».
5. Toute opposition entre dans la liste d'opposition sous 24 h (la base de Repéré en a déjà une : `addSuppression`,
   page `/desinscription`) et n'en sort jamais.
6. 3 messages au maximum, puis arrêt. Pas de relance d'une personne qui a dit non.
7. Envoi par **Brevo (offre gratuite)** depuis le **domaine d'envoi secondaire** dédié, jamais depuis le domaine du
   site (décision 11, README). Au plus 20 à 30 premiers messages par jour et par boîte, envoyés à la main ou par un outil qui respecte la liste
   d'opposition. Arrêt immédiat si les plaintes pour spam dépassent 0,1 % (kpi.md).
8. Conservation : 3 ans après la collecte ou le dernier contact venant du prospect.

## 3. Pied de message (à mettre sous chaque e-mail)

```
—
{Prénom Nom}, fondateur de Repéré — édité par Mycelo, {adresse postale}, SIREN {SIREN}.
Je vous écris parce que votre adresse est publiée sur {source : votre site / votre fiche Google} et que ce message
concerne la visibilité de {Entreprise} sur Google et dans les IA. Vos coordonnées servent uniquement à cet échange et
sont supprimées après 3 ans sans contact de votre part. Ne plus recevoir de message : {lien de désinscription}
ou répondez simplement STOP. Vos droits : {lien vers /confidentialite}.
```

Le lien de désinscription signé existe déjà : `unsubscribeUrl(email)` dans `src/lib/email.ts` (page `/desinscription`).

## 4. Séquences

Variables : `{prenom}` (si connu), `{entreprise}`, `{site}`, `{ville}`, `{metier}`, `{note_seo}`, `{note_geo}`,
`{constat_1}`, `{constat_2}`, `{concurrent}` (cité par les IA), `{lien_analyse}` (lien de partage de l'analyse réelle).
Chaque chiffre vient de l'analyse réelle de son site. Si une IA n'a pas été mesurée, on ne parle pas d'elle.

### 4.1 Commerce local (gérant, artisan)

**E-mail 1 — J0.** Objet : `{entreprise} : ce que ChatGPT répond quand on cherche un {metier} à {ville}`

> Bonjour {prenom},
>
> J'ai posé à ChatGPT, Perplexity et Gemini la question qu'un client se pose : « quel {metier} à {ville} ? ».
> Résultat : {constat_1}. J'ai aussi exploré votre site : {constat_2}.
>
> Le détail, avec la marge d'erreur de chaque mesure, est ici : {lien_analyse}. C'est gratuit, sans compte.
>
> Je lance Repéré et je cherche quelques commerces pilotes à {ville} : si le sujet vous parle, répondez simplement « oui »
> et je vous explique en 10 minutes par téléphone.
>
> {Prénom}

**E-mail 2 — J+4.** Objet : `La correction la plus simple pour {entreprise}`

> Bonjour {prenom},
>
> Une seule chose de l'analyse, celle qui prend le moins de temps : {constat_1 reformulé en action}. Cela se fait en
> une quinzaine de minutes, et je peux vous envoyer le texte prêt à coller.
>
> Je ne peux pas vous promettre que les IA changeront d'avis : personne ne le peut. Je peux vous montrer, mesures à
> l'appui, ce qui bouge un mois plus tard.
>
> {Prénom}

**E-mail 3 — J+11 (dernier).** Objet : `Je ne vous relancerai plus`

> Bonjour {prenom},
>
> Dernier message de ma part. L'analyse de {site} reste disponible ici : {lien_analyse}. Si un jour vous voulez la
> refaire pour voir ce qui a changé, elle est gratuite sur repere-ia.fr.
>
> Bonne continuation,
> {Prénom}

### 4.2 PME / B2B (dirigeant, responsable marketing)

**E-mail 1 — J0.** Objet : `Quand un acheteur demande « quel {catégorie} pour une PME », {entreprise} n'est pas cité`
(adapter si l'entreprise EST citée : « … {entreprise} est cité 3e, derrière {concurrent} »)

> Bonjour {prenom},
>
> Vos acheteurs comparent de plus en plus dans les assistants IA. J'ai posé {N} questions d'acheteurs de votre secteur à
> {IA mesurées} : {constat_1}. Côté site : {constat_2} (note SEO {note_seo}/100, lisibilité par les IA {note_geo}/100).
>
> Détail et marges d'erreur : {lien_analyse}.
>
> Repéré se lance et je cherche 3 PME pilotes : l'offre Accompagné offerte {durée}, en échange de vos retours. Un
> échange de 15 minutes cette semaine ?
>
> {Prénom}

**E-mail 2 — J+4.** Objet : `Pourquoi {concurrent} est cité avant vous`

> Bonjour {prenom},
>
> Dans les réponses mesurées, {concurrent} est cité {n} fois sur {total}. Les sources que les IA lisent à son sujet :
> {sources}. Votre entreprise n'apparaît pas dans {source manquante}. C'est souvent le levier le plus rapide.
>
> Je vous montre le détail en 15 minutes si utile.
>
> {Prénom}

**E-mail 3 — J+11 (dernier).** même forme que 4.1.

### 4.3 E-commerce (fondateur, responsable acquisition)

**E-mail 1 — J0.** Objet : `{entreprise} : ce que les IA recommandent quand on cherche « {catégorie} »`

> Bonjour {prenom},
>
> J'ai demandé à {IA mesurées} « quelle marque de {catégorie} recommandes-tu ? » : {constat_1}. En explorant
> {site}, j'ai relevé {constat_2} (par exemple des fiches produit sans balisage Product lisible par les IA).
>
> Détail et marges : {lien_analyse}.
>
> Je cherche 3 boutiques pilotes pour Repéré. Intéressé par 15 minutes pour en parler ?
>
> {Prénom}

**E-mail 2 — J+4.** Objet : `{n} fiches produit que les IA ne peuvent pas lire`

> Bonjour {prenom},
>
> Exemple concret tiré de l'analyse : {URL fiche} — {constat technique}. La correction peut être appliquée depuis
> Repéré sur {Shopify / WooCommerce / PrestaShop}, après votre validation, et se défait en un clic.
>
> {Prénom}

**E-mail 3 — J+11 (dernier).** même forme que 4.1.

### 4.4 Agences web (partenariat)

**E-mail unique + 1 relance.** Objet : `Vos clients vous demandent déjà « et ChatGPT ? »`

> Bonjour {prenom},
>
> Je lance Repéré, un outil français qui mesure ce que Google et les IA disent d'un site et prépare les corrections.
> Je cherche 3 agences pour le construire avec nous : accès complet gratuit pendant le lancement, et une place pilote
> pour un de vos clients si vous le souhaitez. En échange : vos retours francs.
>
> 20 minutes de démo sur un site de votre choix ?
>
> {Prénom}

## 5. Ce qu'on n'écrit jamais
« Garanti », « numéro 1 », « explosez », « nos clients » (nous n'en avons pas encore), un chiffre non mesuré,
un concurrent dénigré, une fausse familiarité (« Suite à notre échange » sans échange).
