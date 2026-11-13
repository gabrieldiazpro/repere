# 09 — Prospection : l'audit réel comme appât

> Agent PROSPECTION. Principe : on n'envoie jamais un message générique. On envoie **l'audit réel du commerçant** (score /100 + concurrents cités à sa place), produit par le moteur `runAudit()`. Jamais d'audit `demo: true` (mock) envoyé à un prospect.
> Point juridique : résumé de sources publiques, pas un avis. À faire valider par l'agent juridique avant le premier envoi.

## 0. Ce que les recherches ont établi (et leurs limites)

| Sujet | Constat | Fiabilité |
|---|---|---|
| Google Places API | Le crédit de 200 $/mois a disparu le 1er mars 2025. Il est remplacé par des quotas gratuits par SKU : Essentials 10 000, Pro 5 000, Enterprise 1 000 appels/mois. Text Search Pro : 32 $/1 000 au-delà. Le FieldMask fixe le palier : un seul champ « Enterprise » (note, téléphone, site web) fait facturer l'appel au tarif Enterprise (35 $/1 000, 1 000 gratuits). | Blog tiers (openplacesapi.com), à confirmer sur la page tarifs Google |
| Annuaire des entreprises | `GET https://recherche-entreprises.api.gouv.fr/search` (gratuit, sans clé). Filtres `code_postal`, `code_naf` confirmés. Pas d'e-mail ni de téléphone dans les données. | README GitHub officiel. `per_page` max, limite de débit et liste des champs non confirmés : lire `/docs/` avant de coder |
| CNIL, e-mail B2B | Pas de consentement préalable si l'adresse est **générique** (info@, contact@), si la personne a été informée de son droit d'opposition et si le message concerne sa fonction. Interdit : adresses « moissonnées » dans des espaces publics (sites, annuaires, forums) à l'insu des personnes. Chaque message doit avoir un désabonnement simple et gratuit, et identifier l'annonceur. | CNIL (page officielle) |
| CNIL, opt-in vs opt-out | Le B2C est en opt-in. Le B2B peut reposer sur l'intérêt légitime pour une adresse pro (générique ou nominative) liée à la fonction. | Article de cabinet (leto.legal), pas de passage sur les entrepreneurs individuels ni WhatsApp |
| Téléphone | La loi du 30 juin 2025 (en vigueur le 11 août 2026) impose le consentement préalable pour appeler des **consommateurs** et supprime Bloctel. **Le B2B n'est pas concerné.** Créneaux : lun-ven 10h-13h et 14h-20h. | Blog du Modérateur, cbnews. Vérifier sur economie.gouv.fr |
| SMS / WhatsApp | Pas de source trouvée précisant le B2B. Ce sont des « communications électroniques » (art. L.34-5 CPCE) : même régime que l'e-mail. Position prudente : jamais en premier contact. | Non confirmé par une source |
| Cold e-mail, délivrabilité | Domaine secondaire dédié, SPF + DKIM + DMARC (`p=none` 4 à 6 semaines puis `quarantine`), warm-up 21 à 28 jours à 5-10 mails/jour, puis 10-15/jour. Moins de 30 mails/jour/boîte. Suspendre si plaintes spam > 0,1 %. | Guide d'un vendeur (LeadHaste) : chiffres indicatifs, non sourcés |
| Taux de réponse | Réponse moyenne 5 à 12 % ; masse « non qualifiée » ≈ 2 % ; 15 % et plus = très bon. | Breakcold (vendeur d'outil), non sourcé, non spécifique à la France. **Aucun benchmark français fiable trouvé** : on part bas et on mesure. |
| Porte-à-porte Paris | Aucune source juridique spécifique trouvée. Le cadre « démarchage à domicile » vise les consommateurs. Entrer dans un commerce ouvert au public est licite. Pas d'autorisation spéciale connue pour le B2B. | À valider par l'agent juridique |

## 1. Routine quotidienne de 60 minutes (matin, du mardi au jeudi de préférence)

| Min | Tâche | Résultat attendu |
|---|---|---|
| 0-10 | Prendre 10 commerces dans la liste (§3), non contactés, statut `a_contacter` | 10 lignes |
| 10-25 | Lancer 10 audits réels (`/audit`), rédiger les 2 concurrents cités | 10 PDF + 10 liens `/rapport/[id]` |
| 25-40 | Envoyer 10 e-mails n°1 (§5) depuis la boîte chauffée (max 15/jour pendant le warm-up) | 10 envois |
| 40-50 | Relances J+3, J+7, J+14 déjà dues (e-mails 2 à 4) | 5 à 10 envois |
| 50-55 | Répondre aux réponses, noter les désinscriptions (traitées sous 24 h) | boîte à zéro |
| 55-60 | Mettre à jour le suivi (statut, date, réponse) et les KPI (§10) | 1 ligne de tableau |

Variante terrain : un après-midi par semaine (14h30-17h), 15 commerces d'une même rue, audit déjà prêt sur le téléphone (§8).

## 2. Stack gratuite

| Besoin | Outil | Coût / limite |
|---|---|---|
| Liste d'entreprises | API Recherche d'entreprises (data.gouv) | Gratuit, sans clé |
| Site web, téléphone, note, concurrents | Google Places API (New), Text Search + Place Details | 5 000 appels Pro/mois et 1 000 Enterprise/mois gratuits : 200 commerces tiennent dans les quotas. Plafonner le quota dans la console Cloud. |
| E-mail d'un commerçant | Page « mentions légales » / « contact » de son **propre** site (l'adresse y est légalement publiée), puis formulaire de contact. Adresses génériques uniquement. | Gratuit, manuel |
| Envoi | Boîte Google Workspace ou Zoho Mail sur un domaine secondaire (~6 €/mois, hors budget zéro si besoin : Zoho gratuit limité) | < 30 mails/jour/boîte |
| Rapport en pièce jointe / lien | Lien `/rapport/[id]` + PDF (moteur existant) | 0 € |
| Suivi | Google Sheets ou table `prospects` Supabase | Gratuit |
| Envoi transactionnel (pas de prospection) | Resend, tier gratuit | Réservé au rapport envoyé après demande du commerçant |
| Domaine | Domaine secondaire (ex. `auditia-local.fr`, ~8 €/an) | 8 €/an |

Ne pas envoyer de prospection avec Resend ni depuis le domaine principal du produit : un blocage détruirait la délivrabilité des e-mails de rapport.

Configuration DNS du domaine secondaire :
```
SPF    TXT  @        "v=spf1 include:_spf.google.com ~all"
DKIM   TXT  google._domainkey  (clé générée dans la console Workspace)
DMARC  TXT  _dmarc   "v=DMARC1; p=none; rua=mailto:dmarc@auditia-local.fr"
```
Calendrier : J0 achat du domaine et DNS ; J1-J28 warm-up (5 à 10 mails/jour à des adresses amies qui répondent) ; DMARC en `p=none` 4 à 6 semaines puis `quarantine` ; premiers envois réels à partir de J21 avec 5/jour, +5 chaque semaine jusqu'à 15 à 25/jour. Redirection 301 du domaine secondaire vers le site pour la crédibilité.

## 3. Script : liste de 200 commerces d'un arrondissement

**Sources**
1. API Recherche d'entreprises (SIRENE) : identité légale, code NAF, adresse du siège/établissement, forme juridique, date de création, état actif. Base de départ licite et gratuite.
2. Google Places API : site web, téléphone, note, nombre d'avis, coordonnées, `place_id`. Enrichissement, conformément aux conditions Google (ne pas stocker durablement le contenu hors `place_id`).
3. Site du commerce (mentions légales) : e-mail générique, trouvé à la main.

**Champs de la table `prospects`**

| Champ | Source | Usage |
|---|---|---|
| `siret`, `nom` | SIRENE | identification, dédoublonnage |
| `naf`, `metier` (libellé mappé) | SIRENE | `AuditInput.trade` |
| `adresse`, `code_postal`, `arrondissement` | SIRENE | `AuditInput.city/district` |
| `forme_juridique` | SIRENE | exclure les EI sans adresse pro (voir §9) |
| `place_id`, `site_web`, `telephone`, `note`, `nb_avis` | Google Places | e-mail, appel, tri par potentiel |
| `email_generique`, `email_source_url` | site du commerce (manuel) | envoi, preuve de la source |
| `statut`, `dernier_contact`, `audit_id`, `score`, `concurrents` | interne | suivi |
| `opposition` (bool, date) | interne | liste d'exclusion permanente |

**Script Python** (exécuter avec `python3 -I`, clé dans l'environnement, jamais dans le code)
```python
import os, csv, time, requests

CP = "75011"                                  # un arrondissement
NAFS = {                                      # métiers cibles (à ajuster)
  "56.10A": "restaurant", "43.22A": "plombier", "96.02A": "coiffeur",
  "96.02B": "institut de beauté", "68.31Z": "agence immobilière",
  "86.23Z": "dentiste", "47.24Z": "boulangerie",
}
GKEY = os.environ.get("GOOGLE_PLACES_KEY")    # facultatif : sans clé, SIRENE seul
rows, seen = [], set()

for naf, metier in NAFS.items():
    page = 1
    while len([r for r in rows if r["naf"] == naf]) < 30:   # ~30 par métier
        r = requests.get("https://recherche-entreprises.api.gouv.fr/search",
            params={"code_postal": CP, "activite_principale": naf,
                    "etat_administratif": "A", "per_page": 25, "page": page},
            timeout=20)
        if r.status_code != 200: break
        res = r.json().get("results", [])
        if not res: break
        for e in res:
            s = e.get("siege", {})
            if s.get("siret") in seen or s.get("code_postal") != CP: continue
            seen.add(s.get("siret"))
            rows.append({"siret": s.get("siret"), "nom": e.get("nom_complet"),
                "naf": naf, "metier": metier, "adresse": s.get("adresse"),
                "code_postal": CP, "forme": e.get("nature_juridique"),
                "place_id": "", "site_web": "", "telephone": "", "note": "", "nb_avis": ""})
        page += 1; time.sleep(0.3)                          # rester sous la limite de débit

if GKEY:                                                    # enrichissement ~200 appels
    for row in rows[:200]:
        q = f'{row["nom"]} {row["adresse"]}'
        r = requests.post("https://places.googleapis.com/v1/places:searchText",
            headers={"X-Goog-Api-Key": GKEY,
                     "X-Goog-FieldMask": "places.id,places.websiteUri,places.nationalPhoneNumber,places.rating,places.userRatingCount"},
            json={"textQuery": q, "languageCode": "fr", "maxResultCount": 1}, timeout=20)
        p = (r.json().get("places") or [{}])[0]
        row.update(place_id=p.get("id",""), site_web=p.get("websiteUri",""),
                   telephone=p.get("nationalPhoneNumber",""),
                   note=p.get("rating",""), nb_avis=p.get("userRatingCount",""))
        time.sleep(0.2)

rows = rows[:200]
with open("prospects.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=rows[0].keys()); w.writeheader(); w.writerows(rows)
print(len(rows), "commerces")
```
Avant de lancer : vérifier les noms de paramètres (`activite_principale` vs `code_naf`) et le `per_page` maximum dans `https://recherche-entreprises.api.gouv.fr/docs/`. Les champs rating/téléphone/site sont facturés au palier Enterprise (1 000 gratuits/mois) : 200 appels sont gratuits. Poser un plafond de quota dans la console Google Cloud. Les e-mails se complètent à la main : environ 3 minutes par commerce, soit 10 commerces par jour dans la routine.

Prioriser : site web présent + note ≥ 4,2 + 50 avis ou plus (ils ont à perdre), métiers où l'on cherche en urgence (plombier, serrurier, dentiste).

## 4. Règles de conformité communes à toutes les séquences

1. Adresse **générique ou professionnelle** liée à la fonction (info@, contact@) ; jamais d'adresse personnelle. Conserver `email_source_url` et la date : c'est la preuve de la source.
2. Le premier message annonce : qui écrit, pourquoi il écrit à ce commerce, d'où vient l'adresse, comment s'opposer (CNIL).
3. Désinscription gratuite et immédiate : réponse « STOP » + lien. Enregistrer l'opposition sous 24 h, ne jamais recontacter.
4. Identité réelle de l'expéditeur, adresse postale, objet non trompeur (pas de « Re: » factice).
5. Contenu lié à l'activité du destinataire (l'audit de **son** commerce).
6. Mention d'information RGPD courte dans le pied de page (responsable, finalité, base légale intérêt légitime, durée de conservation, droits).
7. Maximum 4 messages par prospect, puis arrêt : pas de relance au-delà.

## 5. Séquence de 4 e-mails

Variables : `{nom}`, `{metier}`, `{quartier}`, `{score}`, `{A}`, `{B}`, `{lien}`, `{expediteur}`.

**E-mail 1 (J0). Objet : `{nom} : {score}/100 sur ChatGPT, {A} est cité à votre place`**
```
Bonjour,

J'ai demandé à ChatGPT, Perplexity et Gemini « meilleur {metier} {quartier} » et j'ai regardé qui ils recommandent.

Votre score : {score}/100.
Vos concurrents cités : {A}, {B}.

Le rapport complet pour {nom} (les questions testées, les réponses obtenues) est ici, sans inscription : {lien}

Ce que cela veut dire : de plus en plus de clients demandent une adresse à une IA au lieu de chercher sur Google. Si l'IA ne vous cite pas, ils appellent quelqu'un d'autre.

Si cela vous parle, répondez à ce message : je vous envoie 3 actions concrètes pour remonter.

{expediteur}, AuditIA Local — {adresse postale}
Vous recevez ce message car l'adresse {email} figure sur le site de {nom} comme adresse de contact. Pas intéressé ? Répondez « STOP » ou cliquez ici : {lien_stop}. Informations sur vos données : {lien_confidentialite}.
```

**E-mail 2 (J+3). Objet : `{A} ressort avant vous : voici pourquoi`**
```
Bonjour,

Je reviens sur le rapport de {nom}. Une observation : {A} est cité parce que {raison_concrete_du_rapport, ex. « sa fiche Google a 120 avis et des horaires à jour »}.

Votre rapport : {lien}
Une première action possible sans rien payer : {action_gratuite_issue_du_rapport}.

{expediteur}
{pied de page identique + STOP}
```

**E-mail 3 (J+7). Objet : `Refaire le test dans un mois ?`**
```
Bonjour,

Les IA changent leurs réponses d'un mois à l'autre. Deux options pour {nom} :
- Plan d'action personnalisé (149 €, une fois) : les modifications à faire, dans l'ordre.
- Suivi mensuel (29 €/mois) : audit refait chaque mois, évolution de votre score et alertes si un concurrent vous dépasse.

Détail et tarifs : {lien_tarifs}. Sans engagement pour le suivi.

{expediteur}
{pied de page + STOP}
```

**E-mail 4 (J+14). Objet : `Dernier message de ma part`**
```
Bonjour,

Je ne vous écris plus après celui-ci. Votre rapport reste disponible pendant 30 jours : {lien}.
Si le sujet n'est pas pour vous, aucun problème. Une réponse « non merci » me suffit et je supprime votre adresse de mon fichier.

{expediteur}
{pied de page + STOP}
```
Tester l'objet (A/B manuel sur 2 × 20 envois) avant de généraliser. Ne jamais inventer un concurrent : A et B viennent du résultat réel du moteur (`competitors`).

## 6. Script d'appel de 60 secondes (B2B, après e-mail envoyé ou sans)

Cadre : appel à un numéro professionnel (téléphone du commerce, trouvé sur Google). Le B2B n'est pas couvert par le nouveau régime de consentement du 11 août 2026 (source presse, à confirmer). Appeler en dehors des heures de service (pas de 12h-14h pour les restaurants), du lundi au vendredi.

```
[0-10 s]  « Bonjour, Gabriel d'AuditIA Local. Je suis bien chez {nom} ? J'ai 1 minute, c'est OK ? »
[10-25 s] « J'ai testé ce matin ce que ChatGPT répond quand on cherche un {metier} {quartier}.
           {nom} a {score} sur 100, et ce sont {A} et {B} qui sont cités. »
[25-40 s] « Vous avez le rapport complet, c'est gratuit. Je peux vous l'envoyer à quelle adresse ? »
[40-55 s] Objection « pas le temps » : « Je vous l'envoie, 2 minutes de lecture, vous me dites ce que vous en pensez. »
          Objection « ça ne m'intéresse pas » : « Pas de souci, je ne vous rappelle pas. Bonne journée. » (noter l'opposition)
[55-60 s] « Merci, vous le recevez dans 5 minutes. Je vous écris depuis {adresse e-mail}. Bonne journée ! »
```
Dire d'où vient le numéro si on le demande (annuaire / fiche Google publique), et respecter toute opposition.

## 7. Message LinkedIn (note de connexion, 300 caractères max)

```
Bonjour {prénom}, j'ai testé ce que ChatGPT répond pour « {metier} {quartier} » : {nom} a {score}/100, {A} est cité avant vous. J'ai le rapport complet pour vous, gratuit. Je vous l'envoie ?
```
Après acceptation : envoyer le lien `/rapport/[id]`, une seule relance à J+5, puis arrêt. Cibler les gérants (fiche LinkedIn professionnelle), pas des particuliers. SMS et WhatsApp : seulement après une réponse du commerçant ou son accord explicite, avec mention « STOP » ; jamais en premier contact (régime des communications électroniques, point à confirmer par l'agent juridique).

## 8. Script de porte-à-porte avec l'audit sur le téléphone

Quand : mardi à jeudi, 14h30-17h (hors coup de feu du déjeuner). Éviter le samedi et les heures de pointe. Une rue ou un secteur à la fois pour enchaîner 15 commerces en 2 h. Se présenter dans un commerce ouvert au public.

```
Préparation : rapport du commerce ouvert sur le téléphone (écran du score + la liste « concurrents cités »),
              QR code du rapport en plein écran, cartes de visite avec le QR.

[Entrée]  « Bonjour, je ne vous retiens pas longtemps. Vous êtes le/la gérant(e) ? »
[Accroche] « Je suis Gabriel, j'ai testé ChatGPT sur "{metier} {quartier}". Regardez : voici qui il recommande. »
          (montrer l'écran : {A}, {B}, puis leur score {score}/100)
[Question] « Vous voyez des clients qui demandent à l'IA plutôt qu'à Google ? »
[Offre]   « Le rapport est gratuit : je vous l'envoie par e-mail, ou scannez ce QR code. »
[Option]  « Pour remonter, il y a un plan d'action à 149 € une fois, ou un suivi à 29 € par mois. Pas de pression. »
[Sortie]  Si occupé : « Je repasse la semaine prochaine ? » Si refus : « Merci, bonne journée. » (noter, ne pas insister)
```
Noter chaque visite dans le suivi dans l'heure. Ne jamais laisser le commerçant donner un e-mail sans lui dire son usage (prospection AuditIA, droit d'opposition). Pas de démarchage dans une partie privée ni auprès de particuliers : hors cadre.

## 9. Entonnoir chiffré (hypothèses, à remplacer par les mesures)

Hypothèses de départ : 1 boîte, 30 mails/jour au maximum, 20 jours ouvrés, soit **600 envois/mois** (en tenant compte du warm-up, atteint à partir du mois 2). Les taux sont des **hypothèses prudentes**, sous les moyennes de blogs (5 à 12 % de réponses) parce que la cible est une TPE peu familière du sujet et qu'aucun benchmark français fiable n'a été trouvé.

| Étape | Taux | Volume / mois |
|---|---|---|
| E-mails envoyés (4 séquences confondues) | | 600 |
| Délivrés (hors spam/rebonds) | 90 % | 540 |
| Rapports consultés (clic) | 12 % | 65 |
| Réponses (positives ou négatives, désinscriptions comprises) | 4 % | 22 |
| Réponses positives (veulent les 3 actions) | 40 % des réponses | 9 |
| Plans d'action achetés (149 €) | 40 % des positives | 3 à 4 |
| Abonnés au suivi (29 €/mois) | 50 % des acheteurs du plan + 1 achat direct | 2 à 3 |

Résultat attendu à 600 envois : environ 3 plans d'action (~450 €) et 2-3 abonnés (~70 €/mois de récurrent). Soit un coût d'acquisition très bas (temps + ~10 €/mois) mais un volume modeste : pour 10 abonnés par mois, il faut multiplier les canaux (porte-à-porte, appels) ou le nombre de boîtes.

Canaux terrain (hypothèses) : 15 commerces/demi-journée en porte-à-porte → 6 conversations utiles → 1 rapport lu avec attention → 0,3 vente (plan 149 €). Appels : 20 appels/h → 8 joints → 3 acceptent de recevoir le rapport → 0,3 vente.

Seuils de décision après 4 semaines : réponses < 2 % → retravailler l'objet et la ligne 1 ; plaintes spam > 0,1 % ou rebonds > 3 % → pause, audit du domaine ; > 8 % de réponses → monter à 2 boîtes.

## 10. KPI à suivre (tableau hebdomadaire)

| KPI | Cible | Alerte |
|---|---|---|
| Envois / jour | 10 à 30 | > 30 par boîte |
| Taux de rebond | < 3 % | > 5 % |
| Plaintes spam | < 0,1 % | > 0,1 % : pause immédiate |
| Taux de consultation du rapport | > 12 % | < 5 % |
| Taux de réponse | 4 % | < 2 % |
| Désinscriptions traitées sous 24 h | 100 % | tout retard |
| Réponses positives → plan d'action | 40 % | < 15 % |
| Plans d'action vendus / 100 envois | 0,5 | < 0,2 |
| Abonnés actifs, MRR, churn mensuel | croissance | churn > 8 % |
| Temps par prospect (audit + envoi) | < 6 min | > 10 min |
| Coût du mois (domaine, boîte, API) | < 50 € | > 50 € |

## 11. Erreurs à éviter

1. Envoyer depuis le domaine principal ou sans warm-up : domaine grillé, rapports transactionnels en spam.
2. Moissonner des e-mails à grande échelle (sites, annuaires) ou acheter un fichier sans traçabilité : interdit par la CNIL pour des adresses collectées à l'insu des personnes.
3. Écrire à des adresses nominatives personnelles, ou à un entrepreneur individuel sans adresse professionnelle dédiée (risque d'être traité comme un particulier).
4. Envoyer un audit `demo` / mock, ou un score faux : promesse trompeuse, perte de crédibilité.
5. Affirmer « ChatGPT ne vous cite pas » sans avoir vérifié sur plusieurs runs : afficher le niveau de confiance du rapport (`faible/moyenne/bonne`).
6. Citer un concurrent de façon dénigrante : rester factuel (« cité par l'IA »), aucun jugement sur sa qualité.
7. Relancer au-delà de 4 messages ou ignorer un STOP.
8. Utiliser un SMS ou WhatsApp en premier contact.
9. Dépasser les quotas Google Places sans plafond : facture à 32-35 $ / 1 000 appels ; stocker les données Places hors conditions.
10. Appeler un particulier (consommateur) : le consentement préalable s'applique depuis le 11 août 2026.
11. Promettre un classement dans les IA : promettre des actions, pas un résultat.
12. Négliger la mesure : sans suivi de chaque étape, impossible de savoir ce qui bloque.

## 12. Sources

- Google, tarification Places API : https://developers.google.com/maps/billing-and-pricing/pricing
- Synthèse des quotas 2026 : https://openplacesapi.com/blog/google-places-api-pricing
- API Recherche d'entreprises (code) : https://github.com/annuaire-entreprises-data-gouv-fr/search-api ; documentation : https://recherche-entreprises.api.gouv.fr/docs/
- CNIL, règles d'or de la prospection par courrier électronique : https://www.cnil.fr/fr/les-regles-dor-de-la-prospection-par-courrier-electronique-0
- CNIL / opt-in vs opt-out 2026 (cabinet) : https://www.leto.legal/news/cnil-communications-electroniques-prospection-regles-2026
- Démarchage téléphonique, loi du 30 juin 2025 (11 août 2026) : https://www.blogdumoderateur.com/demarchage-telephonique-fin-bloctel-11-aout/ ; https://www.cbnews.fr/node/102587
- Bloctel (ancien régime, particuliers) : https://www.economie.gouv.fr/entreprises/bloctel-professionnels-reglementation
- Délivrabilité (guide d'un vendeur, chiffres indicatifs) : https://leadhaste.com/blog/cold-email-domain-setup-guide-2026
- Taux de réponse (vendeur d'outil, non sourcé) : https://www.breakcold.com/fr/blog/cold-email-taux-de-reponse
- Résultats de recherche non ouverts (à lire avant de décider) : https://www.mntd.fr/app/uploads/2026/02/Prospection-commerciale-RGPD-quelles-sont-les-regles-en-2026.pdf ; https://www.zeliq.com/fr/blog/taux-ouverture-email-b2b
