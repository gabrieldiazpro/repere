/**
 * Export d'une page ou d'un article (tout site, et repli quand la plateforme ne sait pas créer la ressource) :
 * page HTML complète (titre, méta-description, JSON-LD, corps), même contenu en Markdown, et marche à suivre.
 */
import { buildZip } from '../zip';
import { PLATFORM_LABEL, type Platform } from '../types';
import { blocksToHtml, escapeHtml, jsonLdHtml, plainInline } from './render';
import type { PageBlock, PageDraftInput } from './types';

export function blocksToMarkdown(blocks: PageBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === 'h2') return `## ${b.text}`;
      if (b.type === 'h3') return `### ${b.text}`;
      if (b.type === 'ul') return b.items.map((i) => `- ${i}`).join('\n');
      return b.text;
    })
    .join('\n\n');
}

export function standaloneHtml(input: PageDraftInput): string {
  return [
    '<!doctype html>',
    '<html lang="fr">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(input.metaTitle)}</title>`,
    `<meta name="description" content="${escapeHtml(input.metaDescription)}">`,
    jsonLdHtml(input.jsonLd),
    '</head>',
    '<body>',
    '<main>',
    `<h1>${escapeHtml(input.title)}</h1>`,
    blocksToHtml(input.blocks),
    '</main>',
    '</body>',
    '</html>',
  ]
    .filter(Boolean)
    .join('\n');
}

const STEPS: Partial<Record<Platform, string[]>> = {
  wix: [
    'Dans l’éditeur Wix : Pages et menu > + Ajouter une page > Page vierge.',
    'Collez le titre (H1) puis le corps depuis page.md (les intertitres en « Titre 2 »).',
    'Paramètres de la page > SEO : collez le titre et la méta-description ; Données structurées : collez le contenu de jsonld.json.',
    'Gardez la page masquée du menu jusqu’à votre relecture, puis publiez le site.',
  ],
  webflow: [
    'Dans le Designer Webflow : Pages > + Créer une page (adresse : celle indiquée ci-dessous).',
    'Ajoutez un bloc de texte enrichi et collez le corps depuis page.html (sans la balise <h1> si votre modèle l’affiche déjà).',
    'Réglages de la page > SEO : titre et méta-description ; Code personnalisé (avant </head>) : le bloc JSON-LD.',
    'Publiez seulement après relecture.',
  ],
  prestashop: ['Paramètres de la boutique > Trafic et SEO > Pages : utilisez plutôt la connexion PrestaShop (création en page désactivée).'],
};

export function buildPageExport(input: PageDraftInput, cms: Platform | null, now: Date = new Date()): { files: { name: string; content: string }[]; zip: Buffer } {
  const md = `# ${input.title}\n\n${blocksToMarkdown(input.blocks)}\n`;
  const readme = [
    `Contenu préparé par Repéré le ${now.toISOString().slice(0, 10)} — à relire avant mise en ligne.`,
    '',
    `Type : ${input.format === 'article' ? 'article de blog' : 'page'}`,
    `Adresse proposée : /${input.slug}`,
    `Titre de la page (balise title) : ${input.metaTitle}`,
    `Méta-description : ${input.metaDescription}`,
    '',
    'Fichiers :',
    '- page.html : page complète (titre, méta, données structurées, corps) ;',
    '- page.md : le même contenu en Markdown, à coller dans votre éditeur ;',
    '- jsonld.json : données structurées à coller dans le champ prévu (ou avant </head>).',
    '',
    `Marche à suivre${cms ? ` (${PLATFORM_LABEL[cms]})` : ''} :`,
    ...(STEPS[cms ?? 'export'] ?? ['Créez une page à l’adresse indiquée, collez le corps, renseignez le titre et la méta-description, ajoutez le bloc JSON-LD, relisez, publiez.']).map((s, i) => `${i + 1}. ${s}`),
    '',
    'Après la mise en ligne, revenez dans Repéré > Contenus et cliquez sur « J’ai publié la page » en indiquant son adresse : la mesure d’effet (J+30, J+90) démarre.',
  ].join('\n');
  const files = [
    { name: 'page.html', content: standaloneHtml(input) },
    { name: 'page.md', content: md },
    { name: 'jsonld.json', content: `[${input.jsonLd.join(',\n')}]` },
    { name: 'LISEZ-MOI.txt', content: readme },
  ];
  return { files, zip: buildZip(files, now) };
}

export { plainInline };
