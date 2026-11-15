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

## Décisions à prendre par vous (rien n'est engagé tant que vous n'avez pas dit oui)

1. **Offre pilote : l'Accompagné offert 3 mois** — C'EST UNE PROPOSITION. Coût au tarif public : 297 € (Local),
   1 170 € (e-commerce) ou 1 470 € (PME) par pilote, soit au plus 14 700 € de valeur faciale pour 10 PME, et surtout
   votre temps (l'Accompagné inclut du travail fait à la main : fiches, pages, avis). Alternatives : 3 mois d'Essentiel
   (moins de travail manuel, preuve plus faible), ou Accompagné 2 mois. La page /pilotes affiche aujourd'hui « 3 mois
   d'Accompagné » : à changer dans `PILOT_MONTHS` (`src/lib/pilots/validate.ts`) si vous décidez autrement.
2. **Répartition des 10 places** : proposition 4 commerces locaux, 3 PME, 3 e-commerce, au moins 3 villes.
3. **Après les 3 mois** : proposition « aucun prélèvement automatique, choix libre », déjà écrit sur la page.
   Option à décider : remise de lancement pour les pilotes qui restent (par exemple −30 % la première année).
4. **Délai de réponse affiché** : « sous 5 jours ouvrés » (page /pilotes) et « 24 h ouvrées » pour la presse.
5. **Fiche fondateur** : nom, bio de 2-3 phrases vérifiables, photo, LinkedIn (`NEXT_PUBLIC_FOUNDER_*`). Sans elles,
   /presse affiche « [À COMPLÉTER] » : à remplir avant d'envoyer le lien à un journaliste.
6. **Adresse presse** dédiée (presse@…) ou contact@ ?
7. **Envoi de prospection** : domaine secondaire dédié (ex. un sous-domaine d'envoi) et outil d'envoi (votre boîte,
   ou un outil de séquences). Rien n'est branché : les scripts existants (`scripts/write-emails.ts`) préparent des
   brouillons, ils n'envoient rien.
8. **Product Hunt** : y aller ou non (audience anglophone, page à écrire en anglais) — voir le plan, J18.
9. **Mentions** à vérifier par un juriste avant le premier envoi de prospection (voir prospection-email.md §1).
