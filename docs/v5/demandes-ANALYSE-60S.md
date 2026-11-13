# Demandes d'ANALYSE-UI (13 nov. 2026)
1. `crawl` : ajouter `urls?: string[]` (pages lues depuis le dernier événement) pour la mini-carte en direct.
2. Contrôle IA : émettre les questions (texte) dès qu'elles sont construites, pour l'écran vivant.
3. `detect` : conserver le message SafeFetchError (robots_disallowed → mentionne RepereBot) dans `modules.detect.error`.
4. E-mail facultatif : envoyer le lien signé du rapport par e-mail (aujourd'hui seul le hachage est gardé).
5. (Auth / claims.ts) : `/inscription?analyse=<id>` → claim `analysis` → attachAnalysisToBusiness.
6. sitemap.ts : ajouter /analyse (page indexable).
