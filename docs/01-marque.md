# 01 — Marque et identité visuelle

Auteur : agent MARQUE. Date : 2026-11-09. Langue : français.

## 1. Noms candidats

Méthode : recherche web (France, domaines marketing / IA / visibilité IA). La recherche est superficielle : elle n'écarte que les conflits visibles. Avant tout dépôt, faire une recherche d'antériorité à l'INPI (classes 9, 35, 42) et vérifier les domaines chez un registrar. **Je ne peux pas vérifier la disponibilité des domaines ; ceux ci-dessous sont seulement plausibles.**

| Nom | Résultat de la recherche | Domaines plausibles (non vérifiés) |
|---|---|---|
| **Repéré** | Aucune entreprise marketing/IA du même nom trouvée (mot courant, donc peu protégeable seul). | repere.fr (probablement pris), reperefr.com, repere-ia.fr |
| **Lueur** | Aucun produit du même nom trouvé. Voisin éloigné : « L.U.K.E » (KLH, mesure de visibilité IA). | lueur.fr (probablement pris), lueur-ia.fr |
| **Nommé** | Aucun conflit trouvé. Mot courant, difficile à référencer. | nomme.fr (probablement pris), nomme-ia.fr |
| **Citia** | Aucune entreprise exacte trouvée, mais le champ « Cite AI / Cited / Citable / Citeme » est saturé : risque de confusion élevé. | citia.fr, citia.ai |
| **Boussole** | Aucun produit de visibilité IA trouvé, mais nom très courant (« La Boussole des entrepreneurs », etc.). | boussole-ia.fr |

Noms écartés après recherche (conflit réel) :
- **Mentio** : « Mentio – LLM GEO analyzer » existe déjà (Product Hunt, Crunchbase).
- **Sillage** : start-up parisienne d'IA pour les équipes commerciales, financée.
- **Vitrio** : société existante (vitrio.com.br, CB Insights).
- **Cité-moi / Citée** : trop proche de Citeme, Cited, Cite AI.
- Concurrent direct à connaître : « Coucou IA » (vérifie si ChatGPT recommande une marque).

## 2. Nom retenu : **Repéré**

Descripteur à toujours afficher à côté : « Repéré — visibilité IA des commerces locaux ».

Pourquoi :
- La promesse se comprend sans explication : « Soyez repéré par ChatGPT ». Un artisan n'a pas besoin du mot « GEO ».
- Court (6 lettres), français, se prononce et se retient facilement, se dit au téléphone.
- Il décrit le résultat (être trouvé), pas l'outil. « AuditIA Local » décrit l'outil, se confond avec les audits de systèmes d'IA (conformité) et n'est pas protégeable.
- Il fonctionne avec la jauge (« Invisible » → « Repéré ») et avec le logo (cadre de visée).

Limites, à connaître : mot courant donc faible en SEO de marque (compenser par le descripteur) ; accent dans le nom, donc domaine sans accent (repere) ; domaine .fr probablement déjà pris. Si le domaine est introuvable, garder « AuditIA Local » comme nom de travail jusqu'à trouver une variante acceptable (ex. repere-ia.fr).

## 3. Identité visuelle

### 3.1 Palette (6 rôles, contrastes WCAG calculés)

| Rôle | Hex | Usage | Contraste |
|---|---|---|---|
| Primaire | `#3730A3` | Boutons, liens, titres forts, logo | 9,9:1 sur blanc : AA et AAA |
| Accent | `#F5A524` | Point du logo, surlignage, puces. Jamais en texte. | Texte `#1B1F2E` dessus : 8,0:1. Sur blanc 2,0:1, donc fond uniquement. |
| Succès | `#15803D` | Score 70–100 | 5,0:1 sur blanc, AA |
| Alerte | `#B45309` | Score 40–69 | 5,0:1 sur blanc, AA |
| Danger | `#B91C1C` | Score 0–39, erreurs | 6,5:1 sur blanc, AA |
| Neutres | `#1B1F2E` texte, `#5A6275` texte secondaire, `#D5D9E4` bordures, `#F6F7FB` fond | | Texte 16,4:1 ; secondaire 6,1:1 sur blanc (5,7:1 sur le fond) |

Fonds teintés pour badges : succès `#E7F5EC` avec texte `#166534` (6,3:1), alerte `#FDF1E3` avec `#92400E` (6,4:1), danger `#FCEAEA` avec `#991B1B` (7,2:1), primaire `#ECEBFA` avec `#3730A3` (8,4:1). Ne pas mettre `#15803D` sur `#E7F5EC` (4,5 non atteint de justesse : 4,46).
Les contrastes ont été calculés avec la formule WCAG 2.x. Ne jamais porter l'information par la couleur seule : toujours un libellé ou une icône.

```css
:root {
  --primary: #3730A3;  --accent: #F5A524;
  --success: #15803D;  --warning: #B45309;  --danger: #B91C1C;
  --ink: #1B1F2E;  --muted: #5A6275;  --line: #D5D9E4;  --bg: #F6F7FB;
  --success-bg: #E7F5EC; --success-ink: #166534;
  --warning-bg: #FDF1E3; --warning-ink: #92400E;
  --danger-bg:  #FCEAEA; --danger-ink:  #991B1B;
  --primary-bg: #ECEBFA;
}
```

### 3.2 Polices (Google Fonts)
- Titres : **Bricolage Grotesque** (600, 700). Caractère, lisible, peu vue chez les concurrents.
- Texte : **Inter** (400, 500, 600). Très lisible sur mobile, chiffres tabulaires pour les scores.

```html
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
```
Dans Next.js : `next/font/google` avec les mêmes polices. Corps 16 px minimum, interligne 1,6.

### 3.3 Ton de voix : 5 règles
1. **Parler comme un voisin compétent.** Tutoiement exclu, vouvoiement chaleureux, phrases courtes.
   - Oui : « ChatGPT ne cite pas votre salon. Voici pourquoi. »
   - Non : « Votre empreinte sémantique est sous-optimale. »
2. **Zéro jargon, ou expliqué en une phrase.** « GEO » devient « être recommandé par les assistants IA ».
   - Oui : « Quand on demande à ChatGPT un bon plombier à Paris 11e, il cite d'autres noms que le vôtre. »
3. **Un chiffre, puis une action.** Toujours un fait mesuré, puis ce qu'on peut faire.
   - Oui : « Cité 2 fois sur 12 réponses. Ajoutez vos horaires et vos avis : c'est ce que les IA lisent en premier. »
4. **Honnête sur l'incertitude.** Les IA varient d'une réponse à l'autre ; ne jamais promettre un rang.
   - Oui : « Score estimé sur 12 réponses. Confiance : moyenne. »
   - Non : « Garanti : numéro 1 sur ChatGPT ! »
5. **Encourager sans culpabiliser, jamais d'alarmisme.** Un mauvais score est un point de départ.
   - Oui : « Vous partez de loin, c'est normal : la plupart des commerces sont invisibles. »
   - Non : « Vos concurrents vous écrasent. »

### 3.4 Slogan
- Principal : **« Soyez celui que l'IA recommande. »**
- Variantes :
  1. « Vos clients demandent à l'IA. Soyez repéré. »
  2. « Mesurez si ChatGPT parle de vous. »
  3. « Votre commerce, enfin visible pour l'IA. »

### 3.5 Logo
Concept : un cadre de visée (quatre angles blancs) sur fond indigo, avec un point ambre au centre : le commerce « repéré » parmi les autres. Fonctionne en favicon et icône PWA (maskable : ajouter une marge de sécurité de 10 %). Zone de protection : un quart de la largeur autour. Taille minimale 24 px. Version monochrome : tout en blanc sur primaire, ou tout en primaire sur blanc.
Le même SVG est dans `docs/logo.svg`. Lockup : logo + « Repéré » en Bricolage Grotesque 700, couleur `#1B1F2E`.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="Repéré">
  <title>Repéré</title>
  <rect width="64" height="64" rx="14" fill="#3730A3"/>
  <g fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17 26V19a2 2 0 0 1 2-2h7"/>
    <path d="M38 17h7a2 2 0 0 1 2 2v7"/>
    <path d="M47 38v7a2 2 0 0 1-2 2h-7"/>
    <path d="M26 47h-7a2 2 0 0 1-2-2v-7"/>
  </g>
  <circle cx="32" cy="32" r="7" fill="#F5A524"/>
</svg>
```

### 3.6 Jauge de score

| Tranche | Libellé | Couleur (fond de jauge) | Texte/badge | Message court |
|---|---|---|---|---|
| 0–39 | **Invisible** | `#B91C1C` | `#991B1B` sur `#FCEAEA` | « Les IA ne vous citent presque jamais. » |
| 40–69 | **Peu visible** | `#B45309` | `#92400E` sur `#FDF1E3` | « Vous apparaissez parfois, mais d'autres passent avant vous. » |
| 70–100 | **Bien recommandé** | `#15803D` | `#166534` sur `#E7F5EC` | « Les IA vous recommandent régulièrement. » |

Sous-libellés optionnels : 0–14 « Invisible », 15–39 « Quasi absent » (même rouge) ; 70–89 « Bien recommandé », 90–100 « Incontournable » (même vert).

```ts
export const SCORE_BANDS = [
  { min: 0,  max: 39,  label: 'Invisible',        color: '#B91C1C', bg: '#FCEAEA', ink: '#991B1B' },
  { min: 40, max: 69,  label: 'Peu visible',      color: '#B45309', bg: '#FDF1E3', ink: '#92400E' },
  { min: 70, max: 100, label: 'Bien recommandé',  color: '#15803D', bg: '#E7F5EC', ink: '#166534' },
] as const;
export const bandFor = (s: number) => SCORE_BANDS.find(b => s >= b.min && s <= b.max)!;
```
Afficher toujours le nombre, le libellé et la couleur (pas la couleur seule). La piste de la jauge est `#D5D9E4`.
