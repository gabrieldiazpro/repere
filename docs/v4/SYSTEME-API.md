# SYSTEME-API — système visuel V4 « clarté et dynamisme »

Propriétaire : agent SYSTEME. Relisez ce fichier régulièrement ; demandes : `qa/v4/demandes-SYSTEME.md`.
Fichiers : `src/components/ui/ui.css` (jetons + classes `.ui-*`, importé par globals.css, donc partout : site et app),
`src/components/ui/*.tsx`, `src/components/motion/*`. Import groupé possible : `import { KeyFigure, Delta } from '@/components/ui'`.

## 0. RÈGLE PRIORITAIRE — mouvement réduit (tout le projet)

`prefers-reduced-motion: reduce` coupe le **MOUVEMENT** (translations, zooms, rebonds, parallaxe, défilement fluide,
inclinaison, curseur qui se déplace, bandeau qui défile, vidéo en lecture auto), **PAS** les animations sans déplacement :
fondus, compteurs qui montent, texte qui s'écrit, courbes et jauges qui se tracent, barres qui se remplissent, coche qui
se dessine, changement de couleur. (Le fondateur a « Réduire les animations » sur iPhone et ne voyait rien.)

- **Interdit** : `* { animation: none !important }`, `transition: none !important` global, `animation-duration: .01ms`.
- **À faire** : dans votre `@media (prefers-reduced-motion: reduce)`, redéfinissez vos keyframes de déplacement en
  fondu d'opacité (même nom → remplace l'original), ou mettez la distance à 0 (`--rise: 0px`, déjà fait à la racine).
- **JS** : ne sautez jamais toute l'animation ; utilisez `motionAllowed(kind)` de `@/components/motion/lib`
  (`'fade' | 'count' | 'type' | 'draw' | 'fill' | 'color'` → toujours vrai ; `'translate' | 'scale' | 'bounce' |
  'parallax' | 'tilt' | 'smooth-scroll' | 'cursor' | 'autoplay-video'` → faux en mouvement réduit).
- Déjà appliqué : globals.css, ui.css, app.css (ancienne règle `.rp-app * { animation:none }` supprimée), Counter,
  ChartDraw, GaugeMorph, Typewriter, ScenePlayer (les scènes jouent ; le curseur fantôme reste masqué), Reveal (fondu
  seul). Test : `src/components/motion/__tests__/reduced.test.ts`.
- **À corriger par leurs propriétaires** (règle globale encore présente) : `components/app/v4/v4.css` (APP-ECRANS),
  `components/report/*.module.css`, `components/tools/tools.css`, `app/audit/audit.module.css` (SITE-PAGES).

## 1. Jetons (variables CSS, clair + sombre automatiques dans `.rp-app`)

| Famille | Jetons | Usage |
|---|---|---|
| Espacement 4/8 | `--sp-1` 4 · `--sp-2` 8 · `--sp-3` 12 · `--sp-4` 16 · `--sp-5` 20 · `--sp-6` 24 · `--sp-8` 32 · `--sp-10` 40 · `--sp-12` 48 · `--sp-16` 64 | `gap-[var(--sp-4)]`, ou les classes Tailwind équivalentes (gap-4 = 16 px) |
| Rayons | `--r-xs` 6 (badges) · `--r-sm` 8 · `--r-md` 10 (boutons, champs) · `--r-lg` 14 (cartes) · `--r-xl` 20 (bloc héros) · `--r-pill` | plus le bloc est important, plus le rayon est grand |
| Ombres | `--sh-1` (carte de base) · `--sh-2` (carte mise en avant) · `--sh-3` (menus, fenêtres) | jamais d'ombre en dur |
| Typo | `--fs-figure-xl` (LE chiffre de la page, 44–64) · `--fs-figure` 34 · `--fs-figure-sm` 24 · `--fs-result` (titre-résultat 24–36) · `--fs-title` 28 · `--fs-h2` 17 · `--fs-body` 15 · `--fs-small` 13,5 · `--fs-caption` 12 | classes ci-dessous |
| Tons sémantiques | `--tone-{up,down,warn,neutral,brand}` (texte) · `-bg` (fond) · `-line` (bordure) · `-solid` (trait, barre) | progrès = up (vert), recul/erreur = down (rouge), attention = warn (ambre), neutre = gris, marque = brand (indigo). Jamais la couleur seule : signe ±, flèche ou icône avec |

Classes typo : `.ui-figure-xl`, `.ui-figure`, `.ui-figure-sm` (+ `.ui-figure-unit` pour « /100 », « % »), `.ui-result`,
`.ui-h2`, `.ui-body`, `.ui-small`, `.ui-caption`. TS : `type Tone`, `deltaTone(value, invert?)`, `signed(value)` (vrai « − »).

## 2. Composants (`src/components/ui`)

| Composant | Quand | Exemple |
|---|---|---|
| `PageIntro` (serveur) ; dans l'app via `<PageHeader result subtitle primary>` | En tête de chaque écran : le RÉSULTAT en titre (« Gemini se trompe sur vos horaires »), une phrase, UN bouton principal | `<PageHeader title="Vérité" result="Gemini se trompe sur vos horaires" resultTone="down"`<br>`  subtitle="1 erreur sur 12 faits vérifiés."`<br>`  primary={<Link className="ui-btn" data-variant="primary" href="…">Corriger</Link>} />` |
| `Surface` (serveur) | Toute carte. `elevation` : `hero` (1 par page), `raised` (l'essentiel), `base`, `flat` (détails). `tone` = liseré gauche sémantique | `<Surface title="Vos 3 tâches" id="t-h" aside={<Link>Tout voir</Link>} elevation="raised">`<br>`  …`<br>`</Surface>` |
| `KeyFigure` (serveur + îlots) | Chiffre clé : compteur qui monte, variation signée colorée, marge d'erreur en 2ᵉ plan, mini-courbe qui se trace | `<KeyFigure label="Score de visibilité" value={61} unit="/100"`<br>`  delta={9} deltaUnit=" pts" deltaLabel="sur un mois"`<br>`  margin="± 7 points (marge d’erreur)" trend={[44, 52, 61]} size="xl" />` |
| `Delta` (serveur) | Toute variation (flèche + signe + couleur) ; `invert` si une hausse est mauvaise (erreurs) ; `pill` pour un fond | `<Delta value={-2} unit=" places" label="sur un mois" pill />` |
| `StatusBadge` (serveur) | Statut court : tone + icône ; `live` = point qui pulse 3 fois (« mesure en cours ») | `<StatusBadge tone="down">2 erreurs</StatusBadge>`<br>`<StatusBadge tone="brand" live>Mesure en cours</StatusBadge>` |
| `Sparkline` (client) | Mini-courbe sans axes qui se trace à l'entrée à l'écran ; couleur = currentColor | `<Sparkline values={history} label="Score : 44, 52, 61" className="text-[var(--tone-brand)]" />` |
| `Tabs` (client) | Onglets/filtres avec indicateur qui glisse ; boutons (`value`/`onChange`) ou liens (`href`) ; `variant="pill"` ; compteurs | `<Tabs label="Filtrer" items={[{ id: 'all', label: 'Toutes', count: 12 }, { id: 'ko', label: 'Fausses', count: 2 }]}`<br>`  value={v} onChange={setV} idBase="faits" />`<br>`<div role="tabpanel" id="faits-panel" className="ui-tabpanel" key={v}>…</div>` |
| `EmptyState` (serveur) | Liste vide : une phrase + l'action suivante | `<EmptyState title="Aucune erreur" icon={<Icon name="shield" />}`<br>`  action={<Link className="ui-btn" href="/app/questions">Ajouter une question</Link>}>`<br>`Les IA disent juste sur vos 12 faits.</EmptyState>` |
| `Skeleton`, `SkeletonCard` (serveur) | `loading.tsx` et attentes : jamais d'écran blanc | `<Skeleton variant="figure" />` · `<Skeleton lines={3} />` · `<SkeletonCard />` |
| `ActionButton` (client) | « C'est fait », « Copier », « Enregistrer » : pression, roue, puis coche qui se dessine + toast | `<ActionButton onAction={() => save()} doneLabel="Fait"`<br>`  toastText="Tâche marquée comme faite.">C’est fait</ActionButton>` |
| Classe `.ui-btn` | Bouton/lien simple sans état : `data-variant="primary|ghost"`, `data-size="sm|lg"` | `<Link className="ui-btn" data-variant="primary" href="…">Corriger en 15 min</Link>` |
| `toast` (`@/components/ui/toast`) | Confirmation ou erreur après une action (le Toaster est dans la coquille de l'app) | `toast({ text: 'Fiche enregistrée.', tone: 'success' })` |
| `Disclosure` (serveur, `<details>`) | Détails, méthodes, « Expliquer ce changement » : divulgation progressive ; hauteur animée | `<Disclosure title="Expliquer ce changement" summary={explain.headline} icon={<Icon name="info" />}>`<br>`  …`<br>`</Disclosure>` |
| `ProgressBar`, `Gauge` (serveur) | Avancement (tâches faites, couverture) ; jauge circulaire (score) ; se remplissent à l'affichage | `<ProgressBar value={1} max={3} label="1 tâche sur 3 faite" tone="up" />`<br>`<Gauge value={61} label="Score 61 sur 100"><b>61</b></Gauge>` |
| Classes `.ui-live` + `.ui-live-bar` | Indicateur « mesure en cours » vivant | `<span className="ui-live"><span className="ui-live-bar" />Mesure en cours</span>` |

## 3. Primitives d'animation (`src/components/motion`)

| Primitive | Quand | Exemple |
|---|---|---|
| `Cascade` (serveur, CSS) / classe `.ui-cascade` | Apparition en cascade des enfants directs (70 ms) — marche en navigation client, sans MotionRoot. UNE fois par écran (grille principale) | `<Cascade className="grid gap-4">`<br>`  <Surface/> <Surface/> <Surface/>`<br>`</Cascade>` |
| `.ui-enter` + `style={{'--i': n}}` | Un élément isolé qui entre (rang n) | `<div className="ui-enter" style={{ ['--i' as string]: 2 }}>…</div>` |
| `Counter` | Chiffre qui monte à l'entrée à l'écran ; valeur finale dans le HTML | `<Counter value={61} />` · `<Counter value={14} suffix=" %" />` |
| `ChartDraw` | Grande courbe qui se trace (+ repère « travail fait ») | `<ChartDraw values={history} marker={3} label="…" />` |
| `GaugeMorph` | Jauge de scène (site) | dans un ScenePlayer |
| `useInView(threshold)` | Hook : vrai une fois visible ; pour vos propres tracés | `const [ref, seen] = useInView<HTMLDivElement>();`<br>`<div ref={ref} data-draw={seen ? '' : undefined}>` |
| `Tabs` (ci-dessus) | Transition d'onglet : indicateur qui glisse + `.ui-tabpanel` (fondu du contenu, rejoué via `key`) | |
| `motionAllowed(kind)` | Décider en JS si une animation joue (règle § 0) | `if (motionAllowed('translate')) el.animate(…)` |
| `Reveal` + `MotionRoot` | Site uniquement (pages longues, au défilement) | inchangé |

Toutes : état final rendu côté serveur ; durées 150–400 ms (tracés 700–900 ms) ; transform/opacity uniquement.

## 4. Coquille de l'app (SYSTEME)

- Transition de page douce : `src/app/app/template.tsx` (fondu + 6 px, 260 ms) — rien à faire de votre côté.
- `<PageHeader>` accepte en plus `result`, `resultTone`, `subtitle`, `primary`, `secondary` (rend `PageIntro` sous le H1).
  Le H1 reste le nom de l'écran (SEO/repères) ; le titre-résultat est la ligne la plus grande de la page.
- Écrans de l'app : l'en-tête-résultat standard est `Verdict` (APP-ECRANS, `components/app/v4/Verdict.tsx`) ; `PageIntro`
  joue le même rôle ailleurs. Ne mettez pas les deux sur un même écran.
- Menu : la boucle Mesurer → Comprendre → Agir → Prouver est numérotée ; le numéro du groupe actif passe en ambre ;
  indicateur actif qui glisse (barre ambre). Compteurs : erreurs (rouge clair), à faire (ambre doux).
- `v4.css` (APP-ECRANS) est chargé par le layout de l'app : plus besoin de l'importer par page.
- Accueil « Lundi » (`src/app/app/page.tsx`) = exemple de référence : bloc héros (`data-elevation="hero"`), phrase +
  UN bouton, `KeyFigure size="xl"` avec variation et mini-courbe, puis `Surface` en grille dans une `Cascade`.
- Les classes `.rp-panel`, `.rp-btn`, `.rp-chip` existantes restent valides (rayons, ombres et pression alignés) ; préférez `Surface`, `.ui-btn`,
  `StatusBadge` pour le nouveau code.
