/**
 * Événements de webhook documentés pour l'API publique (sans dépendance : importable partout, y compris la page
 * /developpeurs). Ils passent par le système d'intégrations existant (src/lib/integrations : webhook signé
 * HMAC-SHA256, file avec reprises, journal des livraisons) — aucun second système d'envoi.
 */
export const WEBHOOK_EVENTS = ['audit.completed', 'score.dropped', 'proposal.pending'] as const;
export type PublicWebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_EVENT_DOCS: Record<PublicWebhookEvent, { label: string; description: string; example: Record<string, unknown> }> = {
  'audit.completed': {
    label: 'Nouvelle mesure',
    description: 'Une mesure des IA est terminée : nouveau score, avec sa marge.',
    example: {
      id: 'dl_8c1f…',
      event: 'audit.completed',
      createdAt: '2026-11-22T08:12:00.000Z',
      businessId: 'esp_…',
      data: { title: 'Nouvelle mesure : 61/100', body: 'Les réponses des IA ont été relevées.', url: 'https://…/app', severity: 'info' },
    },
  },
  'score.dropped': {
    label: 'Score en baisse au-delà de la marge',
    description:
      'Le score de visibilité dans les IA baisse ET l’intervalle à 90 % de la nouvelle mesure ne chevauche plus celui de la mesure comparable précédente : la baisse dépasse la marge d’erreur. Une baisse dans la marge ne déclenche rien.',
    example: {
      id: 'dl_31aa…',
      event: 'score.dropped',
      createdAt: '2026-11-22T08:12:01.000Z',
      businessId: 'esp_…',
      data: { title: 'Score en baisse : 52 → 41', url: 'https://…/app', severity: 'important', from: { score: 52, low: 47, high: 57 }, to: { score: 41, low: 36, high: 45 }, delta: -11, measurementId: 'aud_…' },
    },
  },
  'proposal.pending': {
    label: 'Proposition de l’agent à valider',
    description: 'L’agent a préparé des corrections : elles attendent la validation d’un humain dans l’app (l’API ne valide rien).',
    example: {
      id: 'dl_77b2…',
      event: 'proposal.pending',
      createdAt: '2026-11-22T09:00:00.000Z',
      businessId: 'esp_…',
      data: { title: '2 corrections proposées par l’agent, à valider', url: 'https://…/app/agent', severity: 'info', pending: 2, proposalIds: ['cs_…', 'cs_…'] },
    },
  },
};
