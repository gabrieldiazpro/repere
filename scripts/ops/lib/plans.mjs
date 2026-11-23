/**
 * Accès aux offres de src/lib/plans.ts depuis les scripts Node (sans compilation : Node 22.18+ lit le TypeScript
 * simple nativement). Source de vérité unique : jamais de copie des prix dans les scripts.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { APP_ROOT } from './envfile.mjs';

let cached = null;

/** Charge src/lib/plans.ts (message clair si la version de Node est trop ancienne). */
export async function loadPlans() {
  if (cached) return cached;
  const orig = process.emitWarning;
  // Avertissements sans intérêt pour l'utilisateur (« Reparsing as ES module », « Type Stripping… »).
  process.emitWarning = (w, ...rest) => {
    const msg = typeof w === 'string' ? w : w?.message ?? '';
    if (/Reparsing as ES module|Type Stripping|type stripping|MODULE_TYPELESS/i.test(`${msg} ${JSON.stringify(rest)}`)) return;
    return orig.call(process, w, ...rest);
  };
  try {
    cached = await import(pathToFileURL(path.join(APP_ROOT, 'src', 'lib', 'plans.ts')).href);
  } catch (e) {
    const [maj, min] = process.versions.node.split('.').map(Number);
    if (maj < 22 || (maj === 22 && min < 18)) {
      throw new Error(`Node ${process.versions.node} est trop ancien pour ce script : installez Node 22.18+ ou 24 (https://nodejs.org).`);
    }
    throw e;
  } finally {
    process.emitWarning = orig;
  }
  return cached;
}

/** Nom de la variable du prix Stripe d'une offre (même règle que src/lib/stripe.ts). */
export const priceEnvName = (planId) => `STRIPE_PRICE_${String(planId).toUpperCase()}`;

/**
 * Offres vendues en ligne : grille V2 achetable et payante (pas les offres V1 conservées, sauf `legacy`,
 * ni la liste d'attente Agence).
 */
export async function soldPlans({ legacy = false } = {}) {
  const m = await loadPlans();
  return m.PLANS.filter((p) => p.available && p.priceCents > 0 && (legacy || !p.legacy));
}

/**
 * V10 (docs/v10/DECISIONS.md, décisions 3 et 5) : options payantes en prix Stripe récurrents mensuels
 * (lookup_key = identifiant de l'option, quantité = nombre de clients pour l'Agence). Les options Agence et l'offre
 * Agence (liste d'attente) ne sont décrites qu'avec `agency: true` (option --agence du script) : rien n'est créé
 * tant que l'offre n'ouvre pas.
 */
export async function addonPlans({ agency = false } = {}) {
  const m = await loadPlans();
  const addons = (m.PLAN_ADDONS ?? []).filter((a) => agency || a.unit !== 'client');
  return addons.map((a) => ({ id: a.id, segment: a.unit === 'client' ? 'agence' : 'options', name: a.name, priceCents: a.priceCents, interval: a.interval, available: true }));
}

/** Offre Agence (mensuelle et annuelle), décrite seulement avec --agence. */
export async function agencyPlans() {
  const m = await loadPlans();
  return m.PLANS.filter((p) => p.segment === 'agence' && p.priceCents > 0 && /^agency_(month|year)$/.test(p.id));
}
