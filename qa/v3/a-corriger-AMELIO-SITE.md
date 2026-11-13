# À corriger par AMELIO-SITE — chiffres de démo de référence (agent AMELIO-DONNEES, 10 nov. 2026)

Source unique : `auditStats(dernier audit)` de `src/lib/digest/stats.ts` sur `buildDemoWorkspace()` (`src/lib/demo-v2.ts`).
Le mieux : importer ces valeurs (`buildDemoWorkspace(seg)` + `auditStats`) au rendu statique plutôt que les recopier
(B9 du rapport qa/v3/regard-client-v3.md). Définitions figées :
- **taux de mention** = réponses qui citent / réponses exploitables (« X % des réponses ») ;
- **part de voix** = citations de l'acteur / total des citations des 10 acteurs classés, vous compris (« X % des citations »).
Ne jamais écrire « cité dans X % des réponses » pour une part de voix.

## Plomberie Martin (`demo`, local, Paris 11e) — mesure du 5 du mois
- Score **61/100** (historique 18 → 27 → 33 → 42 → 52 → 61), **3ᵉ sur 10 plombiers du 11ᵉ**.
- Cité dans **24 réponses sur 46** (taux de mention **52 %**), part de voix **14 %**. 16 questions × 3 IA (ChatGPT, Perplexity, Gemini).
- Parts de voix : Atelier Henry 17 % (29 citations) · Fournier & Fils 14 % (25) · **Plomberie Martin 14 % (24)** · Ets Renaud 12 % (20) ·
  Plomberie Garnier 10 % (18) · Atelier Chevalier 10 % (17) · SOS Plombier Paris 11 9 % (15) · Ets Perrin 7 % (12) · Perrin & Fils 4 % (7) · Atelier Caron 3 % (6).
- Fiche Google démo : **14 avis, note 4,3**.

## Paysia (`demo-pme`, logiciel de paie pour PME)
- Score **47/100** (22 → 26 → 31 → 35 → 41 → 47), **7ᵉ sur 10 acteurs cités**.
- Cité dans **18 réponses sur 48** (taux de mention **38 %**), part de voix **8 %**.
- Parts de voix : Paylo 17 % (39) · Netpaie 15 % (36) · Salaria 12 % (28) · Clairpaie 11 % (26) · Terapaie 11 % (25) · Novapaie 9 % (22) ·
  **Paysia 8 % (18)** · Orsapaie 8 % (18) · Lumipaie 7 % (17) · Briopaie 3 % (7).
- À retirer du site : « Paysia 3ᵉ à 18 % », « Silva RH », « Bulletin+ », « 4ᵉ / 12 » (n'existent pas dans le compte).

## Maison Sora (`demo-ecom`, cosmétiques solides)
- Score **36/100** (12 → 15 → 21 → 24 → 30 → 36), **10ᵉ sur 10 marques citées**.
- Citée dans **12 réponses sur 48** (taux de mention **25 %**), part de voix **5 %**.
- Parts de voix : Savonnerie Alba 15 % (35) · Pain de Lune 14 % (32) · Atelier Brume 12 % (28) · Terre d’Ocre 12 % (28) · Rivage Solide 11 % (25) ·
  Maison Corail 9 % (20) · Sève & Sel 8 % (19) · Belle Racine 7 % (16) · Comptoir Argile 7 % (16) · **Maison Sora 5 % (12)**.
- Noms renommés (doublons) : « Maison Alba » → **Maison Corail**, « Terre de Lune » → **Terre d’Ocre**. Mettre à jour le site s'il les cite.


## Trafic et ventes venus des IA (démo, `getAiTraffic(id, jours)` de `src/lib/tracking`)
| Compte | 30 jours | 90 jours |
|---|---|---|
| Plomberie Martin | 104 visites IA (ChatGPT 65), 9 appels ou e-mails, 5,6 % du trafic | 197 visites, 19 appels ou e-mails |
| Paysia | 1 113 visites IA, 53 conversions, 8,8 % du trafic | 2 094 visites, 105 conversions |
| Maison Sora | 249 visites IA, **17 commandes, 675,90 €**, 0,9 % du trafic | 460 visites, 28 commandes, 1 092,60 € |

À remplacer sur le site : « 772 visites sur 12 semaines, 19 commandes » (Maison Sora) → les chiffres ci-dessus, avec la période.
Écrire toujours la période (30 ou 90 jours) à côté du chiffre.
