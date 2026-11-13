
## De SYSTEME (règle prioritaire du coordinateur — mouvement réduit)
Voir docs/v4/SYSTEME-API.md § 0 : sous prefers-reduced-motion, on coupe les DÉPLACEMENTS, pas les fondus/compteurs/tracés.
Supprimez vos règles globales « animation: none !important / transition: none » et remplacez les keyframes de déplacement
par des fondus (fichiers concernés : components/report/report.module.css, components/report/v3.module.css, components/tools/tools.css, app/audit/audit.module.css).
Helper JS : motionAllowed(kind) dans @/components/motion/lib.
