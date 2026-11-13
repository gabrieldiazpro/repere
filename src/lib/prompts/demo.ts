/**
 * Questions de démonstration des 3 comptes démo (`demo`, `demo-pme`, `demo-ecom`).
 * Cohérentes avec les audits démo : ce sont exactement les questions mesurées par les 6 audits
 * (même texte, même identifiant de requête), taguées, plus UNE question saisie par le client et en pause
 * (pour montrer la fonction sans changer le nombre de questions mesurées).
 * Calculées en mémoire, jamais écrites dans le store (comptes démo en lecture seule).
 */
import { buildDemoWorkspace, isDemoBusinessId, segmentForDemoId, type DemoId } from '@/lib/demo-v2';
import type { QuerySpec } from '@/lib/engine/types';
import { cleanTags, tagsForIntent } from './text';
import { ANGLE_PROMPT_INTENT, INTENT_LABEL, type PromptIntent, type TrackedPrompt } from './types';
import { intentOfQuery } from './engine';

/** Tags métier par identifiant de requête (préfixe de gabarit). */
const DEMO_TAGS: Record<DemoId, Record<string, string[]>> = {
  demo: {
    T1: ['générique'],
    T2: ['générique'],
    T3: ['quartier'],
    T4: ['quartier'],
    T5: ['fuite', 'urgence'],
    T7: ['fuite'],
    T8: ['débouchage'],
    T9: ['avis'],
    B3: ['marque', 'infos pratiques'],
  },
  'demo-pme': {
    P1: ['générique'],
    P2: ['générique'],
    P3: ['concurrent', 'comparatif'],
    P4: ['comparatif'],
    P5: ['prix'],
    P6: ['avis'],
    P7: ['concurrent', 'comparatif'],
    P8: ['générique'],
    B1: ['marque'],
    B2: ['marque', 'avis'],
  },
  'demo-ecom': {
    E1: ['shampoing'],
    E2: ['shampoing'],
    E3: ['shampoing', 'concurrent'],
    E4: ['shampoing', 'prix'],
    E5: ['shampoing', 'made in france'],
    E6: ['déodorant', 'avis'],
    E7: ['shampoing', 'comparatif'],
    E8: ['déodorant', 'prix'],
    B1: ['marque'],
    B2: ['marque', 'avis'],
  },
};

const DEMO_EXTRA: Record<DemoId, { text: string; intent: PromptIntent; theme: string; tags: string[] }> = {
  demo: { text: 'Quel plombier installe un chauffe-eau thermodynamique à Paris 11e ?', intent: 'service', theme: 'Chauffe-eau', tags: ['chauffe-eau'] },
  'demo-pme': { text: 'Quel logiciel de paie gère la DSN automatiquement pour une PME ?', intent: 'service', theme: 'DSN', tags: ['dsn'] },
  'demo-ecom': { text: 'Quel soin visage solide pour peau sensible recommandes-tu ?', intent: 'recommandation', theme: 'Soin visage', tags: ['soin visage'] },
};

function demoTheme(id: DemoId, q: QuerySpec, intent: PromptIntent): string {
  const tid = q.id.split('-')[0];
  if (id === 'demo-ecom' && /^E/.test(tid)) return /d[ée]odorant/i.test(q.text) ? 'Déodorant solide' : 'Shampoing solide';
  if (id === 'demo' && ['T5', 'T7'].includes(tid)) return 'Fuites';
  return INTENT_LABEL[intent];
}

export function demoPromptId(businessId: DemoId, queryId: string): string {
  return `${businessId}_${queryId}`;
}

/** Questions démo d'un compte démo (10 ou 11), ou [] pour tout autre identifiant. */
export function demoPrompts(businessId: string): TrackedPrompt[] {
  if (!isDemoBusinessId(businessId)) return [];
  const ws = buildDemoWorkspace(segmentForDemoId(businessId));
  const first = ws.audits[0];
  const last = ws.audits[ws.audits.length - 1];
  const tags = DEMO_TAGS[businessId];
  const out: TrackedPrompt[] = last.queries.map((q) => {
    const intent = q.angle ? ANGLE_PROMPT_INTENT[q.angle] : intentOfQuery(q);
    const tid = q.id.split('-')[0];
    return {
      id: demoPromptId(businessId, q.id),
      businessId,
      text: q.text,
      theme: demoTheme(businessId, q, intent),
      tags: cleanTags([...(tags[tid] ?? []), ...tagsForIntent(intent)]),
      intent,
      origin: 'gabarit',
      active: true,
      createdAt: first.createdAt,
      queryId: q.id,
    };
  });
  const extra = DEMO_EXTRA[businessId];
  out.push({
    id: demoPromptId(businessId, 'C1'),
    businessId,
    text: extra.text,
    theme: extra.theme,
    tags: cleanTags(extra.tags),
    intent: extra.intent,
    origin: 'client',
    active: false,
    createdAt: last.createdAt,
  });
  return out;
}

/** Question démo par identifiant (`demo-pme_P1-fb03`), ou null. */
export function findDemoPrompt(id: string): TrackedPrompt | null {
  const cut = id.indexOf('_');
  if (cut <= 0) return null;
  const bid = id.slice(0, cut);
  if (!isDemoBusinessId(bid)) return null;
  return demoPrompts(bid).find((p) => p.id === id) ?? null;
}
