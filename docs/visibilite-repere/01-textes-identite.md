# Textes d'identité de Repéré — à copier tels quels, partout

Agent GEO-MARQUE, 15 nov. 2026. **Règle : les mêmes mots partout** (site, JSON-LD, LinkedIn, annuaires, presse). Bing
recommande des noms d'entités clairs et cohérents ; une description identique aide les moteurs à reconnaître la même
entité (recommandation d'opérateur, effet non chiffré). Si un texte change, il change ici d'abord, puis partout.

Faits utilisés (vérifiables dans le code) : docs/v5/positionnement.md § 2, src/lib/seo/competitors.ts (`CELLS.repere`),
src/lib/plans.ts. Ne rien ajouter qui ne soit pas vrai le jour de la publication (pas de nombre de clients, pas d'avis,
pas de « leader »).

## Nom et formes
- Nom : **Repéré** (avec accent). Forme sans accent tolérée seulement là où l'accent est refusé : « Repere ».
- Nom alternatif : **Repéré IA** (déjà dans le JSON-LD `alternateName`). Domaine : **repere-ia.fr**.
- Ne pas utiliser d'autres variantes (« Repéré.ai », « RepereIA », « Repéré SEO »).
- Slogan : **On mesure. On explique. On le fait.**

## Description très courte (≤ 60 caractères : Product Hunt, AlternativeTo, bio X/Bluesky)
> SEO et visibilité dans les IA, en français, pour les PME

## Description courte (≤ 160 caractères : meta, LinkedIn « slogan », G2 / Capterra « tagline »)
> Repéré analyse votre site, mesure si Google, ChatGPT, Gemini et Perplexity recommandent votre entreprise, et réalise les corrections avec vous.

## Description moyenne (≈ 300 caractères : « à propos » des profils, Crunchbase, annuaires) — proposée aussi comme ONE_LINER du site
> Repéré est un service français de référencement SEO et IA (GEO) : il analyse un site pour de vrai, mesure si Google, ChatGPT, Gemini, Perplexity et Claude recommandent l'entreprise, explique pourquoi ses concurrents sont cités et réalise les corrections, validées par le client avant publication.

## Description longue (≈ 1 000 caractères : G2, Capterra, Appvizer, LinkedIn « présentation », dossier de presse)
> Repéré est un service français qui aide les TPE, PME, commerces et e-commerces à être trouvés sur Google et recommandés par les assistants d'IA (ChatGPT, Gemini, Perplexity, Claude, et Mistral Le Chat en option).
>
> En 60 secondes, Repéré explore réellement le site (jusqu'à 60 pages sans compte, 500 à 2 000 selon l'offre), applique 185 contrôles SEO et un audit GEO dont chaque règle porte son niveau de preuve, puis donne les 5 corrections qui comptent. Il pose ensuite plusieurs fois les questions des clients aux IA, mesure qui est cité, à quel rang et avec quelles sources, avec une marge d'erreur affichée, et vérifie l'exactitude de ce que les IA disent de l'entreprise.
>
> Son agent applique les corrections sur WordPress, Shopify, Webflow ou PrestaShop après validation du client, de façon annulable. Repéré ne promet aucune position : il mesure, explique et fait. Offre gratuite permanente ; offres payantes dès 29 € par mois.

## Limites à dire quand on demande (honnêteté = crédibilité)
- Ne mesure pas Google AI Overviews ni AI Mode ; pas d'API publique ni de serveur MCP.
- Pas d'index de mots-clés ni de liens comparable à Semrush ou Ahrefs.
- Aucun avis client public ni client nommé à la mise en ligne.

## Mots-clés et catégories (dans cet ordre de priorité)
1. Generative Engine Optimization (GEO) / référencement IA / visibilité IA
2. Logiciel SEO / audit SEO
3. SEO local, SEO e-commerce
4. Suivi de marque dans ChatGPT / AI search visibility

## Fiche faits (pour les formulaires)
| Champ | Valeur |
|---|---|
| Pays | France |
| Langues | Français |
| Cible | TPE, PME, commerces locaux, e-commerces, agences (offre Agence) |
| Modèle | SaaS + accompagnement (offre Accompagné) |
| Prix | Découverte 0 € ; Essentiel 29 € (local), 79 € (e-commerce), 99 € (PME) par mois ; Accompagné dès 99 €/mois ; Agence 149 €/mois |
| Essai | Offre gratuite permanente, sans carte bancaire |
| Déploiement | Web (navigateur), sans installation |
| Intégrations | Search Console, PageSpeed, Bing Webmaster Tools, Google Analytics 4, WordPress, Shopify, Webflow, PrestaShop, Slack, webhook |
| Contact | contact@repere-ia.fr (variable NEXT_PUBLIC_CONTACT_EMAIL) |
| Fondateur | [à remplir par le fondateur : nom, titre, lien LinkedIn] |
| Société, SIREN, date de création | [à remplir : identiques aux variables NEXT_PUBLIC_LEGAL_*] |

Vérifier les prix dans src/lib/plans.ts le jour de chaque inscription : un prix différent entre le site et un annuaire
est l'incohérence la plus fréquente.

## Visuels à préparer (mêmes fichiers partout)
| Fichier | Où l'utiliser | Source |
|---|---|---|
| Logo carré 512 × 512 (PNG) | tous les profils | app/public/icons/icon-512.png |
| Bannière 1584 × 396 | LinkedIn entreprise | à créer (slogan + domaine) |
| Captures 1280 × 800 (5 maximum, sans données client réelles, étiquetées « démo ») | G2, Capterra, Product Hunt, AlternativeTo, Appvizer | 1. analyse 60 s en cours (/analyse) ; 2. rapport avec les 5 priorités ; 3. tableau des réponses des IA avec marge d'erreur (compte démo) ; 4. sources citées par les IA ; 5. aperçu avant/après de l'agent de publication |
| Vidéo démo 60 à 90 s | Product Hunt, YouTube, LinkedIn | parcours /demo |

Captures existantes réutilisables (bureau) : qa/shots/desk-app*.png, desk-audit.png — vérifier qu'elles sont à jour
et qu'elles n'affichent que des comptes de démonstration avant toute publication.
