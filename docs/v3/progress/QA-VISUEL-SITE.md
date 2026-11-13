# QA-VISUEL-SITE — journal (terminé)
Serveur 4101 : meurt sous l'OOM du cgroup partagé → _scripts/watchdog.sh le relance. Scripts : qa/v3/QA-VISUEL-SITE/_scripts/.
## Fait
- Crawl : 553 URL internes, 0 lien mort. 60 pages vues en bureau + iPhone 13, outils (exemple + URL injoignable),
  /audit ×3 → rapport, /r/{jeton}, sans JS, reduced-motion, menus/clavier, LCP/CLS.
- Corrigé (~30 défauts) : débordements mobiles (/tarifs, /demo, /fonctionnalites/agir, rapport, /r), réponse du hero
  tronquée, silhouettes au lieu d'un cadre vide (hero), champ écrasé, onglets mobiles, boutons multilignes, CSP bloquant
  t.js (/connexion, /inscription), clés React en double (outils), comparateur en erreur, alignements (/securite,
  limites, outils), chiffres répétés (mur de preuves), IA par offre (alignées sur getEntitlements), 1 314 insécables,
  bundle client de l'accueil −26 % (nav-links.ts, hero-answers.ts).
- tsc : 0 erreur ; vitest site/motion/pages/tools/report/audit : verts.
## Reste
- LCP de l'accueil non mesuré (Chromium tué par l'OOM) ; /carte/{id} non testé (opt-in) ; poids JS en dev seulement.
## À faire par d'autres
- qa/v3/a-corriger-QA-FONCTIONNEL.md : src/lib/plans.ts (« AI Overviews » Essentiel PME), src/lib/growth/badge.ts
  (texte sous la pastille de note).
