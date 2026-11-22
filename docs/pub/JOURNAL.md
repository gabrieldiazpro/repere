# PUBLICITE — journal (V8)

## 22 nov. 2026
- Lecture : brief V8, V5 (règles absolues), DESIGN-COMMUN, lancement (plan 30 j : pas de payant avant preuve de
  conversion de /analyse), textes d'identité. Serveur démo 4200 laissé tel quel (il redémarrait au début, attendu).
- Règles vérifiées en ligne (Meta, INC/Code conso L.121-2 à L.132-2, L.122-1/2, ARPP mentions et étiquetage IA) →
  docs/pub/regles.md. Décision : aucun concurrent nommé dans les annonces payantes.
- 48 accroches (4 cibles × 3 angles × 4) → docs/pub/accroches.md.
- Captures réelles de l'app démo (Playwright, un Chromium, viewport 720×1280, dsf 1) : 12 pages entières +
  2 séquences d'images (analyse 60 s rejouée sur le site fictif atelier-lumen.test avec scratchpad/aui/rich.ndjson ;
  agent : ouvrir → avant/après → valider → appliqué/vérifié) → pub/_src/footage/.
- Montage : pub/_src/reel.html (moteur image par image, texte animé façon « Voilà ce qui est arrivé », légendes
  incrustées, pastille « Démo » pendant toute présence de données, zooms et cadres de mise en évidence),
  pub/_src/reels.js (6 scénarios), pub/_src/render-reels.js (1080×1920, 30 i/s, H.264 veryfast, crf 18, sans son).
- Visuels : pub/_src/statics.html (12 maquettes HTML) + render-statics.js → pub/visuels/.
- Données affichées : uniquement celles des comptes démo, vérifiées sur les captures (ex. s2 corrigé : Perplexity
  rang 1, ChatGPT rang 2, Gemini absent pour « meilleur plombier à Paris 11e » ; Claude retiré de p2 car absent du
  compte démo PME).
- Textes d'annonce → docs/pub/annonces.md ; plan de test 20 €/j → docs/pub/plan-test.md.

## Points ouverts (pour d'autres agents / le fondateur)
- /agences : page publiée par FINALE-V8 (22 nov.) ; annonces agences repointées vers /agences dans annonces.md.
- s6 « Simulation pour ma boutique » : ne diffuser vers /outils/simulateur-boutique qu'une fois la page d'ECOM en ligne.
- Pixel Meta + consentement : rien n'existe dans l'app (hors de mon périmètre).
- Pour refaire les créations : `cd pub/_src && node capture.js && node render-reels.js all && node render-statics.js && node contact.js`.
