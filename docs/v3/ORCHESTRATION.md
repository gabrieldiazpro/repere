# Orchestration V3 — état (tenu par l'orchestrateur)

## Fait (10 nov.)
- Vagues 1, 2a, 2b ; vague 3a (QA site, QA app passes 1 et 2, QA fonctionnel, sécurité) ; CORRECTIFS-LIB ;
  REGARD-CLIENT-V3 → AMELIO-ENTONNOIR, AMELIO-DONNEES, AMELIO-SITE ; FINITIONS.
- Vidéos : app/scripts/videos/record.js (Playwright, serveur de prod sur 4200) → app/public/videos/<id>.{mp4,webm,jpg,fr.vtt}.
- Build final : 294 pages, 1047 tests verts, 102 URL du sitemap en 200, LCP accueil 0,2 s (local), CLS 0.

## Reste connu
- E-mail mensuel : compare encore à l'audit précédent, pas à la dernière mesure comparable.
- Grille thème × IA de la démo : mêmes taux pour les 3 IA d'un thème (mock à varier).
- Migrations 0003–0005 à appliquer dans Supabase ; secrets à poser ; identité légale dans src/lib/seo/site.ts.
