# Scripts de prospection

Chaîne : `build-leads` -> `batch-audit` -> (saisie manuelle des e-mails) -> `write-emails` -> relecture -> envoi MANUEL.
Aucun script n'envoie quoi que ce soit. Sans `tsx` (non installé) : `node --experimental-strip-types` (Node 22).

```bash
cd app
node --experimental-strip-types scripts/build-leads.ts --naf 43.22A --cp 75011 --limit 200
#   -> .data/leads-43.22A-75011.csv   (GOOGLE_PLACES_KEY optionnelle : site, téléphone, place_id)
node --experimental-strip-types scripts/batch-audit.ts .data/leads-43.22A-75011.csv --limit 10
#   -> .data/audited-43.22A-75011.csv (score, fourchette, concurrents, rapport_url). Option : --api http://localhost:3000
#   Complétez à la main email_generique + email_source_url (mentions légales du site du commerce).
UNSUBSCRIBE_SECRET="..." SENDER_NAME="..." SENDER_ADDRESS="..." SENDER_SIREN="..." SENDER_EMAIL="..." SITE_URL="https://..." \
node --experimental-strip-types scripts/write-emails.ts .data/audited-43.22A-75011.csv
#   -> .data/emails-*.csv + .data/eml/*.eml (brouillons)
```

Console : `/admin?token=<ADMIN_TOKEN>` (ou cookie `admin_token`) : leads, audits, bouton d'audit, export CSV, entonnoir.

## Notes techniques
- API Recherche d'entreprises : appel réel non testé (proxy de dev : refusé). Paramètres utilisés : `code_postal`, `activite_principale`, `etat_administratif=A`, `per_page=25`. À valider sur https://recherche-entreprises.api.gouv.fr/docs/.
- `batch-audit` en mode direct importe le moteur par chemin relatif ; si le moteur utilise l'alias `@/`, utilisez `--api` (serveur Next lancé).
- `--api` : exportez `ADMIN_TOKEN` (envoyé en `x-admin-token`, exempté de la limite par IP mais pas des plafonds globaux). `--allow-demo` : tests locaux, lignes marquées `demo=oui`, ignorées par write-emails.

## Rappel des règles légales (docs/06-juridique.md, docs/09-prospection.md)
1. Jamais de scraping (Google Maps, annuaires, réseaux). Sources : Sirene + Places API officielle + e-mail publié par le commerce.
2. Adresses génériques ou professionnelles publiées par le commerce uniquement ; `email_source_url` obligatoire (preuve).
3. EI : exclus par défaut (règle E8), un seul message après validation humaine.
4. Chaque e-mail : expéditeur identifié, adresse postale, source de l'adresse, STOP + lien de désinscription, mention RGPD.
5. Opposition traitée sous 24 h : lien signé `/desinscription` (UNSUBSCRIBE_SECRET requis, même valeur que le site) ; `.data/suppression.txt` (SHA-256 en minuscules, export de la table `suppression` de moins de 24 h avec Supabase) et `.data/suppression.json` (démo) vérifiés avant chaque génération.
6. Jamais d'audit `demo`. Concurrents « cités par l'IA », ton factuel, aucun jugement. Maximum 4 messages par prospect.
7. Domaine d'envoi secondaire (SPF/DKIM/DMARC), warm-up, 30 mails/jour maximum, pas via Resend. Pas d'appel à froid en V1.
8. Métiers réglementés (santé, avocats, notaires, comptables, architectes) refusés.
9. Places : données stockées localement uniquement pour la prospection ; ne pas les republier (conditions Google, G2).
