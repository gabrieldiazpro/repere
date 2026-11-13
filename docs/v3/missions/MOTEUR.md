# Mission MOTEUR (journal : docs/v3/progress/MOTEUR.md)

## À lire
- docs/v3/09-audit-app.md : § incohérences de données et fonctions absentes liées au moteur.
- docs/v3/01-teardown-enterprise.md : marge d'erreur, « expliquer ce changement », volume estimé.
- docs/v3/03-teardown-france.md : grille thème × IA, écart → brief.
- Tout src/lib/engine/**, docs/04-api-ia.md.
- 2 ou 3 recherches web sur l'API Mistral actuelle (chat completions, recherche web / agents, modèle bon marché,
  format des citations).

## Périmètre exclusif
src/lib/engine/** uniquement.

## À livrer
1. `runAudit(input, { queries })` : questions personnalisées (texte, tags, thème, intention) qui remplacent ou
   complètent les gabarits. Chaque QuerySpec porte `theme` et `tags`.
2. Fournisseur **Mistral** (`MISTRAL_API_KEY`, modèle par variable d'env), intégré à la sélection et au budget.
   ProviderId étendu à 'mistral' (ajout additif dans types.ts) : vérifie par grep que les Record<ProviderId, …> ailleurs
   dans src ne cassent pas ; liste les fichiers hors périmètre à adapter, sans les modifier.
3. **Marge d'erreur** par indicateur (score, taux de mention, part de voix) par bootstrap, exposée dans le résultat.
4. **Part de voix par thème × IA** (matrice) et 10 premiers concurrents.
5. **Citations URL par URL** : agrégat `urls` (url, titre, domaine, IA, questions, nombre, présence du client et des
   concurrents) dans SourcesReport, ajout additif.
6. `explainChange(prev, next)` : explication structurée d'une variation (questions gagnées ou perdues, IA, sources
   apparues ou disparues, concurrent), phrases en français, niveau de confiance par rapport à la marge.
7. `buildContentBrief(gap | opportunity, input)` : titre, angle, questions à traiter, sources à citer, structure, longueur.
8. **Cohérence** : nombre de questions (8 ou 10), sentiment à 0 % négatif face à un verbatim négatif, dates. Une
   seule fonction de vérité par chiffre.
9. Mock mis à jour pour tout cela, 3 segments, déterministe.
10. Tests pour chaque point ; les tests existants du moteur restent verts.
