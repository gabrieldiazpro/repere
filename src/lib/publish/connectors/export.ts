/**
 * « Export » : pour les sites sans API (ou les changements qu'une plateforme ne sait pas appliquer), Repéré prépare
 * les fichiers et des instructions pas à pas ; le client les dépose lui-même. Rien n'est écrit à distance.
 * L'archive contient aussi l'état « avant » (dossier `avant/`) pour revenir en arrière.
 * La vérification relit ensuite la page publique (src/lib/publish/verify.ts).
 */
import { tryFetch } from '@/lib/siteaudit/fetch';
import { buildZip } from '../zip';
import { KIND_LABEL, PLATFORM_LABEL, type Change, type ChangeSet, type ConnectInput, type PublishConnector, type ResourceRef, type TestResult } from '../types';

const FILE_KINDS = new Set(['robots.txt', 'llms.txt', 'sitemap.xml']);

export const exportConnector: PublishConnector = {
  platform: 'export',
  kinds: ['meta.title', 'meta.description', 'image.alt', 'jsonld', 'faq', 'redirect', 'canonical', 'robots.txt', 'llms.txt', 'rewrite', 'gbp.description', 'gbp.hours', 'sitemap.xml', 'meta.robots'],
  connect(_input: ConnectInput): ConnectInput {
    return { config: {}, credentials: {} };
  },
  async test(): Promise<TestResult> {
    return { ok: true, detail: 'Aucune connexion nécessaire : Repéré prépare les fichiers à déposer.', capabilities: [...exportConnector.kinds] };
  },
  async locate(): Promise<ResourceRef> {
    return { type: 'site' };
  },
  /** Fichiers : contenu public actuel ; autres : valeur relevée lors de l'exploration. */
  async read(_ctx, change: Change) {
    if (FILE_KINDS.has(change.kind) && change.target.url) {
      const r = await tryFetch(change.target.url, { respectRobots: false, accept: 'text/plain', cache: false });
      return r && r.status === 200 ? r.body : null;
    }
    return change.before;
  },
  async apply() {
    return {};
  },
  async revert() {
    /* rien à distance : les fichiers « avant » sont dans l'archive */
  },
};

function slug(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'page';
}

const csvCell = (s: string | null | undefined) => `"${String(s ?? '').replace(/"/g, '""')}"`;

function pathOf(u: string | undefined): string {
  try {
    return new URL(u ?? '').pathname;
  } catch {
    return u ?? '';
  }
}

/**
 * Pas à pas dans Wix pour ce que l'API ne permet pas (ou que le client préfère faire lui-même). Libellés de l'éditeur
 * Wix en français ; ils peuvent légèrement différer dans Wix Studio.
 */
export const WIX_STEPS: Partial<Record<Change['kind'], string>> = {
  'image.alt': 'Textes d’images (Wix) : dans l’éditeur, cliquez sur l’image, puis sur l’icône Paramètres ; collez la valeur « après » dans « Que représente cette image ? », puis cliquez sur Publier. Pour une image de produit, ouvrez le produit dans Boutique > Produits.',
  faq: 'FAQ (Wix) : ajoutez la section visible dans l’éditeur (Ajouter > Texte, ou l’appli FAQ de Wix) avec exactement ces questions et réponses ; puis, dans Pages et menu > (…) > SEO avancé > Données structurées, ajoutez le bloc JSON-LD de balisage/. Publiez.',
  rewrite: 'Textes (Wix) : dans l’éditeur, double-cliquez sur le bloc de texte de la page, remplacez le passage « avant » par le passage « après », puis cliquez sur Publier.',
  'sitemap.xml': 'Plan du site (Wix) : Wix le génère et le met à jour automatiquement ; vérifiez seulement dans Tableau de bord > Marketing et SEO > Outils SEO que la page n’est pas masquée des moteurs de recherche.',
  'meta.title': 'Balises (Wix) : dans l’éditeur, Pages et menu > (…) à côté de la page > SEO de base ; pour un produit ou un article, ouvrez-le dans le tableau de bord, section « SEO ». Publiez ensuite le site.',
  'meta.description': 'Balises (Wix) : même emplacement que le titre (SEO de base de la page, ou section SEO du produit ou de l’article).',
  canonical: 'URL canonique (Wix) : Pages et menu > (…) > SEO avancé > Balises supplémentaires.',
  'meta.robots': 'Indexation (Wix) : Pages et menu > (…) > SEO de base > « Laisser les moteurs de recherche indexer cette page ».',
  jsonld: 'Données structurées (Wix) : Pages et menu > (…) > SEO avancé > Données structurées > Ajouter un balisage ; collez le contenu JSON (sans les balises script).',
  redirect: 'Redirections (Wix) : Tableau de bord > Marketing et SEO > Outils SEO > Gestionnaire de redirections d’URL > Nouvelle redirection (301).',
  'robots.txt': 'robots.txt (Wix) : Tableau de bord > Marketing et SEO > Outils SEO > Éditeur de robots.txt ; remplacez le contenu par celui du fichier robots.txt.',
  'llms.txt': 'llms.txt (Wix) : si votre tableau de bord propose son édition (Marketing et SEO > Outils SEO), remplacez le contenu par celui du fichier llms.txt ; sinon, connectez Wix avec une clé API pour que l’agent l’écrive lui-même.',
};

/** Fichiers de l'export (texte) + archive ZIP. `cms: 'wix'` ajoute le pas à pas dans l'éditeur Wix. */
export function buildExportBundle(cs: ChangeSet, now: Date = new Date(), opts: { cms?: 'wix' } = {}): { files: { name: string; content: string }[]; zip: Buffer } {
  const files: { name: string; content: string }[] = [];
  const steps: string[] = [];
  const changes = cs.changes.filter((c) => c.status !== 'skipped' && c.after !== null);
  const metas = changes.filter((c) => ['meta.title', 'meta.description', 'image.alt', 'canonical', 'meta.robots'].includes(c.kind));
  if (metas.length) {
    files.push({
      name: 'balises.csv',
      content: ['page;element;image;avant;apres', ...metas.map((c) => [csvCell(c.target.url), csvCell(KIND_LABEL[c.kind]), csvCell(c.target.imageSrc), csvCell(c.before), csvCell(c.after)].join(';'))].join('\n'),
    });
    steps.push('Ouvrez balises.csv : pour chaque page, remplacez la valeur « avant » par la valeur « après » dans votre outil d’édition (champ SEO de la page, texte alternatif de l’image, URL canonique, consigne d’indexation).');
  }
  const redirects = changes.filter((c) => c.kind === 'redirect');
  if (redirects.length) {
    files.push({ name: 'redirections/.htaccess', content: redirects.map((c) => `Redirect 301 ${c.target.path} ${c.after}`).join('\n') + '\n' });
    files.push({ name: 'redirections/_redirects', content: redirects.map((c) => `${c.target.path} ${c.after} 301`).join('\n') + '\n' });
    files.push({ name: 'redirections/redirections.csv', content: ['source;cible', ...redirects.map((c) => `${csvCell(c.target.path)};${csvCell(c.after)}`)].join('\n') });
    steps.push('Redirections : Apache → ajoutez le contenu de redirections/.htaccess à votre .htaccess ; Netlify/Cloudflare Pages → redirections/_redirects ; autres outils → importez redirections.csv.');
  }
  for (const c of changes.filter((x) => FILE_KINDS.has(x.kind))) {
    files.push({ name: c.kind, content: c.after ?? '' });
    if (c.before !== null) files.push({ name: `avant/${c.kind}`, content: c.before });
    steps.push(`${c.kind} : déposez le fichier ${c.kind} à la racine de votre site (il doit répondre à ${c.target.url ?? `/${c.kind}`}).`);
  }
  const blocks = changes.filter((c) => c.kind === 'jsonld' || c.kind === 'faq');
  blocks.forEach((c, i) => {
    files.push({ name: `balisage/${i + 1}-${slug(pathOf(c.target.url))}.html`, content: c.patch.value });
    steps.push(
      c.patch.op === 'set'
        ? `Balisage ${i + 1} : dans la page ${c.target.url ?? ''}, remplacez le bloc de données structurées existant par le contenu de balisage/${i + 1}-….html.`
        : `Balisage ${i + 1} : collez le contenu de balisage/${i + 1}-….html dans la page ${c.target.url ?? ''} (bloc HTML personnalisé, de préférence avant la fin de la page).`,
    );
  });
  const rewrites = changes.filter((c) => c.kind === 'rewrite' || c.kind === 'gbp.description' || c.kind === 'gbp.hours');
  rewrites.forEach((c, i) => {
    files.push({ name: `textes/${i + 1}-${slug(pathOf(c.target.url) || c.kind)}.txt`, content: `AVANT :\n${c.patch.find ?? c.before ?? ''}\n\nAPRÈS :\n${c.patch.op === 'replace' ? c.patch.value : (c.after ?? '')}\n` });
    steps.push(
      c.kind.startsWith('gbp.')
        ? `Fiche Google : dans votre fiche d’établissement (Modifier le profil), remplacez ${c.kind === 'gbp.hours' ? 'les horaires' : 'la description'} par le texte de textes/${i + 1}-….txt. Bing Places se synchronise ensuite depuis la fiche Google si vous l’avez importée.`
        : `Texte ${i + 1} : dans la page ${c.target.url ?? ''}, remplacez le passage « avant » par le passage « après » (textes/${i + 1}-….txt).`,
    );
  });
  if (opts.cms === 'wix') for (const k of [...new Set(changes.map((c) => c.kind))]) if (WIX_STEPS[k]) steps.push(WIX_STEPS[k] as string);
  const readme = [
    `Repéré — modifications à appliquer : ${cs.title}`,
    `Site : ${cs.site}`,
    `Préparé le ${now.toISOString().slice(0, 10)} (${PLATFORM_LABEL.export}).`,
    '',
    'Étapes :',
    ...steps.map((s, i) => `${i + 1}. ${s}`),
    '',
    'Retour arrière : les valeurs « avant » figurent dans balises.csv, textes/ et le dossier avant/ ; remettez-les en place de la même façon.',
    'Une fois en ligne, cliquez sur « Vérifier » dans Repéré : la page publique est relue pour confirmer la modification.',
  ].join('\n');
  files.unshift({ name: 'LISEZ-MOI.txt', content: readme });
  return { files, zip: buildZip(files, now) };
}
