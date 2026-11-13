# Règles communes aux agents « écrans de l'app » (vague 2b) — à lire après _COMMUN.md

Charge le skill frontend-design (outil Skill).

## Contexte
L'espace client /app existe (V2) : src/app/app/** et src/components/app/**. Les bibliothèques et API de la V3 sont
livrées et raccordées. Lis les journaux docs/v3/progress/*.md des modules que tu utilises (formes exactes des
fonctions et des routes) et docs/v3/09-audit-app.md (défauts par écran, 20 améliorations prioritaires, onboarding cible).

## Répartition (périmètres exclusifs)
| Agent | Fichiers |
|---|---|
| COQUILLE | src/app/app/layout.tsx, src/app/app/page.tsx (Lundi), src/app/app/{bienvenue,reglages,plus,connexion,hors-ligne,notifications}/**, src/components/app/shell/**, src/components/app/{Shell,HeaderClient,TabBar,nav,icons,tokens,app.css,workspace,data,SessionSync,Settings,InstallPrompt,SwRegister}.ts* |
| MESURE | src/app/app/{questions,reponses,citations,sources,concurrents,ia,requetes,historique}/**, src/components/app/mesure/** |
| ACTION | src/app/app/{taches,actions,pages,technique,rapports,trafic,verite,copilote,plan}/**, src/components/app/action/**, src/components/app/{TaskBoard,TruthEditor,Copilot,TrafficClient,Markdown,CopyButton}.tsx |
| METIERS | src/app/app/{local,produits}/**, src/components/app/metiers/** |
Fichiers partagés en lecture pour tous : src/components/app/{Charts,ChartsClient,PageHeader,Quote,RetryButton}.tsx.
Besoin d'un nouveau composant partagé → crée-le dans TON dossier. Besoin d'une entrée de menu → écris-la dans ton
journal (« À faire par d'autres » → COQUILLE), COQUILLE les intègre ; en attendant ta page est accessible par son URL.

## Règles d'interface
- Données côté serveur par les fonctions des modules ; mutations par les routes API. Session par '@/lib/auth'
  (getSession / requireBusiness) ; droits par '@/lib/entitlements' : une fonction hors offre s'affiche verrouillée
  avec l'offre requise et un lien vers /tarifs, jamais cachée, jamais d'erreur brute.
- Les 3 comptes démo (`demo`, `demo-pme`, `demo-ecom`) restent utilisables sans connexion, en lecture seule côté
  serveur (les modifications sont gardées sur l'appareil, avec la mention « démo »).
- Chaque donnée mène à une action (« et maintenant ? ») : bouton vers la tâche, le copilote (avec ?context=) ou l'export.
- États : chargement (squelettes), vide (utile : explique quoi faire), erreur (réessayer). Mobile d'abord, puis bureau.
- Animations sobres via src/components/motion/** (Reveal, Counter, ChartDraw…) ; prefers-reduced-motion respecté.
- Mode sombre : utilise uniquement les variables CSS de l'app (COQUILLE fournit les tokens sombres dans app.css) —
  aucune couleur en dur.
- Cohérence des chiffres : réutilise les fonctions de calcul uniques (src/lib/digest/stats.ts, moteur) ; ne recalcule
  rien dans un composant.
- Français, vouvoiement, vocabulaire de patron (« questions suivies », pas « prompts »).
- Pas de serveur pour vérifier : rigueur sur le HTML et le CSS ; tsc par le verrou (2 fois max).
