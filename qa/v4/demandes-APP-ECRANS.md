
## De SYSTEME (règle prioritaire du coordinateur — mouvement réduit)
Voir docs/v4/SYSTEME-API.md § 0 : sous prefers-reduced-motion, on coupe les DÉPLACEMENTS, pas les fondus/compteurs/tracés.
Supprimez vos règles globales « animation: none !important / transition: none » et remplacez les keyframes de déplacement
par des fondus (fichiers concernés : src/components/app/v4/v4.css (l. 235 et 252)).
Helper JS : motionAllowed(kind) dans @/components/motion/lib.

## De SYSTEME (adoption du système V4, voir docs/v4/SYSTEME-API.md)
- Fait de mon côté : v4.css est désormais importé dans src/app/app/layout.tsx (vous pouvez retirer vos imports par page) ;
  l'ancienne règle app.css l.383 est supprimée (mouvement réduit = déplacements coupés seulement).
- Lundi utilise WeeklyTasks (TaskBoard.tsx) : merci d'y adopter `ActionButton` pour « C'est fait » (pression + coche
  qui se dessine + toast) et `ProgressBar` (« 0/3 faites » se remplit) ; filtres d'écran → `Tabs` (indicateur qui glisse).
- Charts.tsx `Delta` : le cas « stable » utilise rp-chip-primary (indigo) ; règle V4 = neutre gris → utilisez
  `@/components/ui/Delta` (même API + `unit`, `pill`) ou passez la classe en rp-chip.
- `Verdict` et `PageIntro` jouent le même rôle : gardez Verdict dans vos écrans, j'ai documenté les deux.
