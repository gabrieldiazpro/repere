/**
 * Calendrier de posts Google (docs/v3/05-teardown-local.md § 2.6) — publication MANUELLE.
 *
 * Sans API Business Profile approuvée, Repéré ne publie pas : il propose un calendrier (1 post par semaine par
 * défaut), un texte prêt à coller (1 500 caractères maximum), une idée de photo, et un rappel le jour J (notification
 * dans l'app et e-mail si l'envoi est configuré). Idées par métier et par saison (gabarits) ; réécriture par LLM si
 * une clé est disponible. Les éléments entre crochets sont à compléter par le client : rien n'est inventé.
 */
import { resolveTrade, tradeFamily } from '@/lib/engine';
import type { TradeFamily } from '@/lib/engine/queries';
import { complete, llmAvailable, SYSTEM_FR } from '@/lib/execution/llm';
import type { LocalPost, PostType, Reminder } from './types';
import { shortHash } from './util';

export const POST_MAX = 1500;

export type Season = 'hiver' | 'printemps' | 'ete' | 'automne';

export function seasonOf(d: Date): Season {
  const m = d.getUTCMonth();
  return m === 11 || m <= 1 ? 'hiver' : m <= 4 ? 'printemps' : m <= 7 ? 'ete' : 'automne';
}

/** Temps forts du calendrier (mois 0–11) utilisables par tous les métiers. */
const MOMENTS: Record<number, { title: string; text: string }> = {
  0: { title: 'Nos horaires et nos vœux pour la nouvelle année', text: 'Toute l’équipe vous souhaite une belle année. Nous sommes ouverts [vos horaires de janvier].' },
  4: { title: 'Ponts de mai : nos horaires', text: 'Les jours fériés de mai approchent. Voici nos horaires pendant les ponts : [vos horaires].' },
  6: { title: 'Horaires d’été', text: 'Pendant l’été, nos horaires évoluent : [vos horaires d’été]. Nous restons joignables au [votre téléphone].' },
  7: { title: 'Fin août : on prépare la rentrée', text: 'La rentrée approche. C’est le bon moment pour [ce que vos clients préparent à la rentrée].' },
  8: { title: 'C’est la rentrée', text: 'Bonne rentrée à tous nos clients. Nos horaires reprennent : [vos horaires].' },
  11: { title: 'Nos horaires pendant les fêtes', text: 'Voici nos horaires pendant les fêtes de fin d’année : [vos horaires]. Merci pour votre confiance cette année.' },
};

const TIPS: Record<TradeFamily, Record<Season, string>> = {
  btp: {
    hiver: 'Avant les grands froids, protégez les canalisations exposées et repérez votre robinet d’arrêt : en cas de fuite, c’est le premier geste.',
    printemps: 'Le printemps est le bon moment pour faire le point sur les petits travaux repoussés pendant l’hiver, avant que les plannings se remplissent.',
    ete: 'Avant de partir en vacances, coupez l’arrivée d’eau et vérifiez vos installations : une petite fuite peut faire de gros dégâts en votre absence.',
    automne: 'Faites entretenir vos équipements avant l’hiver : les délais s’allongent dès les premiers froids.',
  },
  restauration: {
    hiver: 'Nos plats de saison pour l’hiver : [vos plats]. Pensez à réserver pour les soirs de week-end.',
    printemps: 'La carte change avec le printemps : [vos nouveautés, produits de saison].',
    ete: '[Terrasse / horaires d’été / plats frais] : tout ce qu’il faut savoir avant de venir cet été.',
    automne: 'Retour des produits d’automne à la carte : [vos plats]. Réservation conseillée le vendredi et le samedi.',
  },
  sante_bienetre: {
    hiver: 'L’hiver fatigue : [votre conseil de praticien pour la saison], sans remplacer un avis médical.',
    printemps: 'Le printemps est une bonne période pour reprendre de bonnes habitudes : [votre conseil].',
    ete: 'Pendant l’été, nos horaires et nos disponibilités : [vos créneaux]. Réservation en ligne : [votre lien].',
    automne: 'À la rentrée, beaucoup de patients reprennent un suivi : voici comment se passe une première séance chez nous.',
  },
  immobilier: {
    hiver: 'Vendre en hiver : les acheteurs présents sont souvent les plus motivés. Voici comment préparer votre bien.',
    printemps: 'Le printemps est une période active sur le marché : [ce que vous observez dans votre secteur, sans chiffre inventé].',
    ete: 'Vous déménagez cet été ? La liste des documents à réunir avant de signer.',
    automne: 'Estimer son bien avant l’hiver : comment se déroule une estimation chez nous.',
  },
  beaute: {
    hiver: 'Le froid abîme la peau et les cheveux : [votre conseil de saison].',
    printemps: 'Nouvelles envies pour le printemps : [vos prestations de saison].',
    ete: 'Avant les vacances, pensez à réserver : les créneaux partent vite. [votre lien de réservation].',
    automne: 'Après l’été, [votre conseil soin de rentrée].',
  },
  juridique_compta: {
    hiver: 'Début d’année : les échéances à ne pas manquer pour [votre public].',
    printemps: 'Période des déclarations : nos conseils pour la préparer sereinement.',
    ete: 'Nos horaires d’été et comment nous joindre en cas d’urgence.',
    automne: 'Fin d’exercice en vue : les points à vérifier avec nous avant décembre.',
  },
  autre: {
    hiver: '[Votre conseil de saison pour vos clients].',
    printemps: '[Votre nouveauté ou votre conseil de printemps].',
    ete: 'Nos horaires d’été : [vos horaires].',
    automne: '[Votre conseil de rentrée].',
  },
};

const ROTATION: PostType[] = ['conseil', 'coulisses', 'actualite', 'evenement'];

const CTA_BY_TYPE: Record<PostType, LocalPost['cta']> = { conseil: 'En savoir plus', coulisses: 'Appeler', actualite: 'En savoir plus', evenement: 'Appeler', offre: 'Appeler' };

export interface PostContext {
  businessId: string;
  businessName: string;
  trade: string;
  city: string;
  /** fiche de vérité */
  services?: string;
  zone?: string;
  phone?: string;
  /** canal de réservation (« Réserver ») */
  booking?: boolean;
}

function clip(s: string, max = POST_MAX): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}

/** Idée de post (gabarit) pour une date. */
export function postIdea(ctx: PostContext, date: Date, index: number): Pick<LocalPost, 'type' | 'title' | 'text' | 'cta' | 'photoIdea'> {
  const t = resolveTrade(ctx.trade);
  const fam = tradeFamily(ctx.trade);
  const season = seasonOf(date);
  let type = ROTATION[index % ROTATION.length];
  const moment = MOMENTS[date.getUTCMonth()];
  const where = ctx.zone || ctx.city;
  const services = (ctx.services ?? '').split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  const service = services[index % Math.max(1, services.length)] || t.services[index % Math.max(1, t.services.length)]?.replace(/^(la|le|les|l['’])\s?/i, '') || t.activity;
  const contact = ctx.phone ? `Appelez-nous au ${ctx.phone}.` : 'Contactez-nous par téléphone ou via notre site.';
  let title: string;
  let body: string;
  let photoIdea: string;
  if (type === 'evenement' && !moment) type = 'conseil';
  switch (type) {
    case 'conseil':
      title = `Le conseil de saison de ${ctx.businessName}`;
      body = `${TIPS[fam][season]}\n\nUne question sur ${service} ? ${contact}`;
      photoIdea = 'Une photo en situation (vos mains au travail, un outil, un produit), sans client reconnaissable.';
      break;
    case 'coulisses':
      title = `Dans les coulisses : ${service}`;
      body = `Comment se passe ${/^(le|la|les|l['’])\s?/i.test(service) ? service : `une intervention de ${service}`} chez ${ctx.businessName} ? [Décrivez en 3 phrases les étapes, la durée habituelle et ce que le client doit préparer.]\n\nNous intervenons à ${where}. ${contact}`;
      photoIdea = 'Avant / après d’une réalisation récente, ou l’équipe au travail (avec l’accord des personnes photographiées).';
      break;
    case 'actualite':
      title = `${ctx.businessName} à ${where}`;
      body = `[Une nouvelle de la semaine : un chantier terminé, une nouveauté, un membre qui rejoint l’équipe, un nouvel équipement.]\n\n${t.label.charAt(0).toUpperCase()}${t.label.slice(1)} à ${where}, nous nous occupons notamment de ${services.slice(0, 3).join(', ') || service}. ${contact}`;
      photoIdea = 'La façade, le véhicule ou la vitrine, de jour et bien éclairée.';
      break;
    default:
      title = moment!.title;
      body = `${moment!.text}\n\n${contact}`;
      photoIdea = 'Une photo de la vitrine ou de l’équipe, avec un panneau d’horaires lisible.';
  }
  const cta = ctx.booking && type !== 'actualite' ? 'Réserver' : CTA_BY_TYPE[type];
  return { type, title, text: clip(body), cta, photoIdea };
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Prochaine occurrence du jour de semaine (0 = dimanche) à partir de `from` inclus. */
function nextWeekday(from: Date, weekday: number): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export interface PlanOptions {
  from?: Date;
  /** nombre de posts (défaut 4, maximum 12) */
  count?: number;
  /** jour de publication (défaut mardi = 2) */
  weekday?: number;
  /** heure UTC du rappel (défaut 7 h UTC, soit 8 h ou 9 h à Paris) */
  remindHourUtc?: number;
  /** réécriture par LLM si une clé est configurée */
  llm?: boolean;
}

/** Calendrier de posts (1 par semaine) avec rappels. */
export async function planPosts(ctx: PostContext, opts: PlanOptions = {}): Promise<{ posts: LocalPost[]; reminders: Reminder[] }> {
  const from = opts.from ?? new Date();
  const count = Math.max(1, Math.min(12, Math.round(opts.count ?? 4)));
  const weekday = Number.isInteger(opts.weekday) && opts.weekday! >= 0 && opts.weekday! <= 6 ? opts.weekday! : 2;
  const first = nextWeekday(from, weekday);
  const posts: LocalPost[] = [];
  for (let i = 0; i < count; i++) {
    const day = new Date(first.getTime() + i * 7 * 86_400_000);
    const idea = postIdea(ctx, day, i);
    const remind = new Date(day.getTime() + (opts.remindHourUtc ?? 7) * 3_600_000);
    posts.push({
      id: `lp_${shortHash(`${ctx.businessId}:${isoDay(day)}`, 12)}`,
      businessId: ctx.businessId,
      date: isoDay(day),
      ...idea,
      status: 'planned',
      remindAt: remind.toISOString(),
    });
  }
  if (opts.llm && llmAvailable()) {
    await Promise.all(posts.map(async (p) => Object.assign(p, await rewriteWithLlm(p, ctx))));
  }
  const reminders: Reminder[] = posts.map((p) => ({ id: `lr_${p.id.slice(3)}`, businessId: ctx.businessId, postId: p.id, dueAt: p.remindAt, channel: 'email', status: 'pending' }));
  return { posts, reminders };
}

/** Réécriture LLM (garde-fous : longueur, crochets conservés, pas de promesse). Ne lève jamais. */
async function rewriteWithLlm(p: LocalPost, ctx: PostContext): Promise<Partial<LocalPost>> {
  try {
    const out = await complete({
      system: `${SYSTEM_FR} Tu rédiges un post Google Business Profile pour un commerce local français. 80 à 180 mots, vouvoiement, ton simple. Conserve tels quels les passages entre crochets (le commerçant les complétera). N'invente ni prix, ni promotion, ni chiffre, ni avis, ni promesse de résultat. Pas d'emoji, pas de hashtag.`,
      prompt: `Commerce : ${ctx.businessName} (${resolveTrade(ctx.trade).label}, ${ctx.city})\nType de post : ${p.type}\nBrouillon à améliorer :\n"""${p.text}"""`,
      maxTokens: 400,
    });
    if (!out || out.length < 40) return {};
    const brackets = p.text.match(/\[[^\]]+\]/g) ?? [];
    if (brackets.some((b) => !out.includes(b))) return {};
    return { text: clip(out.trim()), llm: true };
  } catch {
    return {};
  }
}

/** Texte final à copier (titre + corps). */
export function postClipboard(p: Pick<LocalPost, 'title' | 'text'>): string {
  return clip(`${p.title}\n\n${p.text}`);
}

export function isPostType(v: unknown): v is PostType {
  return v === 'actualite' || v === 'offre' || v === 'conseil' || v === 'evenement' || v === 'coulisses';
}
