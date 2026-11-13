# Sauvegardes et restauration

L'offre gratuite de Supabase ne fournit ni restauration à un instant donné (PITR) ni sauvegarde téléchargeable.
Deux options, à choisir avant le premier client payant :

| Option | Coût | Rétention | Effort |
|---|---|---|---|
| **A. Supabase Pro** (sauvegardes quotidiennes incluses, PITR en option) | abonnement Pro (tarif à vérifier sur supabase.com/pricing le jour du choix) | 7 jours | aucun |
| **B. Dump nocturne chiffré** (`.github/workflows/backup.yml`) | stockage objet en offre gratuite (Cloudflare R2 ou Backblaze B2, quotas à vérifier) | à régler (30 jours conseillés) | 30 min |

Les deux peuvent se cumuler : B garde une copie hors de Supabase (résilience au compte).

## Option B : mise en place (une fois)

1. **Clé de chiffrement** (sur votre poste, jamais dans le dépôt) :
   `age-keygen -o repere-backup.key` ; notez la ligne `public key: age1…`. Rangez `repere-backup.key` dans votre
   gestionnaire de mots de passe **et** sur un support hors ligne : sans elle, les sauvegardes sont illisibles.
2. **Stockage** : créez un bucket privé (R2 ou B2) et une clé d'accès limitée à ce bucket. Règle de cycle de vie :
   suppression des objets `daily/` après 30 jours.
3. **Secrets GitHub** (Settings › Secrets and variables › Actions) :
   - `SUPABASE_DB_URL` : Supabase › Project Settings › Database › Connection string › *Session pooler* (mot de passe inclus) ;
   - `AGE_RECIPIENT` : la clé publique `age1…` ;
   - `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.
4. Lancez le workflow « Sauvegarde » à la main (Actions › Sauvegarde › Run workflow) et vérifiez l'objet créé.

Le dump contient les schémas `public` (données) et `auth` (comptes). Le stockage de fichiers Supabase n'est pas utilisé.

## Restauration (à tester une fois par trimestre, sur un projet Supabase de test)

```bash
aws s3 cp s3://<bucket>/daily/<fichier>.sql.gz.age . --endpoint-url <endpoint>
age -d -i repere-backup.key <fichier>.sql.gz.age | gunzip > restore.sql
# Projet de TEST vide, migrations non appliquées (le dump contient le schéma) :
psql "<SUPABASE_DB_URL du projet de test>" -v ON_ERROR_STOP=1 -f restore.sql
```

Vérifications après restauration : `select count(*) from businesses;`, `select count(*) from audits;`,
`select count(*) from documents;`, connexion d'un compte de test, `GET /api/health` (Bearer CRON_SECRET) au vert.
Notez la date du test et sa durée dans le tableau ci-dessous.

| Date du test | Fichier restauré | Durée | Résultat | Par |
|---|---|---|---|---|
| (à compléter) | | | | |

## Ce qui n'est PAS dans la sauvegarde
- Stripe (clients, abonnements, factures) : la source de vérité reste Stripe.
- Resend (journaux d'envoi), Vercel (variables d'environnement : gardez-en une copie chiffrée hors ligne).
- Mode démo (`.data/`) : données de démonstration, non sauvegardées.

## RGPD
Une sauvegarde contient des données de commerces supprimés depuis : elles disparaissent à l'expiration de la
rétention (30 jours). À mentionner dans la politique de confidentialité (« sauvegardes conservées 30 jours »).
