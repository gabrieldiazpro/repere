# Plan de lancement : 30 jours

J1 = le jour où le site est en ligne sur le vrai domaine avec les clés d'IA actives. Chaque jour tient en 2 à 4 heures,
le reste du temps va aux pilotes. Un principe : **on ne publie que ce qu'on a mesuré**. Pas de « +40 % de visibilité »,
pas de « déjà 50 entreprises » : nous n'en avons pas, et le dire est notre meilleur argument.

Trois objectifs au J30 (à valider) :
- 10 pilotes retenus, dont au moins 6 avec J0 mesuré ;
- 3 baromètres publiés à partir de vraies mesures, et au moins 2 articles ou mentions presse qui les citent ;
- un premier flux de prospection régulier : 25 contacts qualifiés par jour ouvré, conformes CNIL.

## Avant le lancement (J-7 à J0)

| Jour | À faire | Fini quand |
|---|---|---|
| J-7 | Remplir l'identité (fondateur, mentions légales, SIREN) ; décider l'offre pilote (README, décision 1). | `/a-propos` et `/presse` sans « [À COMPLÉTER] ». |
| J-6 | Créer l'adresse presse et l'adresse d'envoi de prospection sur un domaine secondaire (SPF, DKIM, DMARC en `p=none`). Commencer la chauffe : 5 à 10 e-mails réels par jour à des contacts connus. | Domaine authentifié (test sur un outil de vérification d'en-têtes). |
| J-5 | Lancer les 3 premiers baromètres (un local, un PME, un e-commerce ; par ex. `plombiers-paris`, `logiciels-de-paie-pour-pme`, `marques-de-cosmetiques-solides`) avec les vraies clés. | Données relues à la main, pages en ligne en préproduction. |
| J-4 | Liste de 30 personnes de votre réseau à prévenir personnellement le J1 (pas de mailing). Liste de 20 agences web locales. | Deux listes dans un tableur. |
| J-3 | Profil LinkedIn à jour (linkedin.md §1). Écrire les 3 premières publications. | Publications programmées ou prêtes. |
| J-2 | Liste presse : 15 journalistes et newsletters (tech, commerce, e-commerce, régionale). Pour chacun, un article récent qu'il a écrit sur l'IA ou la recherche en ligne. | Tableur presse avec l'angle par personne. |
| J-1 | Faire une analyse gratuite de bout en bout sur 3 vrais sites (le vôtre, un ami commerçant, une PME amie). Corriger ce qui gêne. | Les 3 parcours passent sans aide. |

## Semaine 1 — Ouvrir et trouver les pilotes

| Jour | Pilotes | Visibilité | Prospection / partenariats |
|---|---|---|---|
| J1 | Message personnel aux 30 contacts du réseau : « je lance, je cherche 10 pilotes, connais-tu quelqu'un ? » avec le lien /pilotes. | Publication LinkedIn n°1 : « Je lance Repéré, et je n'ai aucun client » (linkedin.md §2). | — |
| J2 | Répondre à chaque candidature reçue (même refusée) sous 48 h. | Répondre à tous les commentaires de la veille. | Premières 10 analyses réelles de prospects locaux (`scripts/build-leads.ts` puis analyse), sans envoi. |
| J3 | Premiers appels de qualification (script-appel.md §3, version pilote). | Publication n°2 : ce que répondent les IA pour un métier dans votre ville (capture d'une vraie réponse, sans nommer d'entreprise dénigrée). | E-mail 1 de la séquence locale à 10 commerces (prospection-email.md). |
| J4 | Retenir les 3 premiers pilotes ; fixer leur J0. | — | 10 nouveaux e-mails 1. Message à 5 agences web locales (linkedin.md §5). |
| J5 | J0 des 3 premiers : analyse du site + audit IA dans leur espace, rattacher l'espace dans /admin/pilotes. | Publication n°3 : les 5 corrections qui reviennent le plus dans les analyses de la semaine (agrégé, anonyme). | Relances J+3. Bilan de semaine (kpi.md). |

## Semaine 2 — Les baromètres comme angle presse

| Jour | Pilotes | Visibilité / presse | Prospection / partenariats |
|---|---|---|---|
| J8 | Premières corrections proposées aux 3 pilotes (validation par eux). | Publier le baromètre local. Écrire un communiqué court (1 page) : la question posée, la méthode, 3 constats chiffrés, les limites. | 15 e-mails 1/jour (séquence selon le parcours). |
| J9 | Retenir les pilotes 4 à 6. | Envoyer le baromètre à 5 journalistes ou newsletters, un par un, avec l'angle de leur public (commerce local, régionale). | Appels : 10 commerces ayant ouvert sans répondre. |
| J10 | J0 des pilotes 4 à 6. | Publier le baromètre PME ; l'envoyer à la presse tech et B2B. | 2 rendez-vous agences (démo de 20 min). |
| J11 | Point d'étape de 15 minutes avec chaque pilote actif. | Publication LinkedIn : les sources que citent les IA pour ce baromètre (sans dénigrer). | 15 e-mails 1/jour. |
| J12 | — | Publier le baromètre e-commerce ; l'envoyer à la presse e-commerce. | Relances J+7. Bilan de semaine. |

Angle presse à tenir : « Nous avons posé N questions à 4 IA, 3 fois chacune ; voici qui elles recommandent, et pourquoi
c'est instable ». Toujours donner la méthode, le nombre de réponses, la date et les limites. Jamais « Repéré a aidé X ».

## Semaine 3 — Communautés et partenariats

| Jour | Pilotes | Visibilité | Prospection / partenariats |
|---|---|---|---|
| J15 | Retenir les pilotes 7 à 10 (compléter les parcours manquants). | Publication : ce que vous avez appris des 6 premiers J0 (agrégé, avec vos vrais chiffres ; forme type : « N sites sur 6 bloquaient un robot d'IA sans le savoir »). | Programme agence : proposer aux 2 agences les plus intéressées d'apporter un client pilote chacune. |
| J16 | J0 des pilotes 7 à 10. | Participer à 3 discussions de communautés francophones où votre sujet est la question posée (groupes LinkedIn e-commerce, forums de commerçants, Slack ou Discord de fondateurs) : répondre utilement, lien seulement si demandé. | 20 e-mails 1/jour si la délivrabilité est saine (kpi.md, seuils). |
| J17 | — | Proposer une tribune de 4 000 signes à un média commerce ou e-commerce : « Ce que les IA disent des commerces français » (chiffres des baromètres). | Appels de relance. |
| J18 | — | Décider Product Hunt (README, décision 8). Si oui : page en anglais, captures de la démo, lancement un mardi ou mercredi, réponses à tous les commentaires toute la journée. Si non : poster sur une communauté de fondateurs francophones avec un retour d'expérience honnête. | — |
| J19 | J30 des 3 premiers pilotes : nouvelle mesure, échange de 30 minutes, noter les retours mot pour mot. | — | Bilan de semaine. |

## Semaine 4 — Premières preuves et cadence

| Jour | Pilotes | Visibilité | Prospection |
|---|---|---|---|
| J22 | Rédiger avec les pilotes qui ont donné leur accord une note « J0 → J30 » factuelle (ce qui a été corrigé, ce qui a bougé, la marge d'erreur). Ils relisent et valident. | — | 20 e-mails 1/jour. |
| J23 | — | Mise à jour mensuelle des 3 baromètres (2e mesure : ce qui a changé en un mois). Nouvel envoi presse : « En un mois, les IA ont changé d'avis sur X % des recommandations » (X mesuré, sinon pas d'envoi). | Relances J+14 (dernier message). |
| J24 | J30 des pilotes 4 à 6. | Publication : un retour de pilote, cité seulement avec son accord écrit. | Appels. |
| J25 | — | Webinaire de 30 minutes ouvert : « Ce que ChatGPT dit de votre commerce, en direct » (analyses en direct de sites volontaires). | Inviter les prospects qui ont répondu. |
| J26-J29 | J30 des pilotes 7 à 10 au fil de l'eau. | 1 publication tous les 2 jours. | Cadence fixe : 20 e-mails 1/jour, relances, 10 appels. |
| J30 | Bilan pilotes : liste des retours classés, 3 corrections produit à faire. | Bilan public sur LinkedIn : ce qui a marché, ce qui n'a pas marché, chiffres réels du mois (visites, analyses, inscriptions). | Bilan kpi.md ; décider la suite (élargir le programme, ouvrir l'offre agence, ajuster la séquence). |

## Ce que nous ne faisons pas pendant ces 30 jours
- Pas de publicité payante tant que la page /analyse n'a pas montré qu'elle convertit (mesurer d'abord).
- Pas d'achat de fichier d'e-mails, pas d'adresse devinée sans examen au cas par cas (prospection-email.md §1).
- Pas de capture d'une vraie entreprise prospect dans une publication sans son accord.
- Pas de « avant/après » publié avant J90 sauf accord explicite et mention claire « à J30, mesure intermédiaire ».
