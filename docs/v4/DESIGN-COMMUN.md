# Passe V4 « clarté et dynamisme » — règles communes (à lire par chaque agent)

Demande du fondateur : « Améliore les UI et UX, animations, visuels… je veux plus de clarté et plus de dynamisme. »
Projet : /home/claude/auditia/app (Next.js 15, React 19, Tailwind v4). Lis aussi /home/claude/auditia/docs/v3/missions/_COMMUN.md
(règles machine) et charge la compétence `frontend-design` avec l'outil Skill avant de dessiner quoi que ce soit.

## Ce que veut dire « clarté »
1. Une idée principale par écran / section, lisible en 3 secondes : un titre qui dit le résultat, pas la fonction
   (« Gemini se trompe sur vos horaires », pas « Vérification des faits »).
2. Un seul bouton principal par vue. Les autres actions en secondaire ou en menu.
3. Hiérarchie nette : chiffre clé grand, contexte petit dessous ; marges d'erreur et détails en second plan
   (visibles, jamais en premier).
4. Moins de texte : couper 30 % des paragraphes ; listes courtes ; détails dépliables (divulgation progressive).
5. Code couleur sémantique constant partout : progrès = vert, recul / erreur = rouge, attention = ambre,
   neutre = gris, marque = indigo. Jamais la couleur seule (icône ou signe ± avec).
6. Cohérence : mêmes cartes, mêmes rayons, mêmes espacements (échelle 4/8), mêmes états vides, mêmes en-têtes de page.
7. États : chargement (squelettes, pas d'écran blanc), vide (une phrase + l'action suivante), erreur (que faire).

## Ce que veut dire « dynamisme »
- Mouvement qui SERT la compréhension : compteurs qui montent jusqu'au chiffre, graphiques qui se tracent, jauges qui
  se remplissent, apparitions en cascade au défilement, transitions entre onglets, retour immédiat au clic
  (pression, coche animée sur « C'est fait », toast), indicateur « mesure en cours » vivant, survols qui révèlent.
- Durées 150–400 ms, courbes douces (ease-out), jamais de boucle qui distrait la lecture, rien qui bouge sous le texte lu.
- `prefers-reduced-motion` : tout reste lisible et complet sans animation (état final affiché directement).
- Utilise d'abord les primitives existantes de src/components/motion (Reveal, Counter, ChartDraw, GaugeMorph, Parallax,
  Tilt, Typewriter, ScenePlayer…) et les transitions CSS / Web Animations API. Pas de nouvelle grosse bibliothèque
  (pas de framer-motion, GSAP, Lottie) : budget JS. View Transitions API autorisée si dégradation propre.

## Visuels
- Illustrations : SVG faits maison, sobres, dans la palette (schémas « question → IA → réponse → vous »,
  pictos des IA en formes génériques — JAMAIS les logos officiels d'OpenAI, Google, Anthropic, Perplexity, Mistral).
- Captures et maquettes : celles de la vraie app (comptes démo), cadrées, avec annotations.
- Icônes : un seul jeu, même épaisseur de trait.
- Aucune fausse preuve : pas de faux logos clients, faux avis, faux chiffres de résultat (règle absolue).

## Contraintes techniques
- Mode sombre impeccable ; mobile 390 px sans défilement horizontal ; contraste AA ; focus clavier visible.
- Performance : pas de régression du LCP de l'accueil ; CLS 0 ; images en next/image ou SVG ; animations sur
  transform/opacity uniquement.
- SEO/GEO : ne change ni les URL, ni les titres <title>/meta, ni le JSON-LD, ni le texte des H1 sans raison forte ;
  le contenu doit rester dans le HTML rendu côté serveur (pas de texte uniquement injecté au client).
- Tests : `flock /tmp/repere-heavy.lock npx vitest run <tes dossiers>` et `flock /tmp/repere-heavy.lock npx tsc --noEmit`
  verts ; si un test fige un ancien libellé que tu changes volontairement, mets le test à jour.
- Jamais de next build / dev / start dans le dossier principal. Serveurs de test : site http://localhost:4101
  (copie qa-site), app http://localhost:4102 (copie qa-app). Après une modification :
  `/tmp/claude-0/-home-claude/1613138e-8209-5786-b4b6-a2bbf8070257/scratchpad/sync.sh qa-site` (ou qa-app).
  S'il tombe : `/tmp/claude-0/-home-claude/1613138e-8209-5786-b4b6-a2bbf8070257/scratchpad/dev.sh qa-site 4101`
  (ou `qa-app 4102`). Mémoire serrée : UN navigateur Chromium à la fois, deviceScaleFactor 1, ferme-le entre les lots.
- Captures avant / après obligatoires dans /home/claude/auditia/qa/v4/<TON-NOM>/ (avant/ et apres/), bureau 1440 et
  mobile 390, clair et sombre pour les écrans principaux. Regarde-les (Read) : c'est ton juge.

## Périmètres (exclusifs — hors du tien, n'édite pas : écris ta demande dans
/home/claude/auditia/qa/v4/demandes-<PROPRIÉTAIRE>.md)
| Agent | Possède |
|---|---|
| SYSTEME | src/app/globals.css, src/components/ui/**, src/components/motion/** (primitives), tokens, icônes, mise en page commune de l'app (coquille : menu, en-tête, bandeau démo — src/components/app/shell* ou équivalent, src/app/app/layout.tsx), accueil de l'app /app (« Lundi ») |
| SITE-ACCUEIL | src/components/site/**, pages / , /tarifs, /demo, /local, /pme, /e-commerce, en-tête et pied de page du site, src/components/motion/scenes/** |
| SITE-PAGES | src/components/pages/**, src/components/tools/**, src/components/report/**, toutes les autres pages publiques (fonctionnalités, outils, comparatifs, cas d'usage, aide, nouveautés, sécurité, intégrations, contact, méthode, inscription, connexion, bienvenue, rapport d'audit /audit…) |
| APP-ECRANS | src/app/app/** sauf layout.tsx et la page /app, src/components/app/** sauf la coquille |
| DEMO | /home/claude/auditia/demo/index.html uniquement |
SYSTEME publie tôt (dans l'heure) ce qu'il ajoute dans /home/claude/auditia/docs/v4/SYSTEME-API.md (composants,
classes, tokens, primitives d'animation, exemples) ; les autres le relisent régulièrement et l'adoptent.
Un agent MISE-EN-LIGNE travaille aussi sur scripts/ops, supabase, src/lib/env.ts et src/lib/seo/site.ts : n'y touche pas.
Personne ne modifie src/lib (données) sauf nécessité absolue, avec Edit minimal relu juste avant.
