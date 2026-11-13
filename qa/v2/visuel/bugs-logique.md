# QA VISUEL V2 — bugs de logique repérés (hors périmètre CSS/markup)

À traiter par QA FONCTIONNEL ou par le propriétaire du module. Repérés pendant la revue visuelle du 9 novembre 2026.

1. **Rapport : nombres de réponses incohérents dans un même rapport** (rapport PME démo, id b494b017…).
   Bloc confiance : « 54 réponses analysées » ; KPI : « 7 sur 48 » ; sources : « 146 citations dans 36 réponses » ;
   notes par IA : « environ 16 réponses chacune » (3 × 16 = 48) ; méthode : « 10 questions × 3 IA × 2 passages » (= 60).
   Il faut une seule base, ou dire explicitement ce que compte chaque chiffre. Source probable : `src/lib/engine` (createMockAudit)
   ou `src/components/report/adapters.ts` (même chiffre lu dans deux champs différents).

2. **FAQ à coller : apostrophe échappée deux fois.** Le bloc « Bloc FAQ à coller sur votre site » du rapport affiche
   `Qu&#39;est-ce que Payflow ?`. Une fois collé, ce HTML s'affiche correctement, mais le texte lu dans le rapport fait
   « cassé ». À vérifier dans `buildFaq` (`src/lib/execution`) : échapper une seule fois, ou afficher `'`.

3. **Libellés générés sans espaces insécables** (`src/lib/alerts.ts`, `src/lib/execution/tasks.ts`, `src/lib/engine`).
   Titres du type « Gemini donne une information fausse : adresse », « Publier un guide d'achat « shampoing solide » »
   et questions « … PME ? » : le « : », le « ? » ou le « » » se retrouvent seuls en début de ligne sur mobile.
   Contournement posé à l'affichage (`src/components/ui/typo.ts`, fonction `fr()`, sur les titres de tâches, d'alertes et
   d'actions du rapport). Correction de fond : produire ` ` avant « : ; ! ? » et à l'intérieur des guillemets dans les générateurs.

4. **Lien d'évitement « Aller au contenu » sans cible** sur les pages servies par `PageShell` / `LegalPage`
   (`src/lib/seo/shell.tsx`) : /methode, /guides, /guides/*, /visibilite-ia/**, /cgv, /mentions-legales, /confidentialite.
   Le layout racine pointe vers `#contenu`, mais `<main>` n'a pas d'`id="contenu"`. Il suffit d'ajouter `id="contenu"` au `<main>`
   de `PageShell` (fichier de `src/lib`, donc hors de mon périmètre). Corrigé de mon côté pour /audit et /rapport/[id].

5. **Copilote, suggestion inadaptée au segment local** : « Prépare mon point pour le comité de lundi » est proposé pour
   Plomberie Martin (artisan). Si la liste vient de `src/lib/copilot`, la filtrer par segment.
