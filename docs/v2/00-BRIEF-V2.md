# Repéré V2 — brief commun (source de vérité)

## Constat du fondateur
La V1 (mesure de visibilité IA des commerces locaux, score /100, PDF, 29 €/mois) est jugée « trop basique, peu d'intérêt
pour les clients ». Un score seul ne se vend pas : le client paie pour des résultats ou pour qu'on fasse le travail.

## Ambition V2 : devenir indispensable
« Le GEO des entreprises françaises — on mesure, on vous dit pourquoi, et on le fait pour vous. »
Trois parcours sur un même moteur :
1. **Local** (TPE : artisans, restaurants, agences…) — base V1.
2. **PME / B2B / services** (SaaS, cabinets de conseil, organismes de formation, industrie, agences) — requêtes
   sectorielles (« meilleur logiciel de paie pour PME », « cabinet de recrutement tech Paris »), comparatifs, alternatives.
3. **E-commerce** (marques DTC, boutiques Shopify/Woo) — requêtes produit (« meilleure crème solaire bio », « alternative
   à X »), shopping dans ChatGPT/Perplexity/Gemini.

Piliers produit V2 :
- **Sources** : quelles pages/domaines les IA citent pour les requêtes du client, présence ou absence du client sur
  chacune, opportunités classées (annuaires, médias, comparatifs, Reddit/forums, marketplaces, avis).
- **Pourquoi** : comparaison avec les concurrents cités (avis, présence sources, contenu, données structurées).
- **Exécution (« on le fait pour vous »)** : fiche Google Business Profile, Bing Places, balisage schema.org,
  pages FAQ / pages « citables », réponses et demandes d'avis, llms.txt, fiches annuaires, contenus comparatifs.
  Automatisé quand une API le permet, sinon généré + guidé + suivi.
- **Preuve** : trafic venu des IA (referrers chatgpt.com, perplexity.ai, gemini, copilot…, UTM), avant/après,
  part de voix dans le temps.
- **Rituel** : rapport hebdo/mensuel, alertes, tâches de la semaine, benchmark concurrents — raisons de revenir.

Contraintes : fondateur solo, Paris, budget minimal, français, conformité (CNIL, CGU des API, pas de promesse de
résultat, pas de faux avis). Code existant : /home/claude/auditia/app (Next.js 15, TS, Tailwind v4, Supabase, Stripe,
Resend, moteur dans src/lib/engine). Docs V1 : /home/claude/auditia/docs/*.md. Docs V2 : /home/claude/auditia/docs/v2/.
