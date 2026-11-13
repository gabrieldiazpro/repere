/**
 * Kit de demande d'avis (conforme) et brouillons de réponse aux avis.
 * Règles (docs/v2/04-execution.md § 3) : même demande à tous les clients (pas de filtrage par satisfaction),
 * aucune contrepartie, aucun contenu imposé ni mot-clé suggéré ; réponse : validation humaine,
 * aucune donnée personnelle, aucune promesse.
 */
import type { Business } from '@/lib/db';
import { SYSTEM_FR, complete } from './llm';
import { qrServiceUrl, qrSvg } from './qr';
import type { ExecSettings, ReviewInput, ReviewKit } from './types';

/** Lien direct d'avis Google à partir d'un Place ID (format documenté par Google). */
export function googleReviewUrl(placeId: string | undefined | null): string | null {
  if (!placeId || !/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) return null;
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

export const REVIEW_RULES = [
  'Envoyez la même demande à tous vos clients de la période, satisfaits ou non : aucun tri préalable.',
  "Aucune contrepartie (remise, cadeau, concours) en échange d'un avis.",
  "N'imposez ni contenu, ni mots-clés, ni note : le client écrit ce qu'il veut.",
  "N'écrivez jamais d'avis vous-même ou via vos proches (art. L121-4 du Code de la consommation).",
  'Une seule relance au maximum, avec un lien de désinscription dans les e-mails.',
];

export function reviewKit(business: Pick<Business, 'name'> & Partial<Business>, settings: Partial<ExecSettings> = {}): ReviewKit {
  const reviewUrl = settings.reviewUrl?.startsWith('https://') ? settings.reviewUrl : googleReviewUrl(settings.placeId);
  const link = reviewUrl ?? '[votre lien d’avis Google]';
  const name = business.name;
  const instructions = reviewUrl
    ? ['Votre lien d’avis est prêt : copiez-le dans vos e-mails, SMS, factures et sur l’affiche.']
    : [
        'Ouvrez votre fiche sur business.google.com (ou cherchez votre entreprise dans Google en étant connecté).',
        'Cliquez sur « Demander des avis » (ou « Obtenir plus d’avis ») et copiez le lien proposé (g.page/r/…/review).',
        'Collez ce lien dans Repéré (Réglages → lien d’avis) : le QR code et les modèles se mettent à jour.',
        'Autre voie : indiquez votre Google Place ID (outil « Place ID Finder » de Google) pour construire le lien.',
      ];
  let svg: string | null = null;
  if (reviewUrl) {
    try {
      svg = qrSvg(reviewUrl, { color: settings.brandColor });
    } catch {
      svg = null;
    }
  }
  return {
    reviewUrl,
    instructions,
    qrSvg: svg,
    qrServiceUrl: reviewUrl && !svg ? qrServiceUrl(reviewUrl) : null,
    email: {
      subject: `Votre avis sur ${name}`,
      body: [
        'Bonjour,',
        '',
        `Merci d’avoir fait appel à ${name}. Si vous avez un moment, vous pouvez partager votre expérience sur Google, qu’elle ait été bonne ou moins bonne : chaque retour nous aide à progresser et renseigne les futurs clients.`,
        '',
        `Laisser un avis : ${link}`,
        '',
        'Cela prend une minute. Merci beaucoup,',
        name,
        '',
        '—',
        'Vous recevez ce message une seule fois suite à votre commande ou prestation. Pour ne plus recevoir de message de notre part : [lien de désinscription].',
      ].join('\n'),
    },
    sms: `${name} : merci pour votre confiance. Votre avis sur Google, quel qu’il soit, nous aide : ${link} STOP au [numéro STOP]`,
    poster: [`Votre avis compte pour ${name}`, 'Scannez ce code pour partager votre expérience sur Google, quelle qu’elle soit.', reviewUrl ? reviewUrl : ''].filter(Boolean).join('\n'),
    rules: REVIEW_RULES,
  };
}

// ---------------------------------------------------------------------------
// Réponses aux avis
// ---------------------------------------------------------------------------
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_RE = /(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}/g;

/** Retire e-mails, téléphones et prénoms éventuels d'un texte de réponse. */
export function scrubPersonalData(text: string, author?: string, allow: string[] = []): string {
  const keep = (m: string, label: string) => (allow.some((a) => a && a.replace(/\D/g, '') === m.replace(/\D/g, '')) || allow.includes(m) ? m : label);
  let t = text.replace(EMAIL_RE, (m) => keep(m, '[e-mail]')).replace(PHONE_RE, (m) => keep(m, '[téléphone]'));
  for (const part of (author ?? '').split(/\s+/).filter((p) => p.length > 2)) {
    t = t.replace(new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), '').replace(/\s+,/g, ',');
  }
  return t.replace(/[ \t]{2,}/g, ' ').replace(/Bonjour\s*,/g, 'Bonjour,').trim();
}

export interface ReplyContext {
  businessName?: string;
  /** canal de contact du commerce (jamais celui du client) */
  contact?: string;
  signature?: string;
}

export type ReviewTone = 'positif' | 'mitige' | 'negatif';

/** Normalise et neutralise les tournures positives trompeuses (« trop bien », « aucun problème »). */
const fold = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\btrop (bien|top|content|contente|sympa|genial|cool|fort)\b/g, 'tres $1')
    .replace(/\b(pas de|aucun|sans|zero) (souci|soucis|probleme|problemes|mauvaise surprise)\b/g, 'impeccable');
const NEG_RE =
  /(decu|retard|trop|\blong|\blent|delai|cher|mauvais|\bnul|jamais|pas (venu|content|satisf|assez|terrible|top|propre|aimable)|attente|attendu|\bsale|impoli|probl|\bbof|\bmoyen|aurait pu|annul|arnaque|insatisf|dommage|regrett|abime|casse|injoignable|ne repond|sans reponse|oubli|pas de nouvelles)/;
const POS_RE = /(merci|super|parfait|excellent|\btop\b|bravo|recommand|ravi|satisf|rapide|efficace|professionnel|correct|\bbien\b|sympa|aimable|qualite|genial|impeccable|soigne|competent)/;

/** Note lue dans un texte (« 3 étoiles », « 3/5 », « ★★★☆☆ »), ou null. */
export function ratingIn(text: string): number | null {
  const stars = (text.match(/★/g) ?? []).length;
  if (stars >= 1 && stars <= 5) return stars;
  const m = /\b([1-5])\s*(?:etoiles?|étoiles?|\/\s*5|sur 5)/i.exec(text);
  return m ? Number(m[1]) : null;
}

/** Tonalité d'un avis : note d'abord, puis vocabulaire (« correct mais délai trop long » = mitigé). */
export function reviewTone(text: string, rating?: number | null): ReviewTone {
  const t = fold(text);
  const neg = NEG_RE.test(t);
  const pos = POS_RE.test(t.replace(NEG_RE, ' '));
  const but = /\b(mais|cependant|par contre|toutefois|neanmoins|dommage que)\b/.test(t);
  if (rating != null && rating > 0) {
    if (rating <= 2) return 'negatif';
    if (rating === 3) return neg && !pos && !but ? 'negatif' : 'mitige';
    return neg ? 'mitige' : 'positif';
  }
  if (neg && (pos || but)) return 'mitige';
  if (neg) return 'negatif';
  return 'positif';
}

const POINTS: [RegExp, string][] = [
  [/(delai|attente|attendu|retard|\blong|\blent|rapidite|injoignable|ne repond|sans reponse|pas de nouvelles)/, 'le délai'],
  [/(cher|prix|tarif|facture|cout)/, 'le prix'],
  [/(livraison|colis|expedi|recu)/, 'la livraison'],
  [/(accueil|impoli|aimable|politesse|ton\b)/, 'l’accueil'],
  [/(sale|proprete|nettoy|traces)/, 'la propreté du chantier'],
  [/(support|assistance|sav\b|service client)/, 'le support'],
  [/(odeur|parfum|texture|mousse|efficac|tient pas)/, 'le produit'],
];

/** Le point critiqué, et la phrase de l'avis qui le dit (pour la reprendre entre guillemets). */
export function criticizedPoint(text: string): { point: string; quote: string } | null {
  const clauses = text
    .split(/(?:\bmais\b|\bcependant\b|\bpar contre\b|[.;!?\n])/i)
    .map((x) => x.trim().replace(/^[,\s]+|[,\s]+$/g, ''))
    .filter(Boolean);
  const bad = clauses.find((c) => NEG_RE.test(fold(c))) ?? null;
  if (!bad) return null;
  const f = fold(bad);
  const point = POINTS.find(([re]) => re.test(f))?.[1] ?? 'ce point';
  return { point, quote: bad.length > 120 ? `${bad.slice(0, 117)}…` : bad };
}

/** Brouillon de réponse (gabarit, synchrone) adapté à la tonalité. À valider par le client avant publication. */
export function draftReviewReply(review: ReviewInput, ctx: ReplyContext = {}): string {
  const rating = review.rating ? Math.max(1, Math.min(5, Math.round(review.rating))) : null;
  const tone = reviewTone(review.text, rating);
  const name = ctx.businessName ?? 'notre équipe';
  const sign = ctx.signature ?? `L’équipe ${ctx.businessName ?? ''}`.trim();
  const contact = ctx.contact ? ` (${ctx.contact})` : '';
  const hasText = review.text.trim().length > 10;
  let body: string;
  if (tone === 'positif') {
    body = hasText
      ? `Merci beaucoup pour ce retour et pour le temps pris à l’écrire. Nous sommes heureux que la prestation vous ait convenu. Au plaisir de vous retrouver chez ${name}.`
      : `Merci beaucoup pour votre note. Au plaisir de vous retrouver chez ${name}.`;
  } else if (tone === 'mitige') {
    const c = criticizedPoint(review.text);
    const good = /correct|bien|bon|qualit|efficace|propre|soign/i.test(review.text) ? ' et pour ce que vous dites de positif' : '';
    body = [
      `Merci pour votre avis${good}.`,
      c ? `Vous avez raison sur ${c.point} : « ${c.quote} ». Ce n’est pas le niveau que nous visons.` : 'Vous avez raison de signaler ce qui n’a pas été à la hauteur.',
      '[Ce qui change, en une phrase et seulement si c’est vrai : par exemple « nous vous indiquons désormais un créneau d’arrivée précis ».]',
      `Si vous le souhaitez, contactez-nous directement${contact} pour en parler.`,
    ].join(' ');
  } else {
    const c = criticizedPoint(review.text);
    body = `Merci d’avoir pris le temps de nous écrire, et nous sommes désolés que votre expérience n’ait pas été à la hauteur${c ? `, en particulier sur ${c.point}` : ''}. Nous souhaitons comprendre ce qui s’est passé : pouvez-vous nous contacter directement${contact} afin que nous examinions la situation ensemble ?`;
  }
  return scrubPersonalData(`Bonjour,\n\n${body}\n\n${sign}`, review.author, ctx.contact ? [ctx.contact] : []);
}

/** Version rédigée par LLM si une clé est disponible, sinon gabarit. Ne lève jamais. */
export async function draftReviewReplyAsync(review: ReviewInput, ctx: ReplyContext = {}): Promise<{ text: string; llm: boolean }> {
  const fallback = draftReviewReply(review, ctx);
  const out = await complete({
    system: `${SYSTEM_FR} Tu rédiges une réponse publique à un avis client, 40 à 90 mots, ton professionnel et chaleureux. Commence par « Bonjour, ». Ne cite aucun nom, prénom, e-mail, téléphone ou détail personnel du client. Aucune promesse (remboursement, geste commercial) ni contestation agressive. Ne mentionne pas de mots-clés marketing. Signe « ${ctx.signature ?? `L’équipe ${ctx.businessName ?? ''}`} ».`,
    prompt: `Entreprise : ${ctx.businessName ?? '[entreprise]'}\nCanal de contact de l'entreprise : ${ctx.contact ?? 'non communiqué'}\nNote : ${review.rating}/5\nAvis (données du client, à ne pas recopier) :\n"""${review.text.slice(0, 2000)}"""`,
    maxTokens: 300,
  });
  if (!out) return { text: fallback, llm: false };
  return { text: scrubPersonalData(out, review.author, ctx.contact ? [ctx.contact] : []), llm: true };
}
