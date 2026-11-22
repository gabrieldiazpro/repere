// Fonctions pures de l'interface « Contenus » (utilisables côté navigateur) : libellés, tons, simulation démo.
import type { Tone } from '@/components/ui/tone';
import type { ContentDraft, DraftStatus, Evidence, FactKey, MentionStatus, PageType } from '@/lib/content/types';
import type { Platform } from '@/lib/publish/types';
import type { ViewerRole } from '../agent/model';

export const TODO_TEST = /\[\s*à compléter(?:\s*:[^\]]*)?\]/i;
export const TODO_SPLIT = /(\[\s*à compléter(?:\s*:[^\]]*)?\])/i;

export const STATUS_VIEW: Record<DraftStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Brouillon', tone: 'brand' },
  validated: { label: 'Validé, prêt à envoyer', tone: 'brand' },
  remote_draft: { label: 'Brouillon sur votre site', tone: 'warn' },
  published: { label: 'En ligne', tone: 'up' },
  unpublished: { label: 'Retiré de la ligne', tone: 'neutral' },
  removed: { label: 'À la corbeille', tone: 'neutral' },
  exported: { label: 'Exporté, à publier par vous', tone: 'warn' },
  rejected: { label: 'Écarté', tone: 'neutral' },
};

export const PAGE_TYPE_NAME: Record<PageType, string> = {
  tarifs: 'Page tarifs',
  faq: 'Questions fréquentes',
  zone: 'Zone d’intervention',
  comparatif: 'Comparatif honnête',
  'a-propos': 'À propos',
  service: 'Page service',
  garanties: 'Garanties',
  contact: 'Contact',
  article: 'Article',
};

export const SOURCE_NAME: Record<Evidence['source'], string> = {
  questions_ia: 'Mesure IA',
  search_console: 'Search Console',
  analyse_geo: 'Analyse du site',
  page_mince: 'Exploration',
};

export const PLATFORM_NAME: Record<string, string> = {
  wordpress: 'WordPress',
  shopify: 'Shopify',
  webflow: 'Webflow',
  wix: 'Wix',
  prestashop: 'PrestaShop',
  magento: 'Magento',
  export: 'Export',
  gbp: 'Fiche Google',
};

export const MENTION_STATUS: Record<MentionStatus, { label: string; tone: Tone }> = {
  a_faire: { label: 'À demander', tone: 'neutral' },
  demande: { label: 'Demandé', tone: 'warn' },
  obtenu: { label: 'Obtenu', tone: 'up' },
  refuse: { label: 'Refusé', tone: 'down' },
};

const RANK: Record<ViewerRole, number> = { viewer: 1, member: 2, admin: 3, owner: 4, demo: 4 };
/** Rédiger, modifier : membre et plus. Valider, envoyer, mettre en ligne, retirer : administrateur ou propriétaire. */
export const canEdit = (r: ViewerRole) => RANK[r] >= 2;
export const canValidate = (r: ViewerRole) => RANK[r] >= 3;

export const hasTodo = (d: Pick<ContentDraft, 'title' | 'metaTitle' | 'metaDescription' | 'body'>) => TODO_TEST.test(`${d.title}\n${d.metaTitle}\n${d.metaDescription}\n${d.body}`);

export function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
}

export const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/** Étape suivante d'un brouillon (un seul bouton principal par vue). */
export function nextStep(d: ContentDraft, platforms: { platform: Platform; page: boolean; article: boolean }[]): { id: 'complete' | 'validate' | 'push' | 'export' | 'publish' | 'declare' | 'agent' | 'none'; label: string } {
  if (d.status === 'draft') return hasTodo(d) ? { id: 'complete', label: 'Compléter les informations manquantes' } : { id: 'validate', label: 'Valider ce contenu' };
  if (d.status === 'validated') {
    const fmt = d.action === 'rewrite' ? 'page' : d.format;
    const p = platforms.find((x) => (fmt === 'page' ? x.page : x.article));
    if (d.action === 'rewrite') return platforms.length ? { id: 'push', label: 'Préparer la mise à jour de la page' } : { id: 'export', label: 'Exporter (HTML et Markdown)' };
    return p ? { id: 'push', label: `Créer en brouillon sur ${PLATFORM_NAME[p.platform]}` } : { id: 'export', label: 'Exporter (HTML et Markdown)' };
  }
  if (d.status === 'remote_draft') return d.remote?.extra?.changeSetId ? { id: 'agent', label: 'Appliquer depuis l’agent' } : { id: 'publish', label: 'Mettre en ligne' };
  if (d.status === 'unpublished') return { id: 'publish', label: 'Remettre en ligne' };
  if (d.status === 'exported') return { id: 'declare', label: 'J’ai publié la page' };
  return { id: 'none', label: '' };
}

// ---------------------------------------------------------------------------
// Simulation (comptes démo) : rien n'est envoyé, l'état vit dans le navigateur.
// ---------------------------------------------------------------------------
const stamp = (d: ContentDraft, now: Date, patch: Partial<ContentDraft>): ContentDraft => ({ ...d, ...patch, updatedAt: now.toISOString(), version: d.version + 1 });

export function simValidate(d: ContentDraft, now: Date): ContentDraft {
  if (hasTodo(d)) throw new Error('Il reste des « [à compléter] » : complétez-les avant de valider.');
  return stamp(d, now, { status: 'validated', validation: { by: { id: 'demo', email: 'vous (démo)', role: 'owner' }, at: now.toISOString() } });
}

export function simPush(d: ContentDraft, platform: Platform, now: Date, site: string): ContentDraft {
  return stamp(d, now, { status: 'remote_draft', platform, consumedAt: d.consumedAt ?? now.toISOString(), remote: { platform, format: d.format, id: `demo-${d.id}`, status: 'draft', url: `${site.replace(/\/$/, '')}/${d.slug}` } });
}

export function simPublish(d: ContentDraft, now: Date): ContentDraft {
  return stamp(d, now, { status: 'published', publishedAt: d.publishedAt ?? now.toISOString(), liveUrl: d.remote?.url, remote: d.remote ? { ...d.remote, status: 'published' } : d.remote });
}

export function simUnpublish(d: ContentDraft, now: Date): ContentDraft {
  return stamp(d, now, { status: 'unpublished', remote: d.remote ? { ...d.remote, status: 'draft' } : d.remote });
}

export function simRemove(d: ContentDraft, now: Date): ContentDraft {
  return stamp(d, now, { status: 'removed', remote: d.remote ? { ...d.remote, status: 'trashed' } : d.remote });
}

export function simReject(d: ContentDraft, now: Date): ContentDraft {
  return stamp(d, now, { status: 'rejected', validation: undefined });
}

export const FACT_ORDER: FactKey[] = ['activite', 'services', 'zone', 'adresse', 'telephone', 'email', 'horaires', 'prix', 'delais', 'garanties', 'paiement', 'certifications', 'creation', 'dirigeant', 'equipe', 'histoire', 'difference', 'clients', 'livraison', 'retours', 'avis'];
