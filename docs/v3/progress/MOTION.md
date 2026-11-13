# MOTION — journal (terminé, 9 nov.)
## Fait
- globals.css : jetons de mouvement, CSS des primitives, bloc mouvement réduit enrichi.
- src/components/motion/ : lib.ts (pur, testé), MotionRoot+Reveal, Counter, Typewriter, Tilt, Marquee, ScrollProgress, GaugeMorph,
  ChartDraw, GhostCursor, Parallax, ScenePlayer (pause/rejouer/étape par étape, transcription), DemoVideo (fs côté serveur)
  + VideoPlayer, QuickAuditForm, HeroDemo ; scenes/ Hero (3 parcours), Measure, Understand, Act, Prove. 19 tests verts, tsc propre.
- site/AiStrip (5 IA, pastilles texte), Bento (7 cellules, CSS seul), ProofWall ; page.tsx, SegmentLanding, /pme /local /e-commerce refaits.
## Non livré
- Comparateur avant/après, frise collante des piliers, modale vidéo « Voir en vrai » (hors liste de mission).
## À faire par d'autres
- PAGES-SITE : ancres /fonctionnalites#mesurer|sources|verite|trafic|copilote|taches ; page /demo ; entrée « Voir la démo » dans l'en-tête.
- App (vague 2b) : lire /app?visite=1&segment=local|pme|ecommerce (visite guidée + compte démo).
- TACHES-FOND : next.config `outputFileTracingIncludes` pour public/videos/** si les pages sont régénérées (ISR) sur Vercel.
- Orchestrateur : mesurer le JS ajouté à l'accueil au build (scènes non différées ; cible ≤ 8 ko gzip).
