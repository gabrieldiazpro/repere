# AuditIA Local — Juridique : règles et modèles (version 1, 9 nov. 2026)

> **AVERTISSEMENT — À LIRE D'ABORD.** Ce document n'est pas un avis juridique et son auteur n'est pas avocat.
> Ce sont des **modèles de travail et une synthèse de recherches web** à faire **valider par un avocat ou un expert-comptable**
> avant publication. Les passages marqués **[À VÉRIFIER]** reposent sur des sources secondaires, ou sur des points que je n'ai
> pas pu confirmer dans un texte officiel (Légifrance n'a pas été consulté directement). Les champs entre crochets `[...]` sont à remplir.
> Budget indicatif d'une relecture : 1 à 2 h d'avocat sur les CGV/CGU + prospection, ou un forfait « site web » en ligne.

---

## 0. Ce qu'il faut retenir (les 5 règles critiques)

1. **Ne jamais scraper Google Maps.** Utiliser l'API Places officielle (on ne conserve que le `place_id`) ou l'open data Sirene. Voir §1.4.
2. **Prospection e-mail B2B** : seulement vers des adresses professionnelles, avec une offre en rapport avec l'activité du destinataire, une information claire sur la source des données, et un lien de désinscription fonctionnel. Les entrepreneurs individuels (EI) sont des personnes physiques : ils exigent plus de prudence. Voir §1.1.
3. **Téléphone** : depuis le 11 août 2026, le démarchage des consommateurs est soumis à consentement préalable. Le B2B n'est pas clairement visé, mais la prudence impose une règle interne stricte (numéros professionnels uniquement, arrêt immédiat sur opposition). Voir §1.2.
4. **Audit non sollicité** : privé, factuel, daté, sans jugement de valeur, sans facture ni engagement, et sans publication nominative. Concurrents nommés seulement comme « cités par l'IA ». Voir §1.3.
5. **Promesse** : obligation de moyens uniquement, jamais « on vous fait passer premier dans ChatGPT ». Un avertissement « méthode et limites » sur chaque rapport (§5).

---

## 1. Règles de prospection à respecter

### 1.1 E-mail B2B (CNIL / Code des postes et communications électroniques, art. L.34-5)

Ce que disent les sources consultées :
- Les « règles d'or » de la CNIL : en B2B, l'accord préalable n'est pas exigé si le professionnel a été informé de son droit de s'opposer et si le message a un **rapport avec sa fonction professionnelle**. Chaque message doit **identifier l'annonceur** et offrir une **désinscription simple**, idéalement en un clic. L'effacement doit suivre rapidement. ([CNIL](https://www.cnil.fr/fr/node/84701))
- Pour les adresses nominatives, la charge de la preuve repose sur nous. Il faut documenter la base légale et la source. ([Leto](https://www.leto.legal/news/cnil-communications-electroniques-prospection-regles-2026), [Kohen Avocats](https://kohenavocats.fr/2026/05/21/acheter-base-donnees-prospects-rgpd-cnil-2026/))
- Le cas des EI n'est traité par aucune source consultée **[À VÉRIFIER]**. Un EI est une personne physique ; son adresse peut être un e-mail personnel. Règle de prudence ci-dessous.

**Règles concrètes (à appliquer sans exception) :**

| # | Règle |
|---|---|
| E1 | N'écrire qu'à des **adresses professionnelles** (contact@, nom@entreprise.fr, adresse publiée par le commerce comme moyen de contact pro). **Jamais** d'adresse @gmail/@orange/@free sauf si elle est publiée **par le commerce lui-même** comme son contact professionnel. |
| E2 | **Ne pas deviner ni fabriquer** d'adresses (prenom.nom@...). **Ne pas aspirer** d'adresses sur des annuaires ou réseaux sociaux. La source doit être traçable. |
| E3 | **Objet du message = activité du destinataire** (visibilité du commerce sur les assistants IA). Pas de message hors sujet. |
| E4 | **Information sur la source** dans chaque premier message (« votre établissement figure dans l'annuaire public Sirene / sur Google Maps »). |
| E5 | **Identité de l'expéditeur claire** : nom, adresse postale, e-mail de contact, SIREN. Objet non trompeur. Pas de faux « Re: ». |
| E6 | **Désinscription** : lien fonctionnel en un clic + possibilité de répondre « STOP ». Traitement immédiat (cible : sous 24 h, légal : « sans délai »). |
| E7 | **Liste d'opposition interne** (table `suppression` : e-mail hashé + date) consultée **avant chaque envoi**. Jamais supprimée. |
| E8 | **EI / profession libérale / adresse nominative** : n'envoyer qu'**un seul message de prise de contact** en cas de doute, sans relance, et seulement si l'adresse est publiée à titre professionnel. En cas d'opposition : arrêt définitif. |
| E9 | **Volume limité** au départ (≤ 30 messages/jour) depuis un **sous-domaine dédié** (ex. `hello.auditia.fr`) avec SPF, DKIM, DMARC. Protège le domaine principal et la délivrabilité. |
| E10 | **Pas de pièce jointe lourde** ; lien vers le rapport hébergé sur le site (voir §1.3). |
| E11 | **Conserver la preuve** : source, date de collecte, date d'envoi, texte envoyé, éventuelle opposition. |
| E12 | **Durée de conservation** d'un prospect sans réponse : **3 ans** après le dernier contact, puis suppression **[À VÉRIFIER — durée usuelle des recommandations CNIL]**. |

**Mention type à placer en pied de chaque e-mail de prospection :**

```
Vous recevez ce message à titre professionnel : votre établissement « [Nom du commerce] » ([métier], [ville])
figure dans [l'annuaire public des entreprises (Sirene/INSEE) / sa fiche publique Google Maps], et notre message
concerne votre visibilité sur les assistants IA (ChatGPT, Gemini, Perplexity).
Pour ne plus rien recevoir de notre part : [Se désinscrire en un clic → URL] ou répondez « STOP ».
Responsable du traitement : [Prénom NOM / Raison sociale], [adresse], SIREN [000 000 000] — [e-mail de contact].
Vos droits (accès, rectification, effacement, opposition) : [URL politique de confidentialité] ou [e-mail].
```

### 1.2 Téléphone

Ce que disent les sources consultées :
- La **loi du 30 juin 2025** (démarchage téléphonique) rend le **consentement préalable** obligatoire à partir du **11 août 2026** ; Bloctel disparaît à cette date pour les consommateurs. Plages horaires : lundi–vendredi, 10 h–13 h et 14 h–20 h ; sanctions annoncées jusqu'à 375 000 € par appel illégal pour une entreprise ; contrats signés après démarchage non conforme nuls. ([Selectra](https://selectra.info/telecom/actualites/marche/demarchage-telephonique-interdit-11-aout-2026-consentement-bloctel), source secondaire)
- **Le B2B n'est pas clairement visé** : les articles consultés ne parlent que des « particuliers/consommateurs ». Un article d'avocats indique que le consentement concerne « le consommateur » et que le B2B relève de l'intérêt légitime (offre en rapport avec l'activité, information, opposition simple) ; mais un professionnel appelé à titre privé garde la protection du consommateur. ([Kohen Avocats](https://kohenavocats.fr/?p=2105941), [HubSpot FR](https://blog.hubspot.fr/sales/alternatives-demarchage-telephonique)) **[À VÉRIFIER sur Légifrance : art. L.223-1 et s. du Code de la consommation, décret n° 2026-662]**
- La page economie.gouv « Bloctel professionnels » que j'ai ouverte date de **2018** : elle est **obsolète**, ne pas s'y fier. ([economie.gouv](https://www.economie.gouv.fr/entreprises/bloctel-professionnels-reglementation))

**Règle de prudence AuditIA : pas de démarchage téléphonique à froid en V1.** Priorité à l'e-mail et aux canaux entrants (SEO, démo, bouche-à-oreille). Si un appel est un jour décidé :

| # | Règle |
|---|---|
| T1 | Uniquement vers le **numéro fixe professionnel publié** par le commerce. **Jamais** un portable présumé personnel (06/07) d'un EI. |
| T2 | Appeler **uniquement** pour une offre **liée à son activité**. |
| T3 | Respecter les **plages légales** (lun–ven, 10–13 h / 14–20 h) par prudence, même en B2B. |
| T4 | **Se présenter** (nom, société, objet de l'appel) dès le début. Pas de numéro masqué. |
| T5 | **Opposition = arrêt immédiat** ; inscrire le numéro dans la liste d'opposition, à vérifier avant tout appel. |
| T6 | **Pas d'enregistrement** sans information préalable. **Pas de vente forcée** : toute vente se conclut par le parcours en ligne, avec CGV acceptées. |
| T7 | Un fichier de leads issu de l'outil de phoning d'un tiers ne peut pas être réutilisé sans en connaître la source et la base légale. |

### 1.3 Envoi non sollicité d'un audit nominatif à un commerce

Aucune règle spécifique ne l'interdit ; on applique le droit commun (RGPD pour les EI et dirigeants, droit de la prospection, dénigrement, pratiques commerciales). Règles internes :

| # | Règle |
|---|---|
| A1 | **Premier contact = un e-mail** (§1.1) qui invite à **consulter** l'audit via un lien. Le score est visible par le destinataire. **Aucune publication** publique nominative. |
| A2 | **Rien à payer, aucun engagement** : l'audit gratuit ne donne lieu à aucune facture ni obligation. Ne pas écrire « merci de régler ». |
| A3 | **Ton factuel et daté** : « Lors d'interrogations réalisées le [date], [Nom] a été cité dans X % des réponses ». **Pas** de « votre commerce est mauvais/invisible/dangereux ». |
| A4 | **Données minimales** : nom commercial, métier, ville, site, score, extraits des réponses IA. Pas de données personnelles sur le dirigeant. Pas d'avis nominatifs de clients. |
| A5 | **Droit de rectification et d'effacement** : un lien « Contester ou supprimer cet audit » dans le rapport. Réponse sous **30 jours maximum**, cible 72 h. |
| A6 | **Information article 14 RGPD** : donnée collectée indirectement, donc informer la personne **au plus tard au premier contact** et dans un délai maximal d'un mois (mention §1.1 + lien vers la politique de confidentialité §4). |
| A7 | **Mention « méthode et limites »** sur le rapport (§5) : l'IA peut se tromper, le résultat n'est pas une évaluation de la qualité du commerce. |
| A8 | **Pas d'audits en masse non demandés au-delà du volume d'envoi** (E9) : ne générer un audit nominatif que pour un lead que l'on va contacter. |
| A9 | **Pages SEO publiques** (`/visibilite-ia/[metier]/[ville]`) : **statistiques agrégées uniquement, aucun nom de commerce.** |

### 1.4 Nom d'une entreprise dans un rapport comparatif

- La **publicité comparative** est licite sous conditions : éléments **objectifs et vérifiables**, éléments **comparables**, pas de confusion, pas de **dénigrement**, pas de parasitisme ; sanctions civiles et pénales (celles de la publicité trompeuse). ([Eurojuris](https://www.eurojuris.fr/articles/les-regles-de-la-publicite-comparative-10594.htm), source secondaire ; articles L.121-8 et s. du Code de la consommation [À VÉRIFIER])
- Notre rapport **n'est pas** une publicité comparative tant qu'il reste (a) un rapport **privé** adressé au commerce audité, (b) qui **rapporte ce qu'ont répondu les IA**, sans nous prononcer sur la qualité des concurrents. Il le devient si on le publie ou si on s'en sert pour dire « choisissez-nous plutôt qu'eux ».

**Règles :**
- C1 : présenter les concurrents comme **« cités par les assistants IA »**, avec date, requête et nom de l'IA. Jamais « meilleur / pire », jamais de note de qualité.
- C2 : **pas de capture d'avis ou d'accusation** ; seulement le nom commercial tel que cité par l'IA.
- C3 : **pas de publication** nominative de classements (ni sur le site, ni sur les réseaux, ni dans les pages SEO).
- C4 : conserver la **réponse brute** de l'IA (preuve) pendant 12 mois.
- C5 : si un concurrent nommé demande son retrait, le retirer des rapports futurs.
- C6 : le nom d'un EI est souvent le nom d'une personne : donnée personnelle, application des règles RGPD (§4).

### 1.5 Données publiques de Google Maps / API Places

- Les conditions Google Maps Platform interdisent d'**exporter, extraire ou « scraper »** le contenu Google Maps hors des services, notamment de **copier et conserver des noms d'entreprise, adresses ou avis**, d'en faire un téléchargement en masse, ou d'utiliser les services « dans un annuaire/listing ». ([Google Maps Platform Terms](https://cloud.google.com/maps-platform/terms), section 3.2.3)
- Pour la Places API : le contenu **ne doit pas être pré-chargé, mis en cache ou stocké**, sauf exceptions. Le **`place_id`** est **exempt** et peut être conservé. Attribution Google obligatoire à l'affichage ; conditions d'utilisation et politique de confidentialité publiques exigées. ([Google : Policies](https://developers.google.com/maps/documentation/places/web-service/policies))
- Le texte des conditions ne parle pas explicitement de « lead generation » ; la voie la plus sûre est de ne pas constituer de base de commerces à partir de Maps.

**Règles :**
- G1 : **aucun scraping** de Google Maps, de Pages Jaunes, ni de pages de résultats de ChatGPT/Perplexity/Gemini. Les réponses IA s'obtiennent **par leurs API officielles**.
- G2 : de Google Places, **ne stocker que le `place_id`**. Les infos (nom, note…) se rafraîchissent par appel API et ne sont pas archivées en base **[À VÉRIFIER : détail des durées de cache autorisées dans les Service Specific Terms]**.
- G3 : **source des leads = Annuaire des entreprises / API Sirene (INSEE)**, licence ouverte, avec SIREN, adresse, code NAF. **Exclure les unités « non diffusibles »** (le statut de diffusion partielle d'un EI doit être respecté) **[À VÉRIFIER]**.
- G4 : **pas d'affichage** de contenu Google Maps (note, avis) dans le rapport sans l'attribution et les liens exigés. En V1, ne pas en afficher.
- G5 : **les fournisseurs IA** (OpenAI, Google, Perplexity, Anthropic) : respecter leurs conditions d'usage (pas de revente brute des sorties, pas de contournement des limites).

---

## 2. Modèle de mentions légales (page `/mentions-legales`)

> Contenu minimal LCEN, art. 6-III (loi du 21 juin 2004), à compléter. Je n'ai pas pu lire un texte officiel : la page service-public trouvée ne
> décrit que les mentions de son propre site ; la liste ci-dessous reprend le droit usuel et des sources secondaires **[À VÉRIFIER]**
> ([LegalPlace](https://www.legalplace.fr/guides/mentions-legales/), [Dougs](https://www.dougs.fr/blog/mentions-legales-modele-conseils-et-points-cles/)).
> **Astuce domicile** : un entrepreneur individuel qui ne veut pas afficher son domicile peut utiliser une adresse de domiciliation commerciale **[À VÉRIFIER]**.

```
MENTIONS LÉGALES

Éditeur du site
AuditIA Local est édité par [Prénom NOM], entrepreneur individuel (micro-entrepreneur)
exerçant sous le nom commercial « AuditIA Local ».
SIREN : [000 000 000] — SIRET : [000 000 000 00000]
Adresse : [adresse professionnelle ou de domiciliation]
E-mail : [contact@...] — Téléphone : [+33 ...]  (au moins un moyen de contact rapide et direct)
TVA : [« TVA non applicable, art. 293 B du CGI » tant que la franchise en base s'applique / n° de TVA intracommunautaire FR.. ]
Activité non réglementée : [oui — aucune autorisation ni ordre professionnel requis]

[Variante société : dénomination, forme juridique, capital social, siège, RCS [ville] [numéro],
 numéro de TVA intracommunautaire, représentant légal.]

Directeur de la publication : [Prénom NOM], [qualité]. Contact : [e-mail].

Hébergement
Site hébergé par : Vercel Inc., [adresse à reporter depuis vercel.com/legal — USA] ;
Base de données : Supabase Inc., [adresse], région de données [UE — à confirmer].

Propriété intellectuelle
Les textes, la marque, les visuels et le code du site sont la propriété de l'éditeur [ou utilisés avec autorisation].
Toute reproduction non autorisée est interdite.

Données personnelles
Voir la Politique de confidentialité : [lien /confidentialite].

Contenu généré par IA
Les analyses et recommandations affichées sont produites en partie par des assistants d'intelligence artificielle
et peuvent comporter des erreurs. Voir « Méthode et limites » sur chaque rapport.

Médiation de la consommation
Le service s'adresse à des professionnels. [Si une vente à un consommateur devenait possible : nom et coordonnées du médiateur
de la consommation à insérer — obligation pour les ventes aux consommateurs.]

Signalement d'un contenu / Contact : [e-mail]
Dernière mise à jour : [JJ/MM/AAAA]
```

---

## 3. Modèle de CGV / CGU — Abonnement « Suivi mensuel » (29 €/mois) et « Plan d'action » (149 €)

> **À faire valider.** Points sensibles signalés en **[À VÉRIFIER]**. Le texte est rédigé pour des **professionnels (B2B)**.
> Un professionnel de ≤ 5 salariés qui achète hors de son activité principale peut bénéficier de règles du Code de la consommation,
> notamment le droit de rétractation pour les contrats conclus **hors établissement** (art. L.221-3). Un démarchage à froid peut
> déclencher ce cas : par prudence, **le modèle accorde 14 jours de rétractation à tous** **[À VÉRIFIER]**.

```
CONDITIONS GÉNÉRALES DE VENTE ET D'UTILISATION — AuditIA Local
Version [1.0] — en vigueur au [JJ/MM/AAAA]

1. Identité et objet
Les présentes conditions régissent l'accès au service AuditIA Local, édité par [Prénom NOM / Raison sociale],
[forme], SIREN [..], [adresse] (« l'Éditeur »), par tout professionnel (« le Client »).
AuditIA Local mesure dans quelle mesure l'établissement du Client est cité par des assistants d'intelligence
artificielle (ChatGPT, Gemini, Perplexity, etc.) en réponse à des questions types de clients, et propose des recommandations.

2. Offres et prix
a) Audit gratuit : score de visibilité IA et rapport synthétique, sans engagement ni paiement.
b) Suivi mensuel : 29 € par mois [TVA non applicable, art. 293 B du CGI / HT, TVA en sus au taux en vigueur].
   Comprend : audit renouvelé chaque mois, évolution du score, alertes, suivi des concurrents cités.
c) Plan d'action : 149 € [TVA ..], paiement unique. Comprend : un document de recommandations personnalisées,
   livré par voie électronique sous [48 h ouvrées] après paiement.
Les prix peuvent évoluer ; tout changement du prix de l'abonnement est notifié [30 jours] avant et permet de résilier sans frais.

3. Nature de nos engagements — OBLIGATION DE MOYENS
L'Éditeur est tenu d'une obligation de moyens. Il ne garantit en aucun cas un classement, une citation, un nombre
de clients ou un chiffre d'affaires. Les assistants IA sont des services tiers, non contrôlés par l'Éditeur, dont les réponses
varient d'une interrogation à l'autre et dans le temps. Les scores et recommandations sont des indications, pas des certitudes.
Voir la mention « Méthode et limites » jointe à chaque rapport.

4. Commande et compte
Le contrat est conclu à la validation de la commande et au paiement. Le Client déclare agir à titre professionnel,
avoir la capacité de contracter, et fournir des informations exactes. L'accès se fait par lien de connexion envoyé par e-mail.

5. Paiement
Paiement en ligne par carte via notre prestataire de paiement Stripe. L'abonnement est prélevé chaque mois à date anniversaire.
En cas d'échec de paiement, l'accès peut être suspendu après relance.
[Mentions B2B obligatoires sur facture : pénalités de retard au taux de [3 fois le taux d'intérêt légal / 10 %] et indemnité forfaitaire
de recouvrement de 40 € (art. L.441-10 Code de commerce) — À VÉRIFIER.] Une facture est mise à disposition dans l'espace client.

6. Durée, renouvellement, résiliation
Le Suivi mensuel est conclu pour un mois, reconduit tacitement de mois en mois.
Le Client peut résilier à tout moment, en ligne depuis son espace client en [3 clics maximum], ou par e-mail à [adresse].
La résiliation prend effet à la fin de la période mensuelle déjà payée ; aucun remboursement prorata temporis sauf mention contraire
à l'article 7. Aucun frais de résiliation. Les données de l'espace client sont conservées [30 jours] après résiliation, puis supprimées
(sauf obligations légales).
L'Éditeur peut résilier avec un préavis de [30 jours] ou immédiatement en cas de manquement grave (paiement, usage abusif, fraude).

7. Droit de rétractation et satisfaction
Le Client dispose de 14 jours à compter de la commande pour se rétracter sans motif, en écrivant à [adresse].
Pour le Plan d'action, le Client qui demande une livraison immédiate reconnaît que, une fois le document livré,
le droit de rétractation est perdu [À VÉRIFIER : formalisme de la renonciation — art. L.221-25].
[Option commerciale : premier mois remboursé si le Client n'est pas satisfait sous 14 jours.]

8. Utilisation du service
Licence personnelle, non exclusive, non transférable, pour les besoins propres du Client. Il est interdit de revendre les rapports,
de les publier en les attribuant à l'Éditeur de façon trompeuse, d'extraire massivement les données, ou d'utiliser le service pour nuire
à un tiers ou à un concurrent.

9. Propriété intellectuelle
L'Éditeur reste propriétaire du service, du code, des méthodes et des marques. Le Client reçoit un droit d'usage de ses rapports.

10. Données personnelles
Voir la Politique de confidentialité. Chaque partie respecte le RGPD pour les données qu'elle traite.

11. Responsabilité
L'Éditeur n'est responsable que des dommages directs, prévisibles et prouvés, résultant d'une faute de sa part. Sa responsabilité totale
est plafonnée aux sommes versées par le Client au cours des [12] derniers mois [la limitation ne s'applique pas en cas de faute lourde, de dol,
ni de dommage corporel — À VÉRIFIER]. L'Éditeur n'est pas responsable de la perte de chiffre d'affaires, de clients ou d'image, ni des
indisponibilités ou changements de services tiers (assistants IA, hébergeur, paiement), ni des décisions prises à partir des rapports.

12. Disponibilité et évolution
Le service est fourni « en l'état », sans garantie de disponibilité continue. Les fonctionnalités et les fournisseurs d'IA peuvent évoluer.

13. Force majeure
Conformément à l'article 1218 du Code civil, y compris la défaillance d'un fournisseur tiers indépendant de la volonté de l'Éditeur.

14. Modification des conditions
Les CGV applicables sont celles en vigueur à la date de la commande. En cas de modification, les abonnés sont informés [30 jours] avant.

15. Droit applicable et litiges
Droit français. Les parties recherchent d'abord une solution amiable ([e-mail]). À défaut, compétence du tribunal de commerce de [Paris]
[À VÉRIFIER : une clause attributive de compétence n'est opposable qu'entre commerçants ; un artisan ou une profession libérale peut ne pas
 en relever].
```

> **Prévoir aussi** : case à cocher non pré-cochée « J'ai lu et j'accepte les CGV » avant paiement, et **conservation de la preuve** d'acceptation (date, version, IP). Pas de CGV = pas de contrat prouvable.

---

## 4. Modèle de politique de confidentialité (page `/confidentialite`)

> RGPD (règlement UE 2016/679). À faire valider. **Constats de ce document :** (1) on traite surtout des **données d'entreprises**, qui deviennent des **données personnelles** quand l'établissement est un EI ou que le nom du dirigeant apparaît ;
> (2) on envoie des **noms de commerces** à des fournisseurs d'IA situés hors UE (transferts) ;
> (3) l'interrogation d'une IA sur « Plomberie Dupont » ne doit **pas** envoyer de données de clients du commerce.

```
POLITIQUE DE CONFIDENTIALITÉ — AuditIA Local   (mise à jour : [JJ/MM/AAAA])

1. Responsable du traitement
[Prénom NOM / Raison sociale], SIREN [..], [adresse], contact : [e-mail]. Pas de délégué à la protection des données (DPO) désigné [non obligatoire à notre taille].

2. Quelles données, pourquoi, sur quelle base légale, combien de temps ?
| Traitement | Données | Finalité | Base légale | Durée |
|---|---|---|---|---|
| Audit gratuit demandé par le visiteur | nom du commerce, métier, ville, site, e-mail | réaliser et envoyer l'audit | consentement / mesures précontractuelles | 12 mois, puis suppression ou anonymisation |
| Abonnement et plan d'action | identité, e-mail, facturation, historique d'audits | exécuter le contrat | contrat | durée du contrat, puis 5 ans (prescription), factures 10 ans |
| Prospection B2B | nom du commerce, métier, ville, SIREN, e-mail pro/téléphone pro publiés, source | proposer un audit en rapport avec l'activité | intérêt légitime (art. 6.1.f) | 3 ans après le dernier contact [À VÉRIFIER], opposition immédiate |
| Liste d'opposition | e-mail ou téléphone (hashé), date | respecter votre refus | obligation légale / intérêt légitime | conservée tant que nécessaire |
| Sécurité et journaux | adresse IP, logs | sécurité du service | intérêt légitime | 12 mois maximum |
| Paiement | via Stripe ; nous ne conservons pas le numéro de carte | encaisser | contrat | selon Stripe |

3. D'où viennent les données ?
De vous (formulaires) ou de sources publiques : annuaire des entreprises / Sirene (INSEE) et informations publiées par le commerce lui-même
(site, e-mail professionnel de contact). Nous ne collectons pas de données de Google Maps en dehors des conditions de l'API.
Nous n'utilisons aucune donnée sensible.

4. Destinataires et sous-traitants
Vercel (hébergement), Supabase (base de données, [région UE]), Stripe (paiement), Resend (e-mails),
et fournisseurs d'IA (OpenAI, Google, Perplexity, Anthropic) auxquels nous envoyons le **nom commercial, le métier et la ville** pour obtenir les réponses.
Nous ne leur envoyons pas de données de clients. Accords de sous-traitance (DPA) signés [À FAIRE avant lancement].

5. Transferts hors Union européenne
Certains prestataires sont situés aux États-Unis. Les transferts reposent sur [le Data Privacy Framework UE-États-Unis / les clauses contractuelles types]. [À VÉRIFIER pour chaque prestataire.]

6. Décision automatisée
Le score est calculé automatiquement mais n'a aucun effet juridique ni ne vous prive d'un droit ; un humain peut réexaminer sur demande.

7. Vos droits
Accès, rectification, effacement, limitation, opposition (y compris à la prospection, sans motif), portabilité, directives post-mortem.
Écrivez à [e-mail] ; réponse sous 1 mois. Pour supprimer un audit vous concernant : [lien]. Vous pouvez introduire une réclamation auprès de la CNIL : www.cnil.fr.

8. Cookies et traceurs
Le site n'utilise que des cookies strictement nécessaires (session de connexion). [Si une mesure d'audience est ajoutée : outil exempté de consentement
configuré selon les recommandations CNIL (ex. Matomo / Plausible), sinon bandeau de consentement.]

9. Sécurité et violation
Chiffrement en transit, accès restreint, sauvegardes. En cas de violation à risque, notification à la CNIL sous 72 h.
```

**Obligations internes associées :** tenir un **registre des traitements** (art. 30) ; faire signer/accepter les **DPA** des sous-traitants ; mettre en place la **purge automatique** (cron) ; documenter l'**analyse d'intérêt légitime** (1 page : finalité, nécessité, mise en balance) **[À VÉRIFIER avec un juriste]**.

---

## 5. Avertissement « Méthode et limites » (à afficher sur chaque rapport, web et PDF)

> **Rédaction courte (en pied de page) :**
> « Ce rapport indique si des assistants IA citent votre établissement quand on leur pose des questions types. Il ne juge pas la qualité de votre travail. »

> **Version complète (encart « Méthode et limites ») :**
>
> **Comment ce score est calculé.** Nous avons posé [N] questions types d'un client potentiel (ex. « meilleur [métier] [ville] ») à [liste des IA utilisées], [R] fois chacune, le [date]. Le score reflète la fréquence et la position de la citation de votre établissement dans ces réponses. Niveau de confiance : [faible / moyenne / bonne].
>
> **Ce qu'il ne dit pas.**
> - Les réponses des IA **varient** d'une fois à l'autre, selon l'utilisateur, l'heure et la version du modèle. Ce score est un **instantané**, pas une vérité.
> - Le résultat n'est **pas une évaluation** de la qualité, de la fiabilité ou de la réputation de votre commerce ni de ses concurrents.
> - Les IA **peuvent se tromper** (nom, adresse, activité). Les concurrents mentionnés sont ceux **cités par les IA**, sans que nous les ayons évalués.
> - Les vrais comportements de vos clients (recherche Google, bouche-à-oreille) ne sont pas mesurés.
> - Ce rapport et les recommandations ont été **produits avec l'aide de l'intelligence artificielle** et ne constituent pas un conseil juridique, financier ou professionnel. **Aucun résultat n'est garanti.**
>
> **Mode démo.** [Si `demo = true` : « Ces données sont des exemples simulés, pas une mesure réelle. »]
>
> **Une erreur ? Un souhait de retrait ?** Écrivez à [e-mail] ou cliquez : [lien de contestation / suppression].

---

## 6. Statut de départ conseillé (micro-entreprise) — seuils 2026

Source : [Legifiscal](https://www.legifiscal.fr/actualites-fiscales/4436-nouveaux-seuils-micro-entreprises-annee-2026.html) (secondaire) **[À VÉRIFIER sur economie.gouv/impots.gouv avant de signer]**.

| Sujet | Seuil / règle |
|---|---|
| Micro-entreprise, prestations de services (BIC/BNC), 2026-2028 | **83 600 € HT de CA annuel** (77 700 € avant) |
| Micro, vente de marchandises | 203 100 € |
| Franchise en base de TVA, services, 2026 | **37 500 €** (seuil de base) / **41 250 €** (seuil majoré) |
| Dépassement du seuil majoré | TVA due **dès le premier jour** du dépassement |
| Dépassement du seuil de base | Perte de la franchise au 1er janvier suivant |

**Recommandation de départ.** Commencer en **micro-entreprise avec franchise de TVA** : zéro comptabilité lourde, charges proportionnelles au CA, test du marché sans coût fixe. Facturer « TVA non applicable, art. 293 B du CGI ».
**Alerte :** 37 500 € de CA de services ≈ **108 abonnés** à 29 €/mois toute l'année. Au-delà, la TVA (20 %) s'applique : prix à anticiper (29 € → 24,17 € HT si on l'absorbe).
**Passer en société (SASU/EURL)** quand le CA approche **~60-70 k€** ou en cas de besoin de lever, de protéger le patrimoine ou de recruter.
**À prévoir dès le lancement :** déclaration d'activité sur le guichet unique, **compte bancaire dédié** à l'activité, **assurance RC Pro** (recommandée), **facturation électronique** : calendrier d'obligation pour les micro-entreprises **[À VÉRIFIER]**. Taux de cotisations à vérifier sur autoentrepreneur.urssaf.fr.

---

## 7. AI Act (règlement européen sur l'IA)

Source : [DPO Consulting](https://www.dpo-consulting.com/fr-fr/blog/ai-act-ce-que-le-digital-omnibus-change-reellement-pour-les-entreprises-) (secondaire, qui présente le « Digital Omnibus », règlement 2026/1744, comme adopté) **[À VÉRIFIER sur EUR-Lex]**.

- **Les obligations de transparence de l'art. 50 s'appliquent depuis le 2 août 2026** ; les règles « haut risque » sont reportées à décembre 2027/août 2028.
- **AuditIA n'est pas un système à haut risque** : il mesure des citations de commerces, ne note pas de personnes, ne fait ni recrutement, ni crédit, ni biométrie.
- **Obligations réalistes :** (1) **dire clairement que les analyses sont produites avec l'IA** (fait : §5) ; (2) si on ajoute un **chatbot**, informer l'utilisateur qu'il parle à une IA ; (3) **« maîtrise de l'IA » (art. 4)** : se former et documenter l'usage de l'IA par l'équipe (un fondateur solo : une note de 1 page) ; (4) ne pas publier de **contenu généré par IA donnant l'illusion d'un humain** (faux témoignages, faux avis : interdit aussi au titre des pratiques commerciales trompeuses).
- Nous sommes **déployeurs** de modèles tiers (OpenAI, Google, Anthropic, Perplexity) : leurs obligations de fournisseur ne nous incombent pas.

---

## 8. Checklist de lancement

**Avant toute vente (bloquant)**
- [ ] Micro-entreprise créée (SIREN), compte bancaire dédié, RC Pro souscrite
- [ ] Pages `/mentions-legales`, `/cgv`, `/confidentialite` publiées, **relues par un avocat** (1-2 h)
- [ ] Case CGV non pré-cochée avant paiement Stripe ; preuve d'acceptation stockée (date, version, IP)
- [ ] Avertissement « Méthode et limites » présent sur chaque rapport web et PDF
- [ ] Promesses du site vérifiées : aucune garantie de résultat, aucun faux témoignage, aucun faux chiffre ; les données de démo sont étiquetées « démo »
- [ ] Prix affichés avec la mention TVA (293 B) ; factures conformes (mentions obligatoires)
- [ ] Résiliation en ligne en quelques clics, testée

**Avant toute prospection (bloquant)**
- [ ] Source des leads = Sirene / adresses publiées par le commerce ; **aucun scraping Maps**
- [ ] Table `suppression` (liste d'opposition) vérifiée avant chaque envoi
- [ ] Lien de désinscription fonctionnel testé ; mention type (§1.1) dans chaque e-mail
- [ ] Sous-domaine d'envoi dédié, SPF/DKIM/DMARC configurés
- [ ] EI et adresses nominatives : règle E8 appliquée
- [ ] Aucun appel téléphonique à froid sans validation juridique (§1.2)
- [ ] Rapports de prospection : privés, datés, sans jugement, sans publication nominative

**RGPD**
- [ ] Registre des traitements rempli ; analyse d'intérêt légitime rédigée (1 page)
- [ ] DPA/clauses signés ou acceptés : Vercel, Supabase (région UE), Stripe, Resend, OpenAI, Google, Perplexity, Anthropic
- [ ] Purge automatique (3 ans prospects, 12 mois audits sans suite) programmée dans le cron
- [ ] Procédure de réponse aux demandes de droits (modèle de réponse, 30 j max) et page « Contester/supprimer »
- [ ] Pas de traceur soumis à consentement (ou bandeau conforme)
- [ ] Pas de clés API dans le code ; accès base restreints (RLS Supabase)

**Moteur / API**
- [ ] Google Places : uniquement `place_id` stocké, attribution si affichage ; conditions publiques en ligne
- [ ] Aucun contournement des limites ou des conditions des API IA

**Suivi**
- [ ] Surveiller seuil de CA (franchise TVA 37 500 €) chaque trimestre
- [ ] Relire ce document tous les 6 mois et à chaque évolution légale (téléphone, AI Act, facture électronique)

---

## 9. Sources

Consultées directement (lues) :
- CNIL, [Les règles d'or de la prospection par courrier électronique](https://www.cnil.fr/fr/node/84701) (page de 2009, lue : B2B, désinscription)
- Google, [Policies and attributions for Places API](https://developers.google.com/maps/documentation/places/web-service/policies)
- Google, [Maps Platform Terms of Service](https://cloud.google.com/maps-platform/terms) (section 3.2.3)
- economie.gouv, [Bloctel professionnels](https://www.economie.gouv.fr/entreprises/bloctel-professionnels-reglementation) (**obsolète, 2018**, non retenu)
- service-public Entreprendre, [P10025](https://entreprendre.service-public.gouv.fr/P10025) (mentions légales du site lui-même, **pas la liste obligatoire**)

Lues, sources secondaires (non officielles) :
- [Leto Legal : CNIL, prospection e-mail/SMS 2026](https://www.leto.legal/news/cnil-communications-electroniques-prospection-regles-2026)
- [Kohen Avocats : acheter une base de prospects (21 mai 2026)](https://kohenavocats.fr/2026/05/21/acheter-base-donnees-prospects-rgpd-cnil-2026/)
- [Kohen Avocats : démarchage téléphonique](https://kohenavocats.fr/?p=2105941)
- [Selectra : démarchage téléphonique 11 août 2026](https://selectra.info/telecom/actualites/marche/demarchage-telephonique-interdit-11-aout-2026-consentement-bloctel)
- [HubSpot FR : démarchage téléphonique 2026](https://blog.hubspot.fr/sales/alternatives-demarchage-telephonique)
- [Eurojuris : règles de la publicité comparative](https://www.eurojuris.fr/articles/les-regles-de-la-publicite-comparative-10594.htm)
- [Legifiscal : seuils micro-entreprise 2026](https://www.legifiscal.fr/actualites-fiscales/4436-nouveaux-seuils-micro-entreprises-annee-2026.html)
- [DPO Consulting : AI Act et Digital Omnibus](https://www.dpo-consulting.com/fr-fr/blog/ai-act-ce-que-le-digital-omnibus-change-reellement-pour-les-entreprises-)

Trouvées par recherche, non lues (à consulter) :
- [LegalPlace : mentions légales](https://www.legalplace.fr/guides/mentions-legales/), [Dougs : mentions légales](https://www.dougs.fr/blog/mentions-legales-modele-conseils-et-points-cles/)
- [CCI Paris IDF : prospection par voie électronique](https://www.entreprises.cci-paris-idf.fr/fiches-pratiques/prospection-commerciale-par-voie-electronique)
- [Economie.gouv : obligations d'envoi de courriels](https://www.economie.gouv.fr/entreprises/obligation-entreprise-envoi-courriel-newsletters)

Textes à consulter sur Légifrance / EUR-Lex pour validation : Code des postes et communications électroniques art. L.34-5 ; Code de la consommation art. L.121-8 et s. (publicité comparative), L.221-3 et L.221-25 (rétractation), L.223-1 et s. (démarchage téléphonique), décret n° 2026-662 ; LCEN art. 6-III ; Code de commerce art. L.441-10 ; RGPD (art. 6, 13-14, 30) ; règlement (UE) 2024/1689 et règlement 2026/1744.

**Points non traités ou non confirmés par mes recherches :** régime exact des EI en prospection e-mail ; application du consentement téléphonique au B2B ; calendrier de facturation électronique pour micro-entreprises ; durées de cache autorisées de la Places API ; conditions d'usage actuelles de chaque API IA.
