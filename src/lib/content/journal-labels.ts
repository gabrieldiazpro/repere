/** Libellés du journal de l'agent de contenu : module sans dépendance serveur (importable par les composants client). */
export type ContentAction =
  | 'drafted'
  | 'edited'
  | 'validated'
  | 'rejected'
  | 'remote.created'
  | 'remote.failed'
  | 'published'
  | 'unpublished'
  | 'removed'
  | 'exported'
  | 'declared_live'
  | 'effect.measured'
  | 'mention.updated'
  | 'facts.updated';

export const CONTENT_ACTION_LABEL: Record<ContentAction, string> = {
  drafted: 'Brouillon rédigé',
  edited: 'Brouillon modifié',
  validated: 'Validé',
  rejected: 'Écarté',
  'remote.created': 'Créé en brouillon sur le site',
  'remote.failed': 'Échec chez la plateforme',
  published: 'Mis en ligne',
  unpublished: 'Retiré de la ligne',
  removed: 'Mis à la corbeille',
  exported: 'Exporté',
  declared_live: 'Adresse publique déclarée',
  'effect.measured': 'Effet mesuré',
  'mention.updated': 'Suivi de mention',
  'facts.updated': 'Faits clés mis à jour',
};
