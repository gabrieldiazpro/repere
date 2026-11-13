/**
 * Provider de démonstration : réponses françaises réalistes, déterministes à partir d'une graine.
 * Aucune requête réseau. Les réponses portent demo:true et ne sont jamais présentées comme des mesures.
 */
import type { AuditInput, ProviderId } from '../types';
import { resolveTrade, zoneInfo, type TradeInfo, type ZoneInfo } from '../queries';
import { capitalize, hash32, seededRandom, stripAccents } from '../util';
import type { AskContext, AskResult, EngineProvider } from './http';

const SURNAMES = [
  'Martin', 'Bernard', 'Dubois', 'Moreau', 'Laurent', 'Lefebvre', 'Leroy', 'Roux', 'Fournier', 'Girard',
  'Bonnet', 'Mercier', 'Lambert', 'Faure', 'Rousseau', 'Blanc', 'Guérin', 'Muller', 'Henry', 'Garnier',
  'Chevalier', 'Perrin', 'Morel', 'Fontaine', 'Caron', 'Benoît', 'Lemaire', 'Vidal', 'Renaud', 'Marchand',
];
const FIRSTNAMES = [
  'Lucien', 'Paulette', 'Marcel', 'Hélène', 'Antoine', 'Camille', 'Léa', 'Mathilde', 'Jules', 'Margaux',
  'Simone', 'Victor', 'Louise', 'Raymond', 'Inès', 'Odette', 'Gaston', 'Nina', 'Basile', 'Rose',
];
const WORDS_FOOD = ['Comptoir', 'Zinc', 'Jardin', 'Marché', 'Coin', 'Gourmet', 'Fourneau', 'Pré', 'Moulin', 'Quai'];

type Rng = () => number;
const pick = <T>(r: Rng, xs: T[]): T => xs[Math.floor(r() * xs.length)];

/**
 * Noms de concurrents fictifs. Pas de nom « générique de dépannage + quartier » (« SOS Plombier Paris 11 ») : ce genre
 * d'enseigne existe réellement dans chaque arrondissement (RACCORDS-FINAUX). Remplacé sans tirage aléatoire de plus,
 * pour garder les autres noms des comptes démo identiques.
 */
function nameFor(r: Rng, t: TradeInfo, z: ZoneInfo): string {
  const S = pick(r, SURNAMES);
  const F = pick(r, FIRSTNAMES);
  const act = capitalize(t.activity.split(' ')[0]);
  const lab = capitalize(t.label);
  const place = z.quartier ?? (z.arrNum ? `${z.city} ${z.arrNum}` : z.city);
  const patterns: Record<string, string[]> = {
    btp: [`${act} ${S}`, `${S} & Fils`, `Atelier ${S}`, `${S} ${act}`, `${act} du Colibri`, `${act} du ${pick(r, ['Marais', 'Faubourg', 'Canal', 'Square'])}`, `Ets ${S}`],
    restauration: t.cuisine === 'italien'
      ? [`Trattoria ${F}`, `Da ${F}`, `Osteria ${S}`, `La Bottega di ${F}`, `Il ${pick(r, ['Forno', 'Giardino', 'Gusto', 'Vicolo'])}`]
      : t.cuisine === 'japonais'
        ? [`Sushi ${pick(r, ['Kaito', 'Hana', 'Kyo', 'Sora'])}`, `Ramen ${pick(r, ['Taro', 'Yuki', 'Ren'])}`, `Maison ${pick(r, ['Kodama', 'Aoi', 'Mori'])}`]
        : [`Chez ${F}`, `La Table de ${F}`, `Le Petit ${pick(r, WORDS_FOOD)}`, `Le ${pick(r, WORDS_FOOD)} ${S}`, `Bistrot ${F}`, `L'Atelier de ${F}`],
    beaute: [`Salon ${F}`, `Institut ${F}`, `${F} ${act}`, `Maison ${S}`, `L'Atelier ${F}`, `Studio ${S}`],
    sante_bienetre: [`Cabinet du Dr ${S}`, `Centre ${lab} ${place}`, `Dr ${F} ${S}`, `Cabinet ${S}`],
    immobilier: [`${S} Immobilier`, `Agence ${place} ${S}`, `Cabinet ${S}`, `${S} & Associés Immobilier`],
    juridique_compta: [`Cabinet ${S}`, `${S} & Associés`, `${S} ${pick(r, SURNAMES)} Avocats`, `Cabinet ${S} Conseil`],
    autre: [`${lab} ${S}`, `Atelier ${S}`, `Maison ${S}`, `${S} ${act}`, `Chez ${F}`],
  };
  return pick(r, patterns[t.family] ?? patterns.autre);
}

const DESCRIPTIONS: Record<string, string[]> = {
  btp: ['intervention rapide et devis clair', 'très bien noté pour sa réactivité', 'artisan sérieux, travail soigné', 'disponible le week-end', 'prix corrects selon les avis'],
  restauration: ['cuisine maison et ambiance chaleureuse', 'excellent rapport qualité-prix', 'réservation conseillée le soir', 'carte courte et produits frais', 'terrasse agréable'],
  beaute: ['équipe à l’écoute', 'très bons avis sur les colorations', 'prise de rendez-vous en ligne', 'cadre soigné', 'tarifs raisonnables'],
  sante_bienetre: ['praticien recommandé par les patients', 'rendez-vous rapides en ligne', 'cabinet bien équipé', 'bonne écoute selon les avis'],
  immobilier: ['bonne connaissance du quartier', 'estimations jugées réalistes', 'équipe réactive', 'gestion locative appréciée'],
  juridique_compta: ['réponses claires et rapides', 'honoraires transparents', 'spécialiste reconnu', 'très bons retours clients'],
  autre: ['service de qualité', 'commerce apprécié du quartier', 'très bons avis clients', 'accueil sympathique'],
};

function slug(s: string): string {
  return stripAccents(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function displayTarget(name: string): string {
  return name.replace(/\b(SARL|SASU|SAS|EURL|SNC|EIRL|EI)\b\.?/g, '').replace(/\s+/g, ' ').trim();
}

/** Pool de concurrents d'un couple métier × zone (indépendant du commerce audité). */
export function competitorPool(input: AuditInput, seed: string): string[] {
  const t = resolveTrade(input.trade);
  const z = zoneInfo(input);
  const r = seededRandom(`pool|${seed}|${t.key}|${z.zone}`);
  const target = stripAccents(input.businessName).toLowerCase();
  const out: string[] = [];
  for (let i = 0; i < 60 && out.length < 9; i++) {
    const n = nameFor(r, t, z);
    const key = stripAccents(n).toLowerCase();
    if (out.some((o) => stripAccents(o).toLowerCase() === key) || target.includes(key) || key.includes(target)) continue;
    out.push(n);
  }
  return out;
}

/** Visibilité « réelle » simulée du commerce, par IA (0 à ~0,8). */
function targetVisibility(input: AuditInput, seed: string, provider: ProviderId): number {
  const base = seededRandom(`vis|${seed}|${input.businessName}`)();
  const p = 0.04 + 0.62 * Math.pow(base, 1.2);
  const mod = 0.55 + 0.9 * seededRandom(`vis|${seed}|${input.businessName}|${provider}`)();
  return Math.min(0.85, p * mod);
}

const INTROS: Record<ProviderId, string[]> = {
  chatgpt: ['Voici quelques adresses bien notées', 'Plusieurs professionnels reviennent souvent', 'Voici une sélection'],
  perplexity: ["D'après les avis en ligne et les annuaires", 'Selon les sources consultées', 'Les résultats les plus cités'],
  gemini: ['Voici des options intéressantes', 'Plusieurs adresses sont recommandées', 'Voici ce que je peux vous proposer'],
  claude: ['Voici quelques pistes', 'Plusieurs adresses semblent fiables', 'Voici une courte sélection'],
  mistral: ['Voici quelques adresses recommandées', "D'après les résultats de recherche", 'Plusieurs professionnels sont bien notés'],
};

const OUTROS = [
  'Pensez à vérifier les avis récents et à demander un devis avant de vous engager.',
  'Les disponibilités changent vite : appelez avant de vous déplacer.',
  'Je vous conseille de comparer deux ou trois devis.',
  'Vérifiez les horaires sur la fiche Google avant de passer.',
];

const FOOD_OUTROS = [
  'Pensez à réserver, surtout le week-end.',
  'Les horaires varient : vérifiez la fiche Google avant de vous déplacer.',
  'Les avis récents sur Google ou TheFork aident à choisir.',
];

/**
 * Plafond de vraisemblance du mock (D5) : le concurrent dominant (premier du vivier) est absent d'environ 15 % des
 * réponses (retiré, sans remplaçant : il reste en tête du classement). Aucune IA ne cite le même acteur partout.
 */
export function capLeader(names: string[], pool: string[], r: () => number, share = 0.15): void {
  const i = names.indexOf(pool[0]);
  if (i < 0 || names.length < 3 || r() >= share) return;
  names.splice(i, 1);
}

/** Génère une réponse simulée (synchrone, déterministe). */
export function mockAnswer(
  input: AuditInput,
  provider: ProviderId,
  query: { id: string; text: string },
  run: number,
  seed: string,
): AskResult {
  const t = resolveTrade(input.trade);
  const z = zoneInfo(input);
  const pool = competitorPool(input, seed);
  const key = `${seed}|${provider}|${query.id}`;
  const rq = seededRandom(key);
  const rr = seededRandom(`${key}|run${run}`);
  const where = z.arr ?? (z.quartier ? `${z.quartier}, ${z.city}` : z.city);

  // Réponse sans recommandation (≈ 4 %)
  if (rr() < 0.04) {
    return {
      text: `Je n'ai pas d'adresse précise à vous recommander pour « ${query.text} ». Je vous conseille de consulter Google Maps ou PagesJaunes et de comparer les avis récents.`,
      citations: ['https://www.google.com/maps', 'https://www.pagesjaunes.fr/'],
    };
  }

  // Mention : tirage par requête, rejoué avec une part de bruit entre exécutions.
  const p = targetVisibility(input, seed, provider);
  let u = rq();
  if (rr() < 0.22) u = rr();
  const mentioned = u < p;

  const count = 3 + Math.floor(rr() * 3); // 3 à 5
  // Tirage pondéré (les premiers du pool dominent) sans remise.
  const names: string[] = [];
  const weights = pool.map((_, i) => 1 / (i + 1.3));
  const avail = pool.map((n, i) => ({ n, w: weights[i] }));
  while (names.length < (mentioned ? count - 1 : count) && avail.length) {
    const tot = avail.reduce((a, b) => a + b.w, 0);
    let x = rr() * tot;
    let idx = 0;
    for (; idx < avail.length - 1; idx++) {
      x -= avail[idx].w;
      if (x <= 0) break;
    }
    names.push(avail[idx].n);
    avail.splice(idx, 1);
  }
  // Plafond de vraisemblance (D5) : le premier du vivier n'est pas cité dans toutes les réponses (≈ 15 % sans lui).
  capLeader(names, pool, seededRandom(`lead|${key}|${run}`));
  const targetName = displayTarget(input.businessName);
  if (mentioned) {
    const pos = Math.min(names.length, Math.floor(Math.pow(rr(), 0.9) * (names.length + 1)));
    names.splice(pos, 0, targetName);
  }

  const descs = DESCRIPTIONS[t.family] ?? DESCRIPTIONS.autre;
  const intro = `${pick(rr, INTROS[provider])} pour votre recherche à ${where} :`;
  const style = provider === 'chatgpt' ? 'numbered' : provider === 'perplexity' ? 'dash' : provider === 'gemini' ? 'star' : 'numbered';
  const prose = rr() < 0.12;
  let body: string;
  if (prose) {
    const last = names[names.length - 1];
    body = `${intro.replace(/ :$/, '.')} Parmi les noms qui reviennent le plus souvent, on trouve ${names.slice(0, -1).join(', ')} et ${last}. ${capitalize(pick(rr, descs))} pour ${names[0]}.`;
  } else {
    const lines = names.map((n, i) => {
      const loc = rr() < 0.6 ? ` (${where})` : '';
      const d = pick(rr, descs);
      if (style === 'numbered') return `${i + 1}. **${n}**${loc} – ${d}.`;
      if (style === 'dash') return `- **${n}**${loc} : ${d}.`;
      return `* **${n}** — ${d}${loc ? `, ${where}` : ''}.`;
    });
    body = `${intro}\n\n${lines.join('\n')}`;
  }
  const outros = t.family === 'restauration' ? FOOD_OUTROS : OUTROS;
  const text = `${body}\n\n${pick(rr, outros)}`;

  // Plafond de vraisemblance (D7) : PagesJaunes n'est pas citée par toutes les réponses (≈ 60 %).
  const rpj = seededRandom(`pj|${key}|${run}`);
  const citations: string[] = rpj() < 0.6 ? [`https://www.pagesjaunes.fr/annuaire/${slug(z.city)}/${slug(t.label)}`] : [];
  if (rr() < 0.7) citations.push(`https://www.${slug(names[0])}.fr/`);
  if (rr() < 0.5 || !citations.length) citations.push(`https://www.google.com/maps/search/${encodeURIComponent(`${t.label} ${where}`)}`);
  if (input.website && ((mentioned && rr() < 0.6) || rr() < 0.08)) {
    const w = /^https?:\/\//.test(input.website) ? input.website : `https://${input.website}`;
    citations.push(w);
  }
  return { text, citations };
}

export function createMockProvider(id: ProviderId, input: AuditInput, seed: string): EngineProvider {
  return {
    id,
    model: 'demo-mock',
    demo: true,
    costPerCallEur: 0,
    async ask(query: string, ctx: AskContext): Promise<AskResult> {
      return mockAnswer(input, id, { id: ctx.queryId, text: query }, ctx.run, seed);
    },
  };
}

/** Graine par défaut, stable pour une même entrée. */
export function defaultSeed(input: AuditInput): string {
  return `auditia|${hash32(`${input.businessName}|${input.trade}|${input.city}|${input.district ?? ''}`)}`;
}
