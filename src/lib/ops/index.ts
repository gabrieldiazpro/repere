/**
 * @/lib/ops — supervision de Repéré sans service payant : santé, erreurs regroupées, alertes e-mail,
 * garde-fou de coûts, incidents publics (/statut), tableau de bord /admin/ops.
 * Fichier serveur uniquement (le rapporteur d'erreurs navigateur est dans ./client).
 */
export * from './config';
export * from './errors';
export * from './capture';
export * from './heartbeat';
export * from './alerts';
export * from './costs';
export * from './guard';
export * from './health';
export * from './incidents';
export * from './status';
export * from './tick';
export * from './auth';
