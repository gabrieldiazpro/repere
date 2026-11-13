# Indice de demande d'une question — méthode publiée

Repéré n'affiche **jamais de volume de recherche chiffré** pour une question posée aux IA : aucune source publique
fiable ne donne ces volumes. À la place, chaque question porte un **indice de demande** : `faible`, `moyen` ou
`fort`, toujours étiqueté **« estimation »**. Il sert à trier et à choisir des questions, pas à prévoir du trafic.

La règle est déterministe (même question = même indice), sans appel réseau ni IA. Code : `src/lib/prompts/demand.ts`.

## Calcul

`points = intention + généricité − ville − quartier − nom propre`

| Signal | Lecture | Points |
|---|---|---|
| Intention | recommandation, proximité (découverte large) | +2 |
| | avis, urgence, prix, où acheter | +1 |
| | comparatif, alternative, service précis | 0 |
| | question sur une marque nommée | −1 |
| Généricité | 3 mots porteurs de sens ou moins (hors mots vides, ville, quartier) | +2 |
| | 4 à 6 mots | +1 |
| | 7 mots ou plus | 0 |
| Ville | grande ville citée (> 150 000 hab., liste INSEE dans le code) | 0 |
| | ville moyenne ou petite citée (dont la ville déclarée du commerce si elle n'est pas dans la liste) | −1 |
| Quartier | quartier, arrondissement, code postal | −1 |
| Nom propre | la question cite le commerce ou un concurrent | −1 |

Niveau : **fort** si points ≥ 3, **moyen** si 1 ou 2, **faible** si ≤ 0.

Les signaux retenus sont renvoyés avec l'indice (`signals`) pour que l'utilisateur voie pourquoi.

## Limites (dites à l'utilisateur)

- C'est une estimation relative fondée sur la forme de la question, pas une mesure de la demande réelle.
- Une question « faible » peut être très rentable (question pointue, client prêt à acheter).
- La règle ne change qu'avec une nouvelle version de ce document.

## Dédoublonnage des questions (même module)

Deux questions sont des doublons si leur forme canonique (minuscules, sans accents ni ponctuation) est identique,
ou si la similarité de Jaccard de leurs mots porteurs de sens (sans mots vides, pluriels ramenés au singulier)
est ≥ 0,8 **et** qu'elles ont la même intention (« meilleur plombier » ≠ « plombier le mieux noté »).
Code : `src/lib/prompts/text.ts`.
