/**
 * Pilote automatique — démonstration (comptes démo, entreprises fictives) : un mandat d'exemple, une semaine de
 * séries et de contenus. Tout est étiqueté démo ; aucune action réelle n'est possible (lecture seule côté serveur,
 * simulation dans le navigateur).
 */
import { DEFAULT_CATEGORIES, mandateText, MANDATE_VERSION, type Mandate } from './mandate';
import type { AutopilotJournalEntry, AutopilotState } from './store';

const SITES: Record<string, { name: string; site: string; pages: string[] }> = {
  local: { name: 'Plomberie Martin (entreprise fictive)', site: 'https://plomberie-martin.example', pages: ['/depannage-fuite', '/chauffe-eau', '/contact'] },
  pme: { name: 'Paysia (entreprise fictive)', site: 'https://paysia.example', pages: ['/fonctionnalites', '/integrations', '/securite'] },
  ecommerce: { name: 'Maison Sora (entreprise fictive)', site: 'https://maisonsora.example', pages: ['/collections/the-vert', '/produits/sencha-bio', '/livraison'] },
};

export interface AutopilotView {
  demo: boolean;
  mandate: Mandate | null;
  state: AutopilotState;
  journal: AutopilotJournalEntry[];
}

export function demoAutopilot(businessId: string, segment: 'local' | 'pme' | 'ecommerce', now = new Date()): AutopilotView {
  const s = SITES[segment] ?? SITES.local;
  const day = (d: number, h = 9) => new Date(now.getTime() - d * 86_400_000 + (h - 9) * 3_600_000).toISOString();
  const signedAt = day(12);
  const mandate: Mandate = {
    id: 'mdt_demo_exemple',
    businessId,
    categories: [...DEFAULT_CATEGORIES],
    status: 'active',
    signedAt,
    signedBy: { userId: 'demo', email: 'contact@exemple-demo.example' },
    proof: { version: MANDATE_VERSION, textHash: 'demo-empreinte-exemple', serverAt: signedAt },
    text: mandateText({ businessName: s.name, site: s.site, categories: DEFAULT_CATEGORIES, signerEmail: 'contact@exemple-demo.example', at: signedAt, limits: { series: 20, contents: 2 } }),
    updatedAt: signedAt,
  };
  const state: AutopilotState = {
    businessId,
    series: [
      { csId: 'cs_demo_pilote_1', title: 'Titres trop longs raccourcis', kinds: ['meta.title'], pages: 3, appliedAt: day(5, 7), status: 'verified', baseline: { seo: 71, geo: 64 }, checkedAt: day(1, 6), after: { seo: 74, geo: 65 } },
      { csId: 'cs_demo_pilote_2', title: 'Descriptions manquantes rédigées', kinds: ['meta.description'], pages: 4, appliedAt: day(5, 7), status: 'verified', baseline: { seo: 71, geo: 64 }, checkedAt: day(1, 6), after: { seo: 74, geo: 65 } },
      { csId: 'cs_demo_pilote_3', title: 'Textes alternatifs d’images ajoutés', kinds: ['image.alt'], pages: 2, appliedAt: day(1, 7), status: 'applied', baseline: { seo: 74, geo: 65 } },
      { csId: 'cs_demo_pilote_4', title: 'Fichier llms.txt créé à partir de votre fiche', kinds: ['llms.txt'], pages: 1, appliedAt: day(1, 7), status: 'verified', baseline: { seo: 74, geo: 65 } },
    ],
    contents: [
      { draftId: 'ct_demo_pilote_faq', title: segment === 'ecommerce' ? 'Questions fréquentes sur la livraison' : segment === 'pme' ? 'Questions fréquentes sur l’intégration' : 'Questions fréquentes sur le dépannage', scheduledAt: day(1, 7), publishAt: new Date(new Date(day(1, 7)).getTime() + 72 * 3_600_000).toISOString(), status: 'scheduled' },
      { draftId: 'ct_demo_pilote_zone', title: segment === 'local' ? 'Zone d’intervention' : 'À propos', scheduledAt: day(8, 7), publishAt: day(5, 7), status: 'published', publishedAt: day(5, 7), liveUrl: `${s.site}/${segment === 'local' ? 'zone-intervention' : 'a-propos'}` },
    ],
    lastRunAt: day(1, 7),
    lastRecapAt: day(7, 8),
    guard: null,
    updatedAt: day(1, 7),
  };
  const mk = (i: number, at: string, action: AutopilotJournalEntry['action'], ref: string, detail: string): AutopilotJournalEntry => ({ id: `apj_demo_${i}`, businessId, seq: i, at, actor: { id: action === 'mandate.signed' ? 'demo' : 'mandat:mdt_demo_exemple', role: action === 'mandate.signed' ? undefined : 'mandate' }, action, ref, detail, prevHash: 'demo', hash: 'demo' });
  const journal: AutopilotJournalEntry[] = [
    mk(1, signedAt, 'mandate.signed', mandate.id, `Catégories : ${DEFAULT_CATEGORIES.join(', ')} (exemple)`),
    mk(2, day(8, 7), 'content.scheduled', 'ct_demo_pilote_zone', 'Brouillon créé chez vous, mise en ligne dans 72 h sauf blocage (exemple)'),
    mk(3, day(5, 7), 'series.applied', 'cs_demo_pilote_1', `3 titres raccourcis : ${s.pages.join(', ')} (exemple)`),
    mk(4, day(5, 7), 'series.applied', 'cs_demo_pilote_2', '4 descriptions rédigées à partir du contenu des pages (exemple)'),
    mk(5, day(5, 7), 'content.published', 'ct_demo_pilote_zone', 'Mis en ligne après 72 h sans blocage (exemple)'),
    mk(6, day(1, 7), 'series.applied', 'cs_demo_pilote_3', '6 textes alternatifs (exemple)'),
    mk(7, day(1, 7), 'series.applied', 'cs_demo_pilote_4', 'llms.txt construit avec vos pages et votre fiche (exemple)'),
    mk(8, day(1, 7), 'content.scheduled', 'ct_demo_pilote_faq', 'Brouillon créé chez vous, en relecture 72 h (exemple)'),
  ];
  return { demo: true, mandate, state, journal: journal.reverse() };
}
