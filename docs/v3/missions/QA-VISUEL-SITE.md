# Mission QA-VISUEL-SITE (journal : docs/v3/progress/QA-VISUEL-SITE.md)
Lis _COMMUN.md puis _QA-COMMUN.md. Charge le skill frontend-design. Spécification de design : docs/v3/07-design-benchmark.md.
Aucune page de la V3 n'a été vue dans un navigateur avant aujourd'hui : attends-toi à des défauts.

## À faire
1. Passe en revue, en bureau 1440 et en mobile (iPhone 13), TOUTES les pages publiques : /, /local, /pme, /e-commerce,
   /tarifs (4 onglets, calculateur), /demo, /fonctionnalites + ses 10 pages, /outils + ses 9 outils (lance chaque outil
   avec son exemple et avec une URL réelle injoignable pour voir l'état d'erreur), /nouveautes, /securite,
   /integrations, /contact (envoi), /aide + 2 articles, /cas-usage + 1 métier, /comparatif + 1 fiche, /methode,
   /methode/robot, /geo, /glossaire, /questions, /guides + 1 guide, /inscription, /connexion, /badge, /classement,
   /parrainage, /audit (3 parcours jusqu'au rapport), /rapport/{id} (3 segments), /carte/{id} si activable, /r/{jeton}
   si tu peux en créer un par l'API, /merci, la 404.
2. Pour chaque page : captures, lecture, puis correction des défauts : débordement horizontal (script : scrollWidth ≤
   clientWidth), chevauchements, texte tronqué, contraste, espacement incohérent, sections vides, animations qui
   laissent un contenu invisible ou figé (vérifie l'état final ET l'état sans JavaScript ET prefers-reduced-motion),
   décalages de mise en page (CLS), scènes animées du hero et des 4 piliers (regarde plusieurs instants), bento,
   bandeau des IA, mur de preuves, menu (bureau, mobile, clavier), pied de page, erreurs console réelles et
   d'hydratation, liens morts (crawl de tous les href internes).
3. Niveau d'exigence : les meilleurs sites de logiciels. Après les corrections, fais une passe « finition » sur
   l'accueil, /tarifs, /demo et /outils : hiérarchie, rythme, micro-interactions, états de survol et de focus.
4. Mesure le poids JavaScript de l'accueil et le LCP/CLS de 5 pages (Playwright) ; allège si un composant client est
   trop gros (import dynamique des scènes sous la ligne de flottaison).
5. Rapport : défauts trouvés / corrigés / restants, + chemins des 6 meilleures captures après correction.
