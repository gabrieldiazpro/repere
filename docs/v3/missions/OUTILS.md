# Mission OUTILS (journal : docs/v3/progress/OUTILS.md)

Charge le skill frontend-design (outil Skill).

## À lire
- § Endpoints AUDIT-SITE de docs/v3/12-CONTRATS-V3.md : c'est ton contrat d'API. Vérifie ensuite les routes réellement
  écrites dans src/app/api/tools/** et les types de src/lib/siteaudit/** (l'agent AUDIT-SITE travaille en parallèle ou
  a fini) : aligne-toi sur le code réel quand il existe.
- docs/v3/11-outils-gratuits.md en entier, docs/v3/04-teardown-suites.md (graders : score visible, détail contre
  e-mail), docs/01-marque.md.
- Code : src/components/ui/**, src/components/site/{ScoreGauge,AuditMiniForm}.tsx, src/lib/seo/{shell,jsonld,site}.ts*,
  src/app/guides (gabarit de page), src/app/api/leads/route.ts, src/components/motion/** s'il existe (primitives
  d'animation à réutiliser).

## Périmètre exclusif
src/app/outils/**, src/components/tools/**.

## À livrer
Un hub /outils et 8 outils gratuits sans inscription, en français, soignés, rapides, utilisables sur mobile :
1. /outils/lien-avis-google : lien d'avis + QR code (SVG téléchargeable, affichette A5 imprimable en CSS print).
2. /outils/robots-ia : vérificateur de robots.txt pour les robots d'IA (tableau par robot : rôle, autorisé ou bloqué,
   lignes à ajouter).
3. /outils/pret-pour-les-ia : score /100, jauge animée, contrôles dépliables avec correctif.
4. /outils/citabilite : score de citabilité d'une page (URL ou texte collé), extraits citables surlignés.
5. /outils/json-ld : générateur (LocalBusiness, Organization, Product, FAQ) + validateur, copie en un clic.
6. /outils/rendu-sans-javascript : ce que voient les robots d'IA (texte du HTML brut comparé à la page).
7. /outils/comparateur : mon site face à un concurrent.
8. /outils/llms-txt : générateur, avec encadré honnête sur son utilité réelle.
Bonus : /outils/fiche-produit.

Pour chaque outil : formulaire avec états (chargement, erreurs : URL invalide, site injoignable, limite atteinte,
résultat) ; résultat partageable par ?url= ; pont vers l'audit complet (« Ce test regarde votre site. L'audit regarde
ce que les IA disent de vous ») ; capture d'e-mail facultative (POST /api/leads, source 'tool' ; si l'enum zod la
refuse, 'site' et signale-le) ; contenu SEO utile sous l'outil (fonctionnement, FAQ, sources) avec metadata, canonical,
JSON-LD WebApplication et FAQPage ; état « exemple » pré-rempli. Animations sobres, prefers-reduced-motion respecté.
Pas de serveur pour vérifier : sois rigoureux sur le HTML et le CSS. tsc par le verrou.
