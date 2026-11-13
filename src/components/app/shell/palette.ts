// Recherche globale et palette de commandes (logique pure, testée).
import type { Segment } from '@/lib/engine/types-v2';
import { allNav } from '../nav';

export type PaletteKind = 'page' | 'question' | 'concurrent' | 'tache' | 'action';

export interface PaletteItem {
  id: string;
  kind: PaletteKind;
  label: string;
  /** précision affichée sous le libellé */
  hint?: string;
  /** destination (navigation) */
  href?: string;
  /** commande exécutée par la palette (sans href) */
  command?: PaletteCommand;
  /** mots-clés supplémentaires pour la recherche */
  keywords?: string;
  /** raccourci affiché (ex. « g l ») */
  shortcut?: string;
}

export type PaletteCommand = 'measure' | 'export' | 'theme' | 'visite' | 'notifications-read';

/** Données d'index fournies par le serveur (noms seulement, pas de contenu sensible). */
export interface SearchIndex {
  questions: { id: string; text: string }[];
  competitors: string[];
  tasks: { id: string; title: string; done?: boolean }[];
}

export const KIND_LABEL: Record<PaletteKind, string> = {
  action: 'Actions',
  page: 'Pages',
  question: 'Questions suivies',
  concurrent: 'Concurrents',
  tache: 'Actions du plan',
};

export const KIND_ORDER: PaletteKind[] = ['action', 'page', 'question', 'concurrent', 'tache'];

export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Score de correspondance (0 = aucune) : début de libellé > début de mot > sous-chaîne > lettres dans l'ordre. */
export function matchScore(query: string, item: Pick<PaletteItem, 'label' | 'keywords' | 'hint'>): number {
  const q = normalize(query);
  if (!q) return 1;
  const label = normalize(item.label);
  const extra = normalize(`${item.keywords ?? ''} ${item.hint ?? ''}`);
  if (label.startsWith(q)) return 100 - Math.min(40, label.length - q.length);
  if (label.split(' ').some((w) => w.startsWith(q))) return 70;
  if (label.includes(q)) return 55;
  const words = q.split(' ');
  if (words.length > 1 && words.every((w) => label.includes(w) || extra.includes(w))) return 45;
  if (extra.includes(q)) return 35;
  // lettres dans l'ordre (tolère les fautes de frappe par omission), seulement pour des requêtes courtes
  if (q.length <= 6) {
    let i = 0;
    for (const c of label) if (c === q[i]) i++;
    if (i === q.length) return 15;
  }
  return 0;
}

export function buildItems(segment: Segment | null | undefined, index: SearchIndex, opts: { demo: boolean }): PaletteItem[] {
  const items: PaletteItem[] = [
    {
      id: 'cmd:measure',
      kind: 'action',
      label: 'Lancer une mesure',
      hint: opts.demo ? 'Indisponible sur le compte démo' : 'Pose vos questions suivies aux IA maintenant',
      command: 'measure',
      keywords: 'audit relancer mesurer',
    },
    { id: 'cmd:export', kind: 'action', label: 'Exporter mes données', hint: 'CSV : questions, réponses, sources, concurrents…', command: 'export', keywords: 'csv télécharger' },
    { id: 'cmd:theme', kind: 'action', label: 'Changer de thème', hint: 'Système, clair ou sombre', command: 'theme', keywords: 'sombre clair nuit dark' },
    { id: 'cmd:visite', kind: 'action', label: 'Lancer la visite guidée', hint: '8 étapes sur le compte démo', command: 'visite', keywords: 'aide tutoriel découvrir' },
    { id: 'cmd:copilote', kind: 'action', label: 'Demander au copilote', href: '/app/copilote', keywords: 'question aide' },
    { id: 'cmd:inviter', kind: 'action', label: 'Inviter un collègue', href: '/app/reglages#equipe', keywords: 'équipe membre agence' },
  ];
  for (const n of allNav(segment)) {
    items.push({ id: `page:${n.href}`, kind: 'page', label: n.label, hint: n.sub, href: n.href, shortcut: n.key ? `g ${n.key}` : undefined });
  }
  items.push({ id: 'page:/app/bienvenue', kind: 'page', label: 'Bien démarrer', hint: 'Les étapes de mise en route', href: '/app/bienvenue', keywords: 'onboarding démarrage' });
  for (const q of index.questions) {
    items.push({ id: `q:${q.id}`, kind: 'question', label: q.text, href: `/app/questions?q=${encodeURIComponent(q.id)}` });
  }
  for (const c of index.competitors) {
    items.push({ id: `c:${c}`, kind: 'concurrent', label: c, href: `/app/concurrents?nom=${encodeURIComponent(c)}` });
  }
  for (const t of index.tasks) {
    items.push({ id: `t:${t.id}`, kind: 'tache', label: t.title, hint: t.done ? 'Faite' : 'À faire', href: `/app/actions?t=${encodeURIComponent(t.id)}` });
  }
  return items;
}

export interface PaletteGroup {
  kind: PaletteKind;
  label: string;
  items: PaletteItem[];
}

/** Filtre et regroupe ; sans requête : actions et pages seulement (les listes longues apparaissent en tapant). */
export function search(items: PaletteItem[], query: string, perGroup = 6): PaletteGroup[] {
  const q = query.trim();
  const scored = items
    .filter((i) => q || i.kind === 'action' || i.kind === 'page')
    .map((i) => ({ i, s: matchScore(q, i) }))
    .filter((x) => x.s > 0);
  return KIND_ORDER.map((kind) => {
    const list = scored
      .filter((x) => x.i.kind === kind)
      .sort((a, b) => b.s - a.s)
      .slice(0, q ? perGroup : kind === 'page' ? 30 : perGroup)
      .map((x) => x.i);
    return { kind, label: KIND_LABEL[kind], items: list };
  }).filter((g) => g.items.length);
}

/** Est-ce une saisie dans un champ (pas de raccourci clavier) ? */
export function isTypingTarget(el: EventTarget | null): boolean {
  if (!el || typeof (el as HTMLElement).tagName !== 'string') return false;
  const h = el as HTMLElement;
  const tag = h.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || h.isContentEditable === true;
}
