/**
 * Fournisseur SIMULÉ pour développer et tester les baromètres, sans réseau ni clé.
 * Toutes les réponses portent `demo: true` (modèle « simulation-barometre ») : une édition qui en contient ne peut
 * pas être publiée (garde-fous dans storage.ts et public.ts). Les noms sont ouvertement fictifs (« Exemple Alpha »)
 * et les sites en .example (domaine réservé, RFC 2606) : aucune entreprise réelle n'est nommée.
 * Le jeu contient volontairement des variantes d'orthographe (fusion), un nom vu une seule fois (non vérifiable) et
 * un nom de personne (jamais publié).
 */
import { resolveTrade } from '../engine/queries';
import type { AskContext, AskResult, EngineProvider } from '../engine/providers/http';
import type { ProviderId, RawSource } from '../engine/types';
import { capitalize, seededRandom } from '../engine/util';
import { slugify } from './catalog';
import type { BarometreDef } from './types';

export const SIMULATION_MODEL = 'simulation-barometre';

const GREEK = ['Alpha', 'Bêta', 'Gamma', 'Delta', 'Epsilon', 'Zêta', 'Êta', 'Thêta'];
const POPULARITY = [0.75, 0.6, 0.5, 0.38, 0.28, 0.2, 0.12, 0.08];
const PROVIDER_BIAS: Record<ProviderId, number[]> = {
  chatgpt: [1.1, 1, 0.9, 1, 1, 1, 1, 1],
  perplexity: [0.9, 1.1, 1.2, 0.8, 1, 1.2, 1, 1],
  gemini: [1, 0.9, 1, 1.2, 0.9, 1, 1.3, 1],
  claude: [1.1, 1, 0.8, 1, 1.2, 0.8, 1, 1.2],
  mistral: [1, 1, 1, 1, 1, 1, 1, 1],
};

const SOURCE_DOMAINS = ['annuaire-exemple.example', 'forum-exemple.example', 'comparatif-exemple.example', 'journal-exemple.example', 'avis-exemple.example'];

function baseNames(def: BarometreDef): string[] {
  if (def.segment === 'local') {
    const label = capitalize(resolveTrade(def.trade ?? def.subject).label);
    return GREEK.map((g) => `${label} Exemple ${g}`);
  }
  return GREEK.map((g) => `Exemple ${g}`);
}

/** Variantes d'orthographe plausibles d'un même nom (casse, forme juridique, ville, ordre des mots, accents). */
function variantOf(name: string, def: BarometreDef, r: () => number): string {
  const x = r();
  if (x < 0.6) return name;
  if (x < 0.7) return `${name} SARL`;
  if (x < 0.8) return def.city ? `${name} ${def.city}` : `${name} France`;
  if (x < 0.9) return name.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const words = name.split(' ');
  return def.segment === 'local' && words.length >= 3 ? [...words.slice(1), words[0]].join(' ') : name.toUpperCase();
}

export function simulatedAnswer(def: BarometreDef, provider: ProviderId, _question: string, ctx: Pick<AskContext, 'queryId' | 'run'>, seed = 'demo'): AskResult {
  const r = seededRandom(`${seed}|${def.slug}|${provider}|${ctx.queryId}|${ctx.run}`);
  const names = baseNames(def);
  const bias = PROVIDER_BIAS[provider] ?? PROVIDER_BIAS.mistral;
  const picked = names
    .map((n, i) => ({ n, i, s: POPULARITY[i] * bias[i] * (0.6 + 0.8 * r()) }))
    .filter((x) => x.s > 0.35)
    .sort((a, b) => b.s - a.s)
    .slice(0, 5);
  const lines: string[] = [];
  const sources: RawSource[] = [];
  let text = `Voici quelques ${def.subject} souvent recommandés (réponse simulée) :\n\n`;
  picked.forEach((x, k) => {
    const shown = variantOf(x.n, def, r);
    const site = `https://www.${slugify(x.n)}.example/`;
    const withSite = r() < 0.5;
    lines.push(`${k + 1}. **${shown}** – très bien noté par ses clients${withSite ? ` (${site})` : ''}.`);
  });
  // Nom cité par une seule IA, sans site : jamais publié (non vérifiable).
  if (provider === 'perplexity' && ctx.run === 1 && r() < 0.15) lines.push(`${lines.length + 1}. **Atelier Unique Fictif** – adresse citée une seule fois.`);
  // Nom de personne : jamais publié.
  if (provider === 'claude' && r() < 0.2) lines.push(`${lines.length + 1}. **Jean Exemple** – indépendant.`);
  text += lines.join('\n');
  text += '\n\nComparez plusieurs devis et vérifiez les avis récents.';
  const nSrc = 1 + Math.floor(r() * 3);
  for (let i = 0; i < nSrc; i++) {
    const d = SOURCE_DOMAINS[Math.floor(r() * SOURCE_DOMAINS.length)];
    sources.push({ url: `https://${d}/${slugify(def.subject)}`, title: `${capitalize(def.subject)} – ${d}`, kind: 'cited', order: i + 1 });
  }
  return { text, citations: sources.map((s) => s.url), sources };
}

/** Fournisseur simulé (demo:true). `costPerCallEur` > 0 seulement pour tester le budget. */
export function createSimulatedProvider(id: ProviderId, def: BarometreDef, opts: { seed?: string; costPerCallEur?: number; onCall?: () => void } = {}): EngineProvider {
  return {
    id,
    model: SIMULATION_MODEL,
    demo: true,
    costPerCallEur: opts.costPerCallEur ?? 0,
    async ask(query: string, ctx: AskContext): Promise<AskResult> {
      opts.onCall?.();
      return simulatedAnswer(def, id, query, ctx, opts.seed);
    },
  };
}
