# Lancement de Repéré : le dossier du fondateur

Rédigé le 15 novembre 2026 par l'agent LANCEMENT. Repéré n'a ni client ni chiffre de traction : tout ce dossier est
écrit pour un lancement **sans faux témoignage, sans faux logo, sans chiffre inventé**. Les seuls chiffres publics
autorisés sont ceux de la méthode (code) et des études publiques citées sur `/etudes/ce-que-nous-savons-deja`.

## Ce qui est en place dans le site (prêt, à mettre en ligne avec le reste)

| Élément | Où | Ce que ça fait |
|---|---|---|
| Page **/pilotes** | `app/src/app/pilotes/` | « Repéré se lance : nous cherchons 10 entreprises pilotes ». Compteur de places réel (lit les candidatures « retenue » et « active »), ce qu'on donne, ce qu'on demande, critères, déroulé J0/J30/J90, formulaire, FAQ. |
| Formulaire de candidature | `POST /pilotes/candidature` | Champ piège anti-robot, 5 candidatures/heure et 20/jour par connexion, même origine, consentement obligatoire (texte conservé avec la date), doublons (même e-mail + même domaine sous 30 jours) non recréés. |
| Notification | `src/lib/pilots/notify.ts` | E-mail au fondateur à chaque candidature, via Resend comme les autres e-mails. Destinataire : `PILOTS_NOTIFY_EMAIL`, sinon `EMAIL_REPLY_TO`, sinon l'adresse de contact. |
| Admin **/admin/pilotes** | `app/src/app/admin/pilotes/` | Liste, statut (à étudier / retenue / refusée / active), notes internes, rattachement de l'espace Repéré, tableau J0/J30/J90 tiré des vraies mesures (analyses du site + audits IA), écart avec la mention « dans / au-delà des marges d'erreur ». |
| Page **/presse** | `app/src/app/presse/` | Présentation en 3 phrases, chiffres vérifiables (185 contrôles SEO, 12 familles, 8 familles GEO, 60 pages en 45 s, 5 IA — lus dans le code), 3 chiffres d'études publiques sourcés, fondateur (champs `NEXT_PUBLIC_FOUNDER_*`), contact presse, logos SVG vectorisés et 3 captures de la vraie app démo. |

Variables d'environnement nouvelles (facultatives) : `PILOTS_NOTIFY_EMAIL` (où recevoir les candidatures),
`NEXT_PUBLIC_PRESS_EMAIL` (adresse presse affichée ; sinon l'adresse de contact).

## Les fichiers de ce dossier

1. [plan-30-jours.md](plan-30-jours.md) : le plan jour par jour, du J-7 au J30.
2. [prospection-email.md](prospection-email.md) : règles CNIL vérifiées sur cnil.fr, séquences e-mail par parcours.
3. [linkedin.md](linkedin.md) : profil, publications, messages de connexion et de suivi.
4. [script-appel.md](script-appel.md) : appel de 5 minutes, messagerie, rappel.
5. [objections.md](objections.md) : les 14 objections probables et quoi répondre, sans promesse.
6. [kpi.md](kpi.md) : les indicateurs à suivre chaque semaine, d'où les lire, les seuils d'alerte.

## Décisions (prises le 23 nov. 2026, docs/v10/DECISIONS.md)

1. **Offre pilote : l'Accompagné offert 3 mois — DÉCIDÉ.** Valeur au tarif public : 297 € (Local), 1 170 €
   (e-commerce) ou 1 470 € (PME) par pilote, soit 10 422 € de valeur faciale pour les 10 places (4 × 297 + 3 × 1 470 +
   3 × 1 170), surtout du temps (fiches, pages, avis). Code : `PILOT_MONTHS`, `PILOT_SLOTS_BY_SEGMENT`
   (`src/lib/pilots/validate.ts`) ; /pilotes affiche les places restantes par parcours.
2. **Répartition des 10 places — DÉCIDÉ** : 4 commerces locaux, 3 PME, 3 e-commerce, au moins 3 villes.
3. **Après les 3 mois** : aucun prélèvement automatique, choix libre (écrit sur la page). Avant/après publiable
   **seulement avec l'accord écrit** du pilote. Remise de lancement pour les pilotes qui restent : non décidée.
4. **Délai de réponse affiché** : « sous 5 jours ouvrés » (page /pilotes) et « 24 h ouvrées » pour la presse.
5. **Fiche fondateur** : nom, bio de 2-3 phrases vérifiables, photo, LinkedIn (`NEXT_PUBLIC_FOUNDER_*`). Sans elles,
   /presse affiche « [À COMPLÉTER] » : à remplir avant d'envoyer le lien à un journaliste.
6. **Adresse presse** dédiée (presse@…) ou contact@ ?
7. **Envoi de prospection — DÉCIDÉ : Brevo, offre gratuite** (société française, données hébergées dans l'UE ; à
   créer par vous) avec un **domaine d'envoi secondaire dédié** (ex. `repere-mail.fr`, jamais le domaine du site) pour
   protéger la réputation du domaine principal : SPF, DKIM et DMARC (`p=none` puis `quarantine`) sur ce domaine, chauffe
   progressive (plan, J-6), au plus 20 à 30 messages par jour au début. L'offre gratuite de Brevo plafonne les envois
   quotidiens et ajoute sa mention dans les messages : vérifiez les limites du moment sur brevo.com/pricing avant de
   commencer. Rien n'est branché : `scripts/write-emails.ts` prépare des brouillons, il n'envoie rien.
8. **Product Hunt — DÉCIDÉ : oui, à J18 du plan**, en anglais, une fois les premiers pilotes actifs (page, captures
   de la démo avec la mention « fictitious company », lancement un mardi ou mercredi).
10. **Publicité Meta — DÉCIDÉ : seulement après la preuve organique** que /analyse convertit (seuil dans kpi.md), et
    avec le pixel chargé uniquement après consentement (bandeau de consentement à brancher avant).
11. **Agenda de démo** : Cal.com, offre gratuite (compte à créer par vous, `NEXT_PUBLIC_BOOKING_URL`) ; d'ici là, le
    formulaire /rendez-vous.
9. **Mentions** à vérifier par un juriste avant le premier envoi de prospection (voir prospection-email.md §1).
