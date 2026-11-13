/**
 * Comptes démo : ChangeSets d'EXEMPLE (étiquetés `demo: true`, site fictif « exemple-demo.fr »), en lecture seule.
 * Ils montrent le cycle (proposé, appliqué et vérifié, annulé) sans aucune écriture ni appel extérieur.
 */
import { isDemoBusinessId } from '@/lib/demo-v2';
import type { Change, ChangeSet } from './types';

const SITE = 'https://www.exemple-demo.fr';
const AT = '2026-11-02T09:00:00.000Z';

function ch(id: string, c: Partial<Change> & Pick<Change, 'kind' | 'before' | 'after'>): Change {
  return {
    id,
    target: { url: `${SITE}/` },
    patch: { op: 'set', value: c.after ?? '' },
    beforeSource: 'platform',
    rationale: 'Exemple de démonstration.',
    risk: 'low',
    generatedBy: 'rules',
    status: 'pending',
    ...c,
  };
}

export function demoChangeSets(businessId: string): ChangeSet[] {
  if (!isDemoBusinessId(businessId)) return [];
  const base = { businessId, site: SITE, createdAt: AT, createdBy: { id: 'agent' }, demo: true, version: 1, updatedAt: AT } as const;
  return [
    {
      ...base,
      id: 'cs_demo_title',
      platform: 'wordpress',
      title: '[Démo] 3 pages ont un titre trop vague',
      origin: { findingId: 'seo.title.too_short', severity: 'high' },
      risk: 'low',
      status: 'proposed',
      proposedAt: AT,
      changes: [
        ch('ch_demo_1', { kind: 'meta.title', before: 'Accueil', after: 'Exemple démo, artisan à Exempleville | Exemple démo' }),
        ch('ch_demo_2', { kind: 'meta.description', before: '', after: 'Page d’exemple affichée en démonstration : aucune donnée réelle, aucune modification enregistrée.' }),
      ],
    },
    {
      ...base,
      id: 'cs_demo_llms',
      platform: 'export',
      title: '[Démo] Le site n’a pas de fichier llms.txt',
      origin: { findingId: 'geo.llms.missing', severity: 'medium' },
      risk: 'low',
      status: 'verified',
      proposedAt: AT,
      validation: { by: { id: 'demo', role: 'owner' }, at: AT },
      appliedAt: AT,
      verifiedAt: AT,
      exportBundle: true,
      changes: [
        ch('ch_demo_3', {
          kind: 'llms.txt',
          target: { url: `${SITE}/llms.txt` },
          before: null,
          after: '# Exemple démo\n\n> Site d’exemple de la démonstration Repéré.\n\n## Pages principales\n\n- [Accueil](https://www.exemple-demo.fr/)\n',
          status: 'verified',
          verification: [{ ok: true, method: 'page', detail: 'Exemple : llms.txt en ligne et conforme.', at: AT }],
        }),
      ],
    },
  ];
}
