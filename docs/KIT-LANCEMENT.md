# Kit de lancement Repéré

Synthèse des docs 00 à 13 et des README de `app/` (9 novembre 2026). À suivre dans l'ordre. **[À VÉRIFIER]** = source secondaire ou non testé.

---

## 1. Repéré en une page

**Promesse.** « Soyez celui que l'IA recommande. » En 2 minutes, un commerçant sait si ChatGPT, Perplexity et Gemini le recommandent, qui est cité à sa place et quoi faire.

**Cible.** TPE locales parisiennes dont un client gagné vaut cher : plombiers, déménageurs, agences immobilières indépendantes. Les métiers réglementés (santé, avocats, notaires, experts-comptables, architectes) sont exclus.

**Pourquoi maintenant.** À Paris, 43 % des habitants utilisent la recherche conversationnelle, contre 24 % ailleurs (Eskimoz × Ipsos, 2026). Aucune étude ne chiffre la recherche de commerces via l'IA : n'avancez aucun chiffre là-dessus.

**Offre (prix HT)**

| Offre | Prix | Rôle |
|---|---|---|
| Audit gratuit | 0 € | Aimant à leads. Score /100, concurrents cités, PDF |
| Plan d'action | 149 € une fois | 10 à 15 actions classées, livrées en PDF sous 48 h |
| **Démarrage** (mis en avant) | **199 € une fois** | Plan + 3 mois de suivi, puis 29 €/mois |
| Suivi | 29 €/mois ou 290 €/an | Ré-audit mensuel, évolution, alertes, 3 concurrents |
| Pro | 79 €/mois ou 790 €/an | Jusqu'à 5 établissements (à partir du mois 3 ou 4) |
| Agence | 149 €/mois ou 1 490 €/an | 20 clients, marque blanche (à partir du mois 4 à 6) |

Offre de lancement unique : les 10 premiers clients paient le plan d'action 99 € (coupon Stripe `launch99`) en échange d'un témoignage. Aucune autre remise.

**Positionnement face aux concurrents**

| | Repéré | BrightLocal / Local Falcon | Outils FR (Meteoria, Qwairy, GetMint, Hikoo…) | Freelances (ComeUp, Fiverr) | Agences GEO |
|---|---|---|---|---|---|
| Prix d'entrée | 0 €, puis 29 €/mois | 25 à 41 $/mois | 69 à 100 €/mois | 50 à 236 $ une fois | 1 500 à 3 000 € l'audit |
| Pensé pour le local | Oui | Oui | Non vérifié | Non | Variable |
| En français | Oui | Non | Oui | Variable | Oui |
| Résultat sans configuration | Oui (nom, métier, ville) | Non | Non (prompts à saisir) | Délai de 3 à 5 jours | Sur devis |
| Suivi mensuel | Oui | Oui | Oui | Non | Oui, cher |
| Fourchette et indice de confiance affichés | **Oui** | Non | Non | Non | Non |

En une phrase : l'outil pensé pour un patron de commerce français, qui répond à ses trois questions : « Suis-je cité ? Qui l'est à ma place ? Que faire ? ». Revérifiez les prix des concurrents avant de les citer publiquement (sources en partie tierces).

---

## 2. Ce qui est déjà construit

Code : `app/` (Next.js 15, TypeScript, Tailwind, Supabase, Stripe, Resend). **Tout tourne sans aucune clé**, en mode démo : les IA sont simulées, les données sont écrites dans `.data/*.json`, les e-mails s'affichent dans la console et le paiement redirige vers `/merci?demo=1`. Chaque service s'active dès que sa variable d'environnement est renseignée. Lancement local : `npm install`, `cp .env.example .env.local`, puis `npm run dev`.

| Brique | Ce qu'elle fait | Sans clés (démo) |
|---|---|---|
| **Site** | Landing, `/tarifs`, `/audit`, `/rapport/[id]`, `/methode`, pages légales, pages SEO `/visibilite-ia/[metier]/[ville]` (en `noindex` tant qu'elles n'ont pas de données propres), `llms.txt` | Tout s'affiche, avec « Plomberie Martin » comme exemple |
| **Moteur** | 8 requêtes × 2 exécutions × 3 IA, soit 48 réponses : mentions, concurrents, score, fourchette, confiance. Plafond de 0,60 € par audit gratuit. Suivi payant : 12 requêtes × 3 exécutions, Claude en 4ᵉ IA | Une IA sans clé devient un mock étiqueté « Démo », et la confiance passe à « faible » |
| **Rapport et PDF** | Page rapport et PDF A4 de 3 pages. Le plan d'action complet est servi par `/api/report/[id]/plan` | PDF générés sur données démo |
| **App PWA** (`/app`) | Espace abonné installable : score, évolution, détail par IA, concurrents, requêtes, plan à cocher, historique. Connexion par lien magique | Commerce `demo` ouvert à tous, avec 6 mois d'historique |
| **Paiement** | Stripe Checkout + webhook. Le commerce est rattaché au compte à la première connexion avec l'e-mail d'achat | Redirection vers `/merci?demo=1` |
| **E-mails** | Rapport avec PDF, alerte mensuelle (seuil de 5 points), confirmation d'achat, paiement échoué. Désinscription en un clic | Affichés dans la console |
| **Cron** | Chaque jour à 08:17 UTC, ré-audite les abonnés dont le dernier audit date de plus de 28 jours | Appel libre en local |
| **Admin** (`/admin?token=…`) | Leads, audits, export CSV, entonnoir | Lit les CSV de `.data/` : **à utiliser en local** |
| **Scripts** (`app/scripts`) | `build-leads` (Sirene, Places en option) → `batch-audit` → saisie manuelle des e-mails publiés → `write-emails` (brouillons). **Aucun script n'envoie rien** | Sans clés, audits mock : ne jamais les envoyer à un prospect |

**Ce qui reste manuel ou manquant** (à connaître avant de vendre) :
- **Livraison du plan d'action** : l'e-mail d'achat annonce « sous 48 h », mais rien n'envoie le PDF automatiquement. Générez le lien vous-même : `node -e "console.log(require('crypto').createHmac('sha256',process.env.AUDIT_SIGNING_SECRET).update('ID_AUDIT').digest('hex'))"`, puis ouvrez `/api/report/ID_AUDIT/plan?token=…`. Relisez le PDF et envoyez-le.
- **Relances J+1, J+3, J+7** après un audit gratuit : rédigées dans `docs/08-copy.md` §4, mais pas automatisées. Envoyez-les à la main au début.
- **Notifications push** : non branchées. L'e-mail mensuel fait le travail.
- **Refus des métiers réglementés** : le formulaire d'audit les accepte encore, et le dictionnaire du moteur contient dentiste et avocat. Refusez-les à la main en attendant la V1.1.
- `AUDIT_SIGNING_SECRET` est **absent de `.env.example`**, mais il est obligatoire en production.

---

## 3. Mise en ligne en 2 heures

Ordre conseillé : Vercel d'abord (pour obtenir l'URL), puis les services, puis le redéploiement. Détails clic par clic : `app/README.md` §2.

| # | Étape | Durée | Coût |
|---|---|---|---|
| 1 | **Domaine.** Achetez `repere-ia.fr` (ou une variante : `repere.fr` est probablement pris) chez un registrar. Achetez aussi un **second domaine pour la prospection**. Faites d'abord une recherche d'antériorité INPI sur « Repéré » (classes 9, 35, 42) | 15 min | ≈ 8 à 12 €/an chacun |
| 2 | **Vercel.** Poussez `app/` sur GitHub, puis sur vercel.com : Add New → Project (Root Directory = `app`) → Deploy. Le site tourne en démo. Ajoutez le domaine dans Settings → Domains et vérifiez que Fluid compute est activé | 15 min | 0 € en Hobby. **Passez en Pro (20 $/mois) avant d'activer Stripe en mode Live** : le plan Hobby est réservé à un usage non commercial |
| 3 | **Supabase.** New project, région Europe (Paris ou Francfort). Dans SQL Editor, collez `supabase/schema.sql` puis Run. Copiez Project URL, la clé `service_role` (secrète) et la clé `anon`. Dans Auth → URL Configuration, renseignez Site URL et Redirect URLs `https://votre-domaine/**`. Facultatif : activez `pg_cron` pour lancer `purge_old_data()` (purges RGPD) | 20 min | 0 € (le projet se met en pause après 7 jours sans activité) |
| 4 | **Stripe.** Commencez en mode Test. Créez les produits ci-dessous en EUR HT, avec la metadata `plan_id`. Activez le portail client (résiliation, carte, factures) et renseignez l'URL `/cgv`. Créez le webhook `https://votre-domaine/api/stripe/webhook` avec les événements `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created/updated/deleted`, `invoice.payment_failed` et `charge.dispute.created`. Créez le coupon `launch99` (100 € de remise, 10 utilisations). Testez avec la carte 4242 4242 4242 4242, puis refaites tout en mode Live | 30 min | 0 € fixe, ≈ 1,5 % + 0,25 € par paiement |
| 5 | **Resend.** Domains → Add `hello.votre-domaine`, ajoutez SPF, DKIM et DMARC, attendez le statut « Verified », puis créez une clé API. Branchez aussi Resend comme SMTP de Supabase (Auth → SMTP), sinon les liens magiques sont limités à quelques envois par heure | 15 min | 0 € (3 000 e-mails/mois, 100/jour) |
| 6 | **Clés IA** (voir le tableau ci-dessous). Fixez un **plafond mensuel chez chaque fournisseur** | 15 min | 20 à 25 € de crédit au total |
| 7 | **Variables d'environnement** dans Vercel (liste ci-dessous), puis Redeploy | 10 min | 0 € |
| 8 | **Test final** (ci-dessous) | 10 min | Quelques centimes d'API |

**Produits Stripe à créer**

| Variable Vercel | Produit | Prix |
|---|---|---|
| `STRIPE_PRICE_ACTION_PLAN` | Plan d'action | 149 €, paiement unique |
| `STRIPE_PRICE_BUNDLE_START` | Démarrage | 199 €, paiement unique (le checkout ouvre le Suivi avec 90 jours d'essai, donc `SUIVI_MONTH` est obligatoire) |
| `STRIPE_PRICE_SUIVI_MONTH` / `_SUIVI_YEAR` | Suivi | 29 €/mois et 290 €/an |
| `STRIPE_PRICE_PRO_MONTH` / `_PRO_YEAR` | Pro | 79 €/mois et 790 €/an (vous pouvez attendre le mois 3) |
| `STRIPE_PRICE_AGENCY_MONTH` / `_AGENCY_YEAR` | Agence | 149 €/mois et 1 490 €/an (vous pouvez attendre le mois 4) |

**Clés IA**

| Variable | Où l'obtenir | Budget de départ |
|---|---|---|
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys), crédit prépayé dans Billing, plafond dans Limits | 10 $ |
| `PERPLEXITY_API_KEY` | [perplexity.ai](https://www.perplexity.ai) → Settings → API | 5 $ |
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) → Get API key. L'ancrage Google Search exige une facturation activée (5 000 recherches gratuites par mois) | 0 à 5 $ |
| `ANTHROPIC_API_KEY` (facultatif, 4ᵉ IA du suivi payant) | [console.anthropic.com](https://console.anthropic.com) → API keys | 5 $ quand vous aurez des abonnés |

**Important pour Gemini : réglez `GEMINI_GROUNDING=off` au lancement.** Les conditions de Gemini interdisent d'« analyser » et de « revendre » les résultats ancrés sur Google Search (`docs/04-api-ia.md` §5). Sans ancrage, vous mesurez ce que le modèle « sait », ce qui est moins réaliste mais conforme. Autre option : remplacer Gemini par Claude avec `AUDIT_PROVIDERS=chatgpt,perplexity,claude`.

**Variables d'environnement** : `NEXT_PUBLIC_APP_URL` (sans slash final), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, les 8 `STRIPE_PRICE_*`, `STRIPE_TAX_RATE_ID` (à laisser vide en franchise de TVA), `NEXT_PUBLIC_STRIPE_PORTAL_URL`, `RESEND_API_KEY`, `EMAIL_FROM="Repéré <rapport@hello.votre-domaine>"`, `EMAIL_REPLY_TO`, `LEGAL_NAME`, `LEGAL_ADDRESS`, `LEGAL_SIREN`, les 3 ou 4 clés IA, `GEMINI_GROUNDING=off`. Générez les secrets suivants avec `openssl rand -hex 32` : `CRON_SECRET`, `UNSUBSCRIBE_SECRET`, `RATE_LIMIT_SALT`, `ADMIN_TOKEN` et **`AUDIT_SIGNING_SECRET`**. Facultatif : `AUDIT_RATE_LIMIT_PER_DAY=3` pour économiser l'API.

**Cron.** Rien à faire : `vercel.json` le déclare déjà. Vercel envoie `CRON_SECRET` automatiquement. Test manuel : `curl -H "Authorization: Bearer $CRON_SECRET" https://votre-domaine/api/cron/monthly` doit renvoyer `processed`.

**Test final, dans l'ordre**
1. Un audit avec votre e-mail : pas de badge « démo », l'e-mail arrive avec son PDF.
2. Un paiement test mène à `/merci`, met à jour `businesses.plan` et crée une ligne dans `subscriptions`.
3. Le lien magique ouvre `/app` avec le commerce.
4. « Se désinscrire » ajoute une ligne dans `suppression`.
5. Le cron répond, et l'audit a coûté 0,30 à 0,60 € chez les fournisseurs.

**Coût mensuel au démarrage** : domaines ≈ 2 €, Vercel Pro ≈ 19 €, API 15 à 25 € (environ 50 audits). **Total : 35 à 45 €.** La boîte mail de prospection (≈ 6 €/mois chez Workspace, ou Zoho gratuit) s'ajoute si vous en prenez une.

---

## 4. Méthode de score (à réutiliser face à un client qui conteste)

**Version en 30 secondes, à dire au client :**
> « Nous posons à ChatGPT, Perplexity et Gemini 8 questions que vos clients posent vraiment : "meilleur plombier Paris 11e", "plombier urgent ce soir", "plombier avec de bons avis"… Votre nom n'apparaît jamais dans la question. Chaque question est posée deux fois à chaque IA, ce qui fait 48 réponses. Nous comptons combien de fois vous êtes cité, à quelle place, combien de place vous occupez face aux concurrents, et sur combien d'IA vous apparaissez. »

**La formule**, publiée sur `/methode` :

| Composante | Ce qu'elle mesure | Poids |
|---|---|---|
| Mention | Part des 48 réponses qui vous citent | 45 % |
| Rang | Votre place dans la liste quand vous êtes cité (1er = maximum, 6e ou au-delà = 0) | 20 % |
| Part de voix | Vos citations face à celles des concurrents (un quart des citations = note maximale) | 20 % |
| Couverture | Nombre d'IA qui vous citent au moins 2 fois sur 16 | 15 % |

Lecture : 0 à 39 Invisible, 40 à 69 Peu visible, 70 à 100 Bien recommandé.

**Réponses aux contestations**

| Le client dit | Vous répondez |
|---|---|
| « J'ai demandé à ChatGPT, il m'a cité ! » | « C'est possible : une IA ne répond jamais deux fois la même chose. Une étude SparkToro sur près de 3 000 essais montre que la même liste revient moins d'une fois sur cent. C'est pour cela que nous mesurons une fréquence sur 48 réponses, pas une réponse isolée. Vous étiez cité dans X réponses sur 48 : tout est dans le rapport, question par question. » |
| « Votre score est faux » | « Il est donné avec une fourchette (par exemple 35 à 49) et un indice de confiance. Chaque réponse est consultable, avec la date, l'IA et le modèle. Vous pouvez reposer les mêmes questions vous-même. » |
| « ChatGPT sur mon téléphone répond autre chose » | « Nous passons par l'API officielle de chaque IA, sans historique ni personnalisation. Votre application tient compte de votre historique et de votre position exacte. Nous mesurons ce que voit un nouveau client, pas vous. » |
| « Retirez mon nom / mon concurrent » | Lien « Contester ou supprimer cet audit » : réponse sous 72 h (le maximum légal est de 30 jours). Un concurrent cité qui demande son retrait est retiré des rapports futurs. |

Ne dites jamais : « ChatGPT ne vous recommande pas » (dites plutôt : « dans nos 48 mesures du [date] »), ni « nous vous ferons passer premier ».

---

## 5. Les 3 métiers à attaquer d'abord

La matrice de `docs/12-verticales.md` note 15 métiers sur 5 critères. Ordre de lancement conseillé : plombier, puis déménageur, puis agence immobilière.

| Ordre | Métier (code NAF) | Argument massue | Réserve |
|---|---|---|---|
| 1 | **Plombier-chauffagiste** (43.22A) | « Une seule urgence gagnée paie plusieurs mois de suivi, un chantier de salle de bain paie des années. PagesJaunes a lancé son app dans ChatGPT en citant justement les plombiers d'urgence. » | Les prix de la plomberie ne sont pas sourcés. Relevez 10 tarifs affichés par des plombiers parisiens avant de citer un chiffre |
| 2 | **Déménageur** (49.42Z) | « Un déménagement gagné rapporte 350 à 1 500 €. Un seul client paie votre première année (497 € : plan d'action plus 12 mois de suivi). » | Saisonnier : prospectez d'avril à juin |
| 3 | **Agence immobilière indépendante** (68.31Z) | « Une vente rapporte environ 24 000 € d'honoraires sur un bien à 450 000 €. Un mandat de plus rembourse dix ans de suivi. » Parlez de chiffre d'affaires, jamais de bénéfice | Cycle de vente plus lent. Ciblez les indépendants de quartier, pas les réseaux |

Ensuite : rénovation, puis serruriers (avec une charte, vu la réputation du métier). Restaurants et coiffeurs : un client gagné ne vaut qu'un repas ou une coupe, gardez-les pour le SEO et la presse.

---

## 6. Plan de 30 jours

**Routine quotidienne (60 minutes, de préférence du mardi au jeudi matin)**

| Minutes | Tâche |
|---|---|
| 0 à 10 | Prendre 10 commerces non contactés dans la liste |
| 10 à 25 | Lancer 10 audits réels, noter les 2 concurrents cités |
| 25 à 40 | Envoyer les e-mails n°1 (dans la limite du warm-up) |
| 40 à 50 | Envoyer les relances dues (e-mails 2 à 4) |
| 50 à 55 | Répondre aux messages, traiter les STOP (sous 24 h) |
| 55 à 60 | Mettre à jour le suivi et les indicateurs |

Une fois par semaine : un après-midi de porte-à-porte (14 h 30 à 17 h, 15 commerces d'une même rue) et, le vendredi, une heure de bilan des indicateurs.

| Semaine | À faire | Objectifs chiffrés |
|---|---|---|
| **S1 : fondations** | Micro-entreprise, compte dédié, RC Pro, devis d'avocat pour la relecture. Mise en ligne (§3). Achat du domaine de prospection et début du **warm-up** (5 à 10 mails par jour vers des adresses amies). `build-leads` sur 75011 pour les plombiers (43.22A). 10 audits sur des commerçants de votre entourage | Site en ligne, paiement Live testé, 200 leads, 10 audits réels, 10 retours qualitatifs |
| **S2 : terrain** | 2 après-midis de porte-à-porte sur les plombiers et commerces du 11e, avec le rapport ouvert sur le téléphone. Relecture juridique terminée. Rédaction de l'article pilier n°1 (« Comment apparaître dans ChatGPT quand on est un commerce local ») | 30 visites, 30 audits, 1 premier client à 99 € (coupon `launch99`) |
| **S3 : premiers e-mails** | Fin du warm-up vers J21 : 5 e-mails de prospection par jour. Porte-à-porte continu. Déménageurs (49.42Z) ajoutés à la liste | 25 e-mails, 15 visites, 2 clients cumulés, 1 témoignage |
| **S4 : cadence** | 10 e-mails par jour, A/B test sur l'objet (2 × 20 envois). Agences immobilières du 11e et du 20e. Bilan à J30 | 50 e-mails, 15 visites, **100 audits réels au total, 3 à 5 clients payants, 2 abonnés Suivi, ≈ 500 € encaissés** |

Seuils de décision à J30 :
- moins de 2 % de réponses aux e-mails : réécrivez l'objet et la première ligne ;
- plus de 0,1 % de plaintes pour spam ou plus de 3 % de rebonds : pause, puis audit du domaine ;
- moins de 1 vente pour 50 visites : changez de métier ou d'arrondissement ;
- coût mensuel supérieur à 50 € : passez `AUDIT_RATE_LIMIT_PER_DAY` à 2.

---

## 7. Séquence de prospection

> **Règles CNIL et juridiques, à respecter sans exception**
> - **Sources** : Sirene (API Recherche d'entreprises) et l'API Places officielle. Pas de scraping de Google Maps, d'annuaires ou de réseaux sociaux. De Google Places, ne stockez que le `place_id`.
> - **Adresses** : uniquement des adresses génériques ou professionnelles publiées par le commerce lui-même (mentions légales ou page contact de son site). Jamais d'adresse devinée. Conservez l'URL source et la date (`email_source_url`).
> - **Entrepreneurs individuels et adresses nominatives** : un seul message, sans relance (règle E8).
> - **Chaque e-mail** contient : votre identité, votre adresse postale et votre SIREN, la source de l'adresse, un lien de désinscription en un clic et la réponse STOP, ainsi qu'une mention RGPD. Pas de faux « Re: ».
> - **Opposition** traitée sous 24 h, inscrite dans la liste de suppression, vérifiée avant chaque envoi.
> - **4 messages au maximum** par prospect, puis arrêt.
> - **Envoi** depuis le domaine secondaire (SPF, DKIM, DMARC), 30 mails par jour au maximum, **jamais via Resend** ni depuis le domaine principal.
> - **Audit envoyé** : réel (jamais `demo`), privé, daté, factuel. Les concurrents sont présentés comme « cités par l'IA », sans aucun jugement. Aucune publication nominative.
> - **SMS et WhatsApp** : jamais en premier contact.
> - **Téléphone** : pas d'appel à froid en V1 sans validation par un avocat. Le régime du consentement préalable (11 août 2026) vise les consommateurs, et son application au B2B n'est pas tranchée **[À VÉRIFIER]**.

Variables : `{nom}`, `{metier}`, `{zone}`, `{score}`, `{A}`, `{B}`, `{date}`, `{lien}`, `{email}`. A et B viennent toujours du résultat réel du moteur.

**Pied de page commun à tous les e-mails (P)**
```
[Prénom NOM], Repéré — [adresse postale] — SIREN [000 000 000] — [e-mail]
Vous recevez ce message à titre professionnel : l'adresse {email} figure sur le site de {nom}
comme adresse de contact, et ce message concerne la visibilité de votre établissement sur les
assistants IA. Pour ne plus rien recevoir : répondez « STOP » ou cliquez ici : {lien_stop}.
Responsable du traitement : [nom], intérêt légitime, conservation 3 ans maximum. Vos droits : {lien_confidentialite}.
```

**E-mail 1 (J0). Objet : `{nom} : {score}/100 dans les assistants IA, {A} est cité à votre place`**
```
Bonjour,

Le {date}, j'ai posé à ChatGPT, Perplexity et Gemini (via leurs API officielles) les questions
qu'un client pose pour trouver un {metier} à {zone}, et j'ai regardé qui ils recommandent.

Score de {nom} : {score}/100.
Établissements cités le plus souvent : {A}, {B}.

Le rapport complet (questions posées, réponses obtenues) est ici, sans inscription : {lien}

Ce que cela veut dire : de plus en plus de clients demandent une adresse à une IA. Quand l'IA
ne vous cite pas, ils appellent quelqu'un d'autre.

Si cela vous parle, répondez à ce message : je vous envoie 3 actions concrètes pour remonter.

[Prénom]
(P)
```

**E-mail 2 (J+3). Objet : `{A} ressort avant vous : voici pourquoi`**
```
Bonjour,

Je reviens sur le rapport de {nom}. Une observation : {A} est cité notamment parce que
{raison concrète tirée du rapport, par exemple « sa fiche Google compte 120 avis et ses horaires sont à jour »}.

Votre rapport : {lien}
Une première action possible, sans rien payer : {action gratuite tirée du rapport}.

[Prénom]
(P)
```

**E-mail 3 (J+7). Objet : `Refaire le test dans un mois ?`**
```
Bonjour,

Les IA changent leurs réponses d'un mois à l'autre. Deux options pour {nom} :
- Plan d'action personnalisé (149 €, une fois) : les modifications à faire, dans l'ordre.
- Suivi mensuel (29 €/mois, sans engagement) : audit refait chaque mois, évolution du score
  et alerte si un concurrent vous dépasse.
Les deux ensemble : formule Démarrage, 199 €.

Détails : {lien_tarifs}

[Prénom]
(P)
```

**E-mail 4 (J+14). Objet : `Dernier message de ma part`**
```
Bonjour,

Je ne vous écrirai plus après celui-ci. Votre rapport reste disponible 30 jours : {lien}.
Si le sujet ne vous concerne pas, aucun problème : une réponse « non merci » me suffit
et je supprime votre adresse de mon fichier.

[Prénom]
(P)
```

**Script d'appel de 60 secondes.** À utiliser uniquement pour un appel de suivi (après un e-mail ou une visite, ou sur demande), vers le fixe professionnel publié, du lundi au vendredi entre 10 h et 13 h ou entre 14 h et 20 h, jamais en numéro masqué.
```
[0-10 s]  « Bonjour, [Prénom], de Repéré. Je suis bien chez {nom} ? Vous avez une minute ? »
[10-25 s] « Je vous ai envoyé l'audit de {nom} : quand on demande aux IA un {metier} à {zone},
           vous avez {score} sur 100, et ce sont {A} et {B} qui sont cités. »
[25-40 s] « Le rapport est gratuit. Vous l'avez reçu, ou je vous le renvoie à quelle adresse ? »
[40-55 s] « Pas le temps » → « Je vous le renvoie : 2 minutes de lecture. »
          « Pas intéressé » → « Pas de souci, je ne vous rappellerai pas. Bonne journée. » (noter l'opposition)
[55-60 s] « Merci, vous le recevez dans 5 minutes depuis [adresse]. Bonne journée ! »
```

**Porte-à-porte** (du mardi au jeudi, entre 14 h 30 et 17 h, uniquement dans un commerce ouvert au public). Préparez le rapport ouvert sur le téléphone, le QR code en plein écran et des cartes de visite avec QR code.
```
[Entrée]   « Bonjour, je ne vous retiens pas longtemps. Vous êtes le gérant ? »
[Accroche] « Je suis [Prénom]. J'ai demandé aux IA un {metier} à {zone}. Regardez qui elles recommandent. »
           (montrer {A}, {B}, puis {score}/100)
[Question] « Vous avez des clients qui demandent à l'IA plutôt qu'à Google ? »
[Offre]    « Le rapport est gratuit : scannez ce QR code, ou je vous l'envoie par e-mail. »
[Option]   « Pour remonter : un plan d'action à 149 €, ou un suivi à 29 € par mois. Aucune obligation. »
[Sortie]   Occupé : « Je repasse la semaine prochaine ? » Refus : « Merci, bonne journée. »
```
E-mail donné sur place : indiquez son usage et le droit d'opposition. Notez chaque visite dans l'heure.

**Entonnoir de référence** (hypothèses prudentes, à remplacer par vos mesures) : 600 e-mails → 65 rapports consultés → 22 réponses → 9 positives → 3 à 4 plans d'action vendus et 2 à 3 abonnés. Terrain : 15 visites → 6 conversations utiles → 0,3 vente.

---

## 8. Projections

**Hypothèses** (`docs/07-offre-prix.md` §8, mois 1 = lancement)

| Hypothèse | Prudent | Base |
|---|---|---|
| Audits gratuits par mois (du mois 1 au mois 12) | 40 → 340 | 60 → 700 |
| Audit → Plan d'action seul | 1,5 % | 2 % |
| Audit → Suivi direct | 1,5 % | 2 % |
| Audit → Démarrage | 0,4 % | 0,6 % |
| Plan d'action → Suivi | 30 % | 40 % |
| Churn mensuel du Suivi | 10 % | 8 % |
| Pro et Agence | 0 | 0,2 % des audits à partir du mois 4 ; 4 agences au mois 12 |

**Résultats (HT, avant frais Stripe et API)**

| Scénario | Mois | Abonnés | MRR | CA du mois | CA cumulé |
|---|---|---|---|---|---|
| **Prudent** | 3 | 4 | 110 € | 414 € | 830 € |
| **Prudent** | 6 | 12 | 416 € | 992 € | 3 196 € |
| **Prudent** | 12 | 36 | 1 327 € | 2 358 € | 13 957 € |
| Base | 3 | 9 | 261 € | 971 € | 1 863 € |
| Base | 6 | 31 | 1 180 € | 2 640 € | 8 021 € |
| Base | 12 | 105 (+ 7 Pro, 4 agences) | 4 219 € | 7 141 € | 39 380 € |

**Coûts à déduire.** Un audit gratuit coûte 0,30 à 0,60 € et un audit de suivi environ 1,40 à 2,10 €. Pour le scénario prudent au mois 12 (340 audits gratuits et 36 abonnés), comptez ≈ 150 à 280 € d'API, ≈ 20 € de Vercel et ≈ 60 € de frais Stripe : la marge reste supérieure à 80 %.

**Lecture honnête**
- Les 3 premiers mois, l'argent vient des ventes uniques, pas de l'abonnement.
- L'hypothèse la plus fragile est le **volume d'audits** (prospection, puis SEO à partir du mois 3 à 6), pas le prix.
- Le scénario prudent ne fait pas vivre un fondateur à 12 mois. Faites le point à 100 audits (taux audit → paiement) et à 50 abonnés (test à 39 €). Le levier le plus fort : les agences (lien partenaire à 30 % de commission dès le mois 3).
- Franchise de TVA jusqu'à 37 500 € de CA, soit environ 108 abonnés sur une année : anticipez la TVA à 20 %.

---

## 9. Juridique avant le premier euro

Rien de ce qui suit n'est un avis juridique. Prévoyez 1 à 2 heures d'avocat (CGV, prospection).

- [ ] Micro-entreprise déclarée sur le guichet unique (SIREN), avec franchise de TVA : factures marquées « TVA non applicable, art. 293 B du CGI » et `STRIPE_TAX_RATE_ID` laissé vide
- [ ] Compte bancaire dédié et assurance RC Pro
- [ ] Recherche d'antériorité INPI sur « Repéré » ; dépôt de marque si possible
- [ ] Pages `/mentions-legales`, `/cgv` et `/confidentialite` complétées (champs entre crochets) et **relues par un avocat**
- [ ] Case CGV non pré-cochée au paiement, avec preuve d'acceptation (date, version)
- [ ] Renouvellement automatique de la formule Démarrage clairement affiché, résiliation en un clic testée dans le portail Stripe
- [ ] Avertissement « Méthode et limites » présent sur chaque rapport, web et PDF ; aucune garantie de résultat ; obligation de moyens uniquement
- [ ] Aucun faux témoignage ni faux chiffre ; données démo étiquetées « démo »
- [ ] Prospection : liste de suppression active, lien STOP testé, domaine secondaire configuré (SPF, DKIM, DMARC), règle E8 appliquée
- [ ] Registre des traitements et analyse d'intérêt légitime (1 page chacun)
- [ ] Accords de traitement des données (DPA) acceptés chez Vercel, Supabase (région UE), Stripe, Resend, OpenAI, Perplexity, Google et Anthropic
- [ ] Purges RGPD programmées : audits gratuits à 12 mois, prospects à 3 ans, réponses brutes à 90 jours
- [ ] AI Act, art. 4 et 50 : mention « analyses produites avec l'IA » (déjà présente) et note d'une page sur votre usage de l'IA
- [ ] Liste des métiers réglementés refusés (santé, droit, chiffre, architectes)
- [ ] `GEMINI_GROUNDING=off`, ou Gemini remplacé par Claude (§10)

---

## 10. Risques et parades

| Risque | Parade |
|---|---|
| **Variance des IA** : le client teste lui-même et obtient autre chose | Fourchette, indice de confiance, extraits datés et page `/methode`. Hausse ou baisse annoncée seulement au-delà de la marge de mesure (sinon « stable »), ce qui évite les fausses alertes, première cause de résiliation. Script de réponse au §4 |
| **Concurrents** : BrightLocal ou Local Falcon passent au français, un outil français descend à 29 € | Avance sur le terrain : métiers parisiens, plan d'action adapté aux annuaires français, vente en face à face. Les données d'audit agrégées alimentent un contenu que les autres n'ont pas (étude « visibilité IA des commerces parisiens » à partir de 200 audits). Canal agences en marque blanche |
| **Conditions d'utilisation des API** | Gemini : pas d'ancrage, ou Claude à la place, et jamais de stockage ni de revente des résultats ancrés. OpenAI : API uniquement, jamais d'automatisation de chatgpt.com. Perplexity : rapport affiché dans votre application, pas de revente de données brutes. Dans le rapport, écrivez « mesuré via l'API de X, modèle Y, le [date] », jamais « ce que ChatGPT répond à vos clients ». Faites valider ce point par un avocat avant d'atteindre 10 clients |
| **Coût des API** : l'audit gratuit explose (un bot, un article viral) | Plafond de 0,60 € par audit dans le moteur, 5 audits par IP et par jour (ou moins), plafond mensuel chez chaque fournisseur, cache de 24 h par couple métier × zone (sauf Gemini ancré). En dernier recours, audit gratuit réduit à 5 requêtes × 1 exécution |
| **Churn** : 8 à 10 % par mois chez les TPE | Formule Démarrage (3 mois inclus), offre annuelle (2 mois offerts) proposée au mois 2, rapport mensuel avec avant/après, plan d'action à cocher dans l'app, relance si l'abonné n'a rien ouvert depuis 30 jours. Objectif : moins de 6 % par mois |
| **Délivrabilité et litige** | Domaine secondaire, warm-up, pause si les plaintes dépassent 0,1 %. Concurrents présentés comme « cités par l'IA », réponses brutes conservées 12 mois comme preuve, retrait sur demande |

---

## 11. Feuille de route produit

| Version | Échéance | Contenu |
|---|---|---|
| **V1.1** | Mois 1 et 2 | Liste blanche des métiers (refus des métiers réglementés dans le formulaire et dans `TRADES`) ; livraison automatique du plan d'action (lien signé dans l'e-mail d'achat) ; relances automatiques J+1, J+3 et J+7 après un audit gratuit ; `AUDIT_SIGNING_SECRET` ajouté à `.env.example` ; admin branché sur Supabase (utilisable en ligne) ; lien « Contester ou supprimer cet audit » vérifié ; bump « 3 mois de suivi pour 50 € » sur le plan d'action seul |
| **V1.2** | Mois 2 et 3 | Notifications push (Android, puis iOS testé sur un vrai iPhone), e-mail de reprise en cas d'inactivité, comparaison avant/après à 90 jours, offre annuelle au mois 2, mesure des coûts réels par audit (`audits.cost_eur`) |
| **V1.3** | Mois 3 et 4 | Formule Pro multi-établissements (jusqu'à 5), lien partenaire agence avec 30 % de commission (metadata `partner_id`), passage en `index` des premières pages SEO métier × ville dès qu'elles ont des données, articles piliers 1 à 5 |
| **V2** | Mois 4 à 6 | Formule Agence en marque blanche (logo, couleurs, domaine du rapport), plans d'action à tarif revendeur (99 €), Google AI Overviews et AI Mode si mesurables en France, étude annuelle « visibilité IA des commerces parisiens » (à partir de 200 audits), audit d'un concurrent en option (19 €), ouverture de Lyon, Marseille et Bordeaux |

---

## 12. Sources clés

Les documents détaillés sont dans `docs/` : marque (01), concurrence (02), méthode (03), API (04), plan d'action (05), juridique (06), prix (07), textes du site (08), prospection (09), SEO (10), rapport (11), verticales (12), app (13).

- Usage de l'IA en France : [Crédoc, Baromètre du numérique 2026](https://www.credoc.fr/download/pdf/Sou/Sou2026-5064.pdf) · [Eskimoz × Ipsos via Siècle Digital](https://siecledigital.fr/2026/05/28/etude-les-francais-se-tournent-massivement-vers-lia-pour-effectuer-leurs-recherches-en-ligne/)
- Variance des IA : [SparkToro via Search Engine Land](https://searchengineland.com/ai-recommendation-lists-rarely-repeat-study-468076) · [Atil et al., arXiv 2408.04667](https://arxiv.org/html/2408.04667v5)
- Concurrents : [BrightLocal Local AI Visibility](https://www.brightlocal.com/local-ai-tools/local-ai-visibility/) · [Local Falcon](https://www.localfalcon.com/pricing) · [La Fabrique du Net, outils GEO](https://www.lafabriquedunet.fr/logiciels/marketing-digital/outils-geo) · [tarifs des agences GEO](https://www.lafabriquedunet.fr/agences/pages/agences-geo/tarifs)
- Conditions des API : [OpenAI Services Agreement](https://cdn.openai.com/osa/openai-services-agreement.pdf) · [Perplexity API Terms](https://www.perplexity.ai/en-GB/hub/legal/perplexity-api-terms-of-service) · [Gemini API Additional Terms (archive)](https://ai.google.dev/gemini-api/terms-archive/terms_10_07_25) · [Anthropic Commercial Terms](https://www.anthropic.com/legal/commercial-terms)
- Prix des API : [nesyona, prix par 1 000 appels](https://nesyona.com/articles/ai-web-search-tool-prices-per-1000-calls-2026)
- Prospection : [CNIL, règles d'or](https://www.cnil.fr/fr/node/84701) · [Selectra, démarchage au 11 août 2026](https://selectra.info/telecom/actualites/marche/demarchage-telephonique-interdit-11-aout-2026-consentement-bloctel) · [API Recherche d'entreprises](https://recherche-entreprises.api.gouv.fr/docs/) · [Google Places, politiques](https://developers.google.com/maps/documentation/places/web-service/policies)
- Conversion freemium : [Userpilot](https://userpilot.com/blog/saas-average-conversion-rate)
- Statut : [Legifiscal, seuils de la micro-entreprise 2026](https://www.legifiscal.fr/actualites-fiscales/4436-nouveaux-seuils-micro-entreprises-annee-2026.html) **[À VÉRIFIER sur impots.gouv]**
