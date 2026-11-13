/**
 * Comptes démo : parcours complet de l'agent, SIMULÉ et étiqueté (aucune écriture serveur, aucun appel extérieur).
 * Cohérent avec les actions des 3 comptes démo (Centre d'actions) : balisage schema.org (t3), FAQ citable (t4),
 * plus un titre trop vague, un robots.txt déjà corrigé (effet mesuré) et une modification annulée (journal).
 * Les valeurs « avant » et « après » sont des EXEMPLES construits à partir de la fiche de vérité démo.
 */
import type { ExecTask, Segment } from '@/lib/engine/types-v2';
import type { PublishConnectionView } from '@/lib/publish/connections';
import type { AgentEffect } from './effect';
import type { Change, ChangeKind, ChangeSet, JournalEntry, Platform } from './model';

export interface DemoAgentInput {
  businessId: string;
  segment: Segment;
  name: string;
  website: string;
  facts: Record<string, unknown>;
  tasks: Pick<ExecTask, 'id' | 'kind' | 'deliverable'>[];
  /** historique du score de visibilité (du plus ancien au plus récent), pour le repère sur la courbe */
  scores: number[];
  now: Date;
}

export interface DemoAgent {
  connections: PublishConnectionView[];
  changeSets: ChangeSet[];
  journal: JournalEntry[];
  effects: Record<string, AgentEffect>;
  /** action du Centre d'actions → proposition de l'agent */
  taskLinks: Record<string, string>;
}

const PLATFORM: Record<Segment, Platform> = { local: 'wordpress', pme: 'wordpress', ecommerce: 'shopify' };

const DAY = 86_400_000;
const ago = (now: Date, days: number, h = 9) => {
  const d = new Date(now.getTime() - days * DAY);
  d.setUTCHours(h, 12, 0, 0);
  return d.toISOString();
};

const f = (facts: Record<string, unknown>, k: string) => (typeof facts[k] === 'string' ? (facts[k] as string) : '');

function change(id: string, site: string, c: Partial<Change> & Pick<Change, 'kind' | 'before' | 'after' | 'risk' | 'rationale'>): Change {
  return {
    id,
    target: { url: `${site}/` },
    patch: { op: 'set', value: c.after ?? '' },
    beforeSource: 'platform',
    generatedBy: 'rules',
    status: 'pending',
    ...c,
  };
}

interface Texts {
  homeTitleBefore: string;
  homeTitleAfter: string;
  homeDescBefore: string;
  homeDescAfter: string;
  faq: { q: string; a: string }[];
  page: string;
}

function texts(seg: Segment, name: string, facts: Record<string, unknown>): Texts {
  if (seg === 'pme') {
    return {
      homeTitleBefore: 'Accueil',
      homeTitleAfter: `Logiciel de paie pour PME | ${name}`,
      homeDescBefore: '',
      homeDescAfter: `${name} : paie, DSN, absences et notes de frais pour les PME de 10 à 250 salariés. ${f(facts, 'prix')}.`,
      faq: [
        { q: `Combien coûte ${name} ?`, a: `${f(facts, 'prix')}.` },
        { q: `${name} gère-t-il la DSN ?`, a: 'Oui : la DSN est générée et déposée chaque mois depuis le logiciel.' },
        { q: 'Combien de temps prend la mise en place ?', a: '[à compléter]' },
      ],
      page: '/fonctionnalites',
    };
  }
  if (seg === 'ecommerce') {
    return {
      homeTitleBefore: 'Shampoing Onde – Maison Sora',
      homeTitleAfter: `Shampoing solide cheveux bouclés, sans sulfates | ${name}`,
      homeDescBefore: 'Découvrez notre shampoing.',
      homeDescAfter: `Shampoing solide pour cheveux bouclés, sans sulfates ni silicones, certifié Cosmos Organic. Livraison ${f(facts, 'livraison').split(';')[0] || 'France et Belgique'}.`,
      faq: [
        { q: 'Livrez-vous en Belgique ?', a: `${f(facts, 'livraison')}.` },
        { q: 'Puis-je retourner un produit ?', a: `${f(facts, 'retours')}.` },
        { q: 'Combien de lavages dure un shampoing solide ?', a: '[à compléter]' },
      ],
      page: '/products/shampoing-solide-onde',
    };
  }
  return {
    homeTitleBefore: 'Accueil - Plomberie Martin',
    homeTitleAfter: `Plombier à Paris 11ᵉ, dépannage et chauffe-eau | ${name}`,
    homeDescBefore: 'Bienvenue sur notre site.',
    homeDescAfter: `${name}, plombier à Paris 11ᵉ depuis ${f(facts, 'creation') || '2009'} : fuites, débouchage, chauffe-eau. ${f(facts, 'prix').split(';')[0]}, devis gratuit.`,
    faq: [
      { q: 'Quels sont vos horaires ?', a: `${f(facts, 'horaires')}.` },
      { q: 'Combien coûte un déplacement ?', a: `${f(facts, 'prix')}.` },
      { q: 'Intervenez-vous dans le 20ᵉ ?', a: '[à compléter]' },
    ],
    page: '/depannage-fuite',
  };
}

function faqBlock(faq: { q: string; a: string }[]): string {
  const html = faq.map((x) => `<h3>${x.q}</h3>\n<p>${x.a}</p>`).join('\n');
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })),
  };
  return `<h2>Questions fréquentes</h2>\n${html}\n<script type="application/ld+json">\n${JSON.stringify(ld, null, 2)}\n</script>`;
}

export function buildDemoAgent(input: DemoAgentInput): DemoAgent {
  const { businessId, segment, name, facts, now } = input;
  const site = `https://${input.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
  const platform = PLATFORM[segment];
  const t = texts(segment, name, facts);
  const schemaTask = input.tasks.find((x) => x.kind === 'schema');
  const ld = [schemaTask, ...input.tasks].map((x) => x?.deliverable?.find((d) => d.type === 'jsonld')?.content).find(Boolean) ?? JSON.stringify({ '@context': 'https://schema.org', '@type': 'Organization', name }, null, 2);
  const base = { businessId, site, createdBy: { id: 'agent' }, demo: true } as const;
  const owner = { id: 'demo', role: 'owner' };

  // JSON-LD : WordPress l'ajoute en fin de contenu ; sur Shopify il passe par le thème → export.
  const ldPlatform: Platform = platform === 'shopify' ? 'export' : platform;
  const cs: ChangeSet[] = [
    {
      ...base,
      id: 'cs_demo_meta_home',
      platform,
      title: segment === 'ecommerce' ? 'La fiche produit phare a un titre trop vague' : 'La page d’accueil a un titre trop vague',
      origin: { findingId: 'seo.title.too_short', findingTitle: 'Titre trop court ou générique', severity: 'high' },
      risk: 'low',
      status: 'proposed',
      createdAt: ago(now, 1),
      proposedAt: ago(now, 1),
      version: 2,
      updatedAt: ago(now, 1),
      changes: [
        change('ch_demo_title', site, { kind: 'meta.title', target: { url: `${site}${segment === 'ecommerce' ? t.page : '/'}` }, before: t.homeTitleBefore, after: t.homeTitleAfter, risk: 'low', rationale: 'Le titre actuel ne dit ni le métier ni le lieu : Google et les IA s’en servent pour comprendre la page.' }),
        change('ch_demo_desc', site, { kind: 'meta.description', target: { url: `${site}${segment === 'ecommerce' ? t.page : '/'}` }, before: t.homeDescBefore || null, after: t.homeDescAfter, risk: 'low', rationale: 'Description absente ou générique : Google en fabrique une à partir du texte de la page.' }),
      ],
    },
    {
      ...base,
      id: 'cs_demo_jsonld',
      platform: ldPlatform,
      title: `La page d’accueil ne décrit pas ${name} en données structurées`,
      origin: { findingId: 'geo.entity.missing', findingTitle: 'Entité absente des données structurées', severity: 'high' },
      risk: 'medium',
      status: 'proposed',
      createdAt: ago(now, 2),
      proposedAt: ago(now, 2),
      version: 2,
      updatedAt: ago(now, 2),
      ...(ldPlatform === 'export' ? { exportBundle: true } : {}),
      changes: [
        change('ch_demo_ld', site, {
          kind: 'jsonld',
          patch: { op: 'append', value: `<script type="application/ld+json">\n${ld}\n</script>` },
          before: null,
          after: `<script type="application/ld+json">\n${ld}\n</script>`,
          risk: 'medium',
          generatedBy: 'finding',
          rationale: 'Bloc tiré de votre fiche de vérité : nom, adresse, activité. Aucune information ajoutée.',
        }),
      ],
    },
    {
      ...base,
      id: 'cs_demo_faq',
      platform: platform === 'shopify' ? 'shopify' : platform,
      title: 'Aucune question fréquente n’est balisée sur le site',
      origin: { findingId: 'geo.content.questions', findingTitle: 'Pas de questions-réponses citables', severity: 'medium' },
      risk: 'medium',
      status: 'proposed',
      createdAt: ago(now, 2, 10),
      proposedAt: ago(now, 2, 10),
      version: 2,
      updatedAt: ago(now, 2, 10),
      changes: [
        change('ch_demo_faq', site, {
          kind: 'faq',
          target: { url: `${site}${t.page}` },
          patch: { op: 'append', value: faqBlock(t.faq) },
          before: null,
          after: faqBlock(t.faq),
          risk: 'medium',
          generatedBy: 'finding',
          rationale: 'Réponses tirées de votre fiche de vérité. Une réponse manque : l’agent ne l’invente pas.',
        }),
      ],
    },
    {
      ...base,
      id: 'cs_demo_robots',
      platform: 'export',
      title: 'Le robot de Perplexity est bloqué par robots.txt',
      origin: { findingId: 'geo.robots.ai_blocked', findingTitle: 'Robot de recherche IA bloqué', severity: 'critical' },
      risk: 'high',
      status: 'verified',
      exportBundle: true,
      createdAt: ago(now, 12),
      proposedAt: ago(now, 12),
      validation: { by: owner, at: ago(now, 11, 8) },
      appliedAt: ago(now, 11, 8),
      verifiedAt: ago(now, 10, 14),
      remeasureJobId: 'job_demo_robots',
      version: 5,
      updatedAt: ago(now, 10, 14),
      changes: [
        change('ch_demo_robots', site, {
          kind: 'robots.txt',
          target: { url: `${site}/robots.txt` },
          before: 'User-agent: *\nDisallow: /wp-admin/\n\nUser-agent: PerplexityBot\nDisallow: /\n',
          after: 'User-agent: *\nDisallow: /wp-admin/\n\nUser-agent: PerplexityBot\nAllow: /\n',
          risk: 'high',
          rationale: 'PerplexityBot ne pouvait lire aucune page : Perplexity ne pouvait pas vous citer. L’entraînement reste au choix.',
          status: 'verified',
          appliedAt: ago(now, 11, 8),
          verification: [{ ok: true, method: 'page', detail: 'Exemple : robots.txt relu en ligne, PerplexityBot autorisé.', at: ago(now, 10, 14) }],
        }),
      ],
    },
    {
      ...base,
      id: 'cs_demo_alt',
      platform,
      title: '6 images n’ont pas de texte alternatif',
      origin: { findingId: 'seo.images.alt', findingTitle: 'Images sans texte alternatif', severity: 'low' },
      risk: 'low',
      status: 'reverted',
      createdAt: ago(now, 24),
      proposedAt: ago(now, 24),
      validation: { by: owner, at: ago(now, 23) },
      appliedAt: ago(now, 23),
      verifiedAt: ago(now, 23),
      revertedAt: ago(now, 21, 16),
      version: 6,
      updatedAt: ago(now, 21, 16),
      changes: [
        change('ch_demo_alt', site, {
          kind: 'image.alt',
          target: { url: `${site}/`, imageSrc: `${site}/images/equipe.jpg` },
          before: '',
          after: segment === 'local' ? 'Julien Martin, plombier, devant le camion de l’entreprise' : segment === 'pme' ? 'Écran du tableau de bord de paie Paysia' : 'Shampoing solide Onde posé sur une serviette',
          risk: 'low',
          rationale: 'Décrit l’image pour Google Images et les lecteurs d’écran.',
          status: 'reverted',
          appliedAt: ago(now, 23),
          revertedAt: ago(now, 21, 16),
        }),
      ],
    },
  ];

  const entry = (c: ChangeSet, seq: number, at: string, action: JournalEntry['action'], extra: Partial<JournalEntry> = {}): JournalEntry => ({
    id: `${c.id}.${String(seq).padStart(5, '0')}`,
    businessId,
    subject: c.id,
    seq,
    at,
    actor: action === 'created' || action === 'proposed' || action.startsWith('change.') || action === 'remeasure.scheduled' || action === 'verified' ? { id: 'agent' } : owner,
    action,
    prevHash: 'demo',
    hash: 'demo',
    ...extra,
  });
  const journal: JournalEntry[] = [];
  for (const c of cs) {
    let s = 0;
    journal.push(entry(c, ++s, c.createdAt, 'created', { detail: `${c.changes.length} modification${c.changes.length > 1 ? 's' : ''} préparée${c.changes.length > 1 ? 's' : ''}` }));
    journal.push(entry(c, ++s, c.proposedAt ?? c.createdAt, 'proposed'));
    if (c.validation) journal.push(entry(c, ++s, c.validation.at, 'validated'));
    if (c.appliedAt) {
      journal.push(entry(c, ++s, c.appliedAt, 'apply.started'));
      for (const ch of c.changes) journal.push(entry(c, ++s, c.appliedAt, 'change.applied', { changeId: ch.id, before: ch.before, after: ch.after }));
      journal.push(entry(c, ++s, c.verifiedAt ?? c.appliedAt, 'verified', { detail: 'Relu en ligne : conforme.' }));
      journal.push(entry(c, ++s, c.appliedAt, 'remeasure.scheduled', { detail: 'Remesure de la page à J+7' }));
    }
    if (c.revertedAt) {
      for (const ch of c.changes) journal.push(entry(c, ++s, c.revertedAt, 'change.reverted', { changeId: ch.id, before: ch.after, after: ch.before, actor: owner }));
      journal.push(entry(c, ++s, c.revertedAt, 'reverted', { detail: 'Texte jugé trop long : retour à l’avant.' }));
    }
  }
  journal.sort((a, b) => b.at.localeCompare(a.at) || b.seq - a.seq);

  // Effet mesuré (robots.txt, appliqué il y a 11 jours) : remesure J+7 faite. Chiffres d'EXEMPLE.
  const scores = input.scores.length ? input.scores : [0];
  const robots = cs.find((c) => c.id === 'cs_demo_robots')!;
  const effects: Record<string, AgentEffect> = {
    [robots.id]: {
      csId: robots.id,
      appliedAt: robots.appliedAt!,
      dueAt: ago(now, 4, 8),
      status: 'done',
      page: { before: 58, after: 74, label: 'Accès des robots IA au site (sur 100)' },
      ai: { questions: 8, provider: 'Perplexity', before: { answers: 24, mentioned: 2 }, after: { answers: 24, mentioned: 4 } },
      curve: { values: scores.map((x) => Math.round(x)), marker: Math.max(0, scores.length - 2), label: `Score de visibilité : ${scores.map((x) => Math.round(x)).join(', ')} ; repère à la publication` },
      demo: true,
    },
    cs_demo_alt: {
      csId: 'cs_demo_alt',
      appliedAt: ago(now, 23),
      dueAt: ago(now, 16),
      status: 'none',
      demo: true,
    },
  };

  const caps: ChangeKind[] = platform === 'shopify' ? ['meta.title', 'meta.description', 'rewrite', 'redirect'] : ['meta.title', 'meta.description', 'image.alt', 'jsonld', 'faq', 'rewrite'];
  const connections: PublishConnectionView[] = [
    {
      platform,
      config: platform === 'shopify' ? { shop: `${input.website.split('.')[0]}.myshopify.com` } : { siteUrl: site },
      hint: platform === 'shopify' ? '…démo' : 'repere-agent · …démo',
      createdAt: ago(now, 30),
      lastTest: {
        ok: true,
        at: ago(now, 1, 7),
        detail: platform === 'shopify' ? 'Exemple : boutique jointe, droits d’écriture produits et contenus présents.' : 'Exemple : connecté en tant qu’Éditeur, extension Rank Math détectée.',
        capabilities: caps,
        info: platform === 'shopify' ? { shop: name } : { seoPlugin: 'rankmath', siteName: name },
      },
    },
  ];

  // Toutes les actions du Centre d'actions qui ont une correction automatique pointent vers leur proposition.
  const taskLinks: Record<string, string> = {};
  for (const x of input.tasks) {
    if (x.kind === 'schema' || x.kind === 'fact_fix') taskLinks[x.id] = 'cs_demo_jsonld';
    else if (x.kind === 'faq_page') taskLinks[x.id] = 'cs_demo_faq';
  }

  return { connections, changeSets: cs, journal, effects, taskLinks };
}
