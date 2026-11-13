/**
 * Audit de fiche Google /100 (docs/v3/05-teardown-local.md § 2.3).
 *
 * Grille Repéré (jamais présentée comme un score Google) : catégories 15, complétude 30, avis 20, photos 10,
 * activité 10, cohérence avec la fiche de vérité 15. Un critère que la source ne permet pas de lire est `unknown`
 * et sort du calcul : score = points obtenus / points évalués × 100, `coverage` = points évalués.
 */
import { normalizeAddress, normalizePhone, norm, parseTimeRanges, resolveTrade } from '@/lib/engine';
import type { BrandFacts } from '@/lib/engine/types-v2';
import type { Criterion, CriterionStatus, GbpAudit, GbpGroup, GbpProfile, GbpSource, ManualGbpInput } from './types';
import { clamp100, daysAgoIso, daysBetween, fold, newLocalId, taskLink } from './util';

export const GBP_WEIGHTS: Record<GbpGroup, number> = { categories: 15, completude: 30, avis: 20, photos: 10, activite: 10, coherence: 15 };

export const GBP_GROUP_LABEL: Record<GbpGroup, string> = {
  categories: 'Catégories',
  completude: 'Complétude',
  avis: 'Avis',
  photos: 'Photos',
  activite: 'Activité (posts)',
  coherence: 'Cohérence avec votre fiche de vérité',
};

export interface GbpContext {
  businessId: string;
  businessName: string;
  trade: string;
  /** fiche de vérité (src/lib/facts.ts) */
  facts?: BrandFacts['facts'];
  now?: Date;
}

const fr = (n: number, d = 1) => n.toLocaleString('fr-FR', { maximumFractionDigits: d });

function crit(
  c: Omit<Criterion, 'points' | 'status'> & { status: CriterionStatus; points?: number },
): Criterion {
  const points = c.status === 'unknown' ? 0 : Math.max(0, Math.min(c.max, c.points ?? (c.status === 'ok' ? c.max : 0)));
  return { ...c, points };
}

/** Seuils par paliers : renvoie [points, statut]. */
function tier(v: number, steps: [number, number][], max: number): [number, CriterionStatus] {
  for (const [min, pts] of steps) if (v >= min) return [pts, pts >= max ? 'ok' : pts > 0 ? 'warn' : 'fail'];
  return [0, 'fail'];
}

function ageDays(iso: string | null | undefined, now: Date): number | null | undefined {
  if (iso === undefined) return undefined;
  if (iso === null) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, daysBetween(new Date(t), now)) : undefined;
}

const UNKNOWN_PLACES = 'Non lisible par l’API Places : à vérifier dans votre espace Google Business Profile.';

/** Critères de l'audit (fonction pure). */
export function gbpCriteria(p: GbpProfile, ctx: GbpContext): Criterion[] {
  const now = ctx.now ?? new Date();
  const b = ctx.businessId;
  const gbpTask = taskLink('gbp_profile', 'gbp_profile', b);
  const reviewTask = taskLink('review_request', 'review_request', b);
  const replyTask = taskLink('review_reply', 'review_reply', b);
  const napTask = taskLink('nap', 'other', b);
  const unk = (detail?: string) => detail ?? (p.source === 'places' ? UNKNOWN_PLACES : 'Information non renseignée.');
  const out: Criterion[] = [];

  // --- Catégories (15)
  const trade = resolveTrade(ctx.trade);
  if (p.primaryCategory === undefined) {
    out.push(crit({ id: 'cat_primary', group: 'categories', label: 'Catégorie principale', status: 'unknown', max: 10, detail: unk(), fix: 'Choisissez la catégorie la plus précise pour votre métier.', task: gbpTask }));
  } else if (!p.primaryCategory.trim()) {
    out.push(crit({ id: 'cat_primary', group: 'categories', label: 'Catégorie principale', status: 'fail', max: 10, detail: 'Aucune catégorie principale.', fix: `Choisissez « ${trade.label} » (ou la catégorie la plus proche) comme catégorie principale.`, task: gbpTask }));
  } else {
    const cat = fold(p.primaryCategory);
    const words = [trade.key, trade.label, ...trade.aliases, ...trade.words].map((w) => fold(w)).filter((w) => w.length > 3);
    const match = words.some((w) => cat.includes(w) || w.includes(cat));
    out.push(
      crit({
        id: 'cat_primary',
        group: 'categories',
        label: 'Catégorie principale',
        status: match ? 'ok' : 'warn',
        max: 10,
        points: match ? 10 : 5,
        detail: match ? `Catégorie principale cohérente avec votre métier (${p.primaryCategory}).` : `La catégorie principale (« ${p.primaryCategory} ») ne correspond pas clairement à votre métier (${trade.label}).`,
        fix: match ? 'Rien à faire.' : `Vérifiez qu’il n’existe pas une catégorie plus précise, par exemple « ${trade.label} ».`,
        task: gbpTask,
      }),
    );
  }
  if (p.secondaryCategories === undefined) {
    out.push(crit({ id: 'cat_secondary', group: 'categories', label: 'Catégories secondaires', status: 'unknown', max: 5, detail: unk(), fix: 'Ajoutez 2 à 4 catégories secondaires qui décrivent vos autres services.', task: gbpTask }));
  } else {
    const n = p.secondaryCategories.length;
    out.push(crit({ id: 'cat_secondary', group: 'categories', label: 'Catégories secondaires', status: n >= 2 ? 'ok' : n === 1 ? 'warn' : 'fail', max: 5, points: n >= 2 ? 5 : n === 1 ? 3 : 0, detail: n ? `${n} catégorie${n > 1 ? 's' : ''} secondaire${n > 1 ? 's' : ''}.` : 'Aucune catégorie secondaire.', fix: n >= 2 ? 'Rien à faire.' : 'Ajoutez 2 à 4 catégories secondaires (sans en ajouter qui ne correspondent pas à votre activité).', task: gbpTask }));
  }

  // --- Complétude (30)
  if (p.descriptionLength === undefined) {
    out.push(crit({ id: 'description', group: 'completude', label: 'Description', status: 'unknown', max: 6, detail: unk(), fix: 'Rédigez une description de 400 à 750 caractères : métier, services, zone, ce qui vous distingue.', task: gbpTask }));
  } else {
    const L = p.descriptionLength;
    const [pts, st] = tier(L, [[400, 6], [250, 4], [1, 2]], 6);
    out.push(crit({ id: 'description', group: 'completude', label: 'Description', status: st, max: 6, points: pts, detail: L ? `Description de ${L} caractères (750 au maximum).` : 'Aucune description.', fix: st === 'ok' ? 'Rien à faire.' : 'Utilisez le texte prêt à coller de la tâche « fiche Google » (400 à 750 caractères).', task: gbpTask }));
  }
  if (p.hasHours === undefined) out.push(crit({ id: 'hours', group: 'completude', label: 'Horaires d’ouverture', status: 'unknown', max: 6, detail: unk(), fix: 'Renseignez vos horaires pour chaque jour.', task: gbpTask }));
  else out.push(crit({ id: 'hours', group: 'completude', label: 'Horaires d’ouverture', status: p.hasHours ? 'ok' : 'fail', max: 6, detail: p.hasHours ? 'Horaires renseignés.' : 'Aucun horaire renseigné.', fix: p.hasHours ? 'Rien à faire.' : 'Renseignez vos horaires (les IA répondent souvent à « ouvert maintenant ? »).', task: gbpTask }));
  if (p.hasSpecialHours === undefined) out.push(crit({ id: 'special_hours', group: 'completude', label: 'Horaires exceptionnels', status: 'unknown', max: 3, detail: unk(p.source === 'places' ? 'Aucun horaire exceptionnel dans les 7 prochains jours : impossible de savoir si vous les renseignez.' : undefined), fix: 'Ajoutez vos horaires de jours fériés et de congés à l’avance.', task: gbpTask }));
  else out.push(crit({ id: 'special_hours', group: 'completude', label: 'Horaires exceptionnels', status: p.hasSpecialHours ? 'ok' : 'warn', max: 3, detail: p.hasSpecialHours ? 'Horaires exceptionnels renseignés.' : 'Aucun horaire exceptionnel (jours fériés, congés).', fix: p.hasSpecialHours ? 'Rien à faire.' : 'Ajoutez les jours fériés et vos congés : une fiche à jour inspire confiance.', task: gbpTask }));
  if (p.servicesCount === undefined) out.push(crit({ id: 'services', group: 'completude', label: 'Services', status: 'unknown', max: 5, detail: unk(), fix: 'Listez au moins 5 services avec une courte description.', task: gbpTask }));
  else {
    const [pts, st] = tier(p.servicesCount, [[5, 5], [3, 3], [1, 1]], 5);
    out.push(crit({ id: 'services', group: 'completude', label: 'Services', status: st, max: 5, points: pts, detail: `${p.servicesCount} service${p.servicesCount > 1 ? 's' : ''} listé${p.servicesCount > 1 ? 's' : ''}.`, fix: st === 'ok' ? 'Rien à faire.' : 'Listez au moins 5 services, avec les mots que vos clients emploient.', task: gbpTask }));
  }
  if (p.attributesCount === undefined) out.push(crit({ id: 'attributes', group: 'completude', label: 'Attributs', status: 'unknown', max: 3, detail: unk(), fix: 'Cochez les attributs utiles (accessibilité, moyens de paiement, devis gratuit…).', task: gbpTask }));
  else {
    const [pts, st] = tier(p.attributesCount, [[3, 3], [1, 1]], 3);
    out.push(crit({ id: 'attributes', group: 'completude', label: 'Attributs', status: st, max: 3, points: pts, detail: `${p.attributesCount} attribut${p.attributesCount > 1 ? 's' : ''} renseigné${p.attributesCount > 1 ? 's' : ''}${p.source === 'places' ? ' (accessibilité, paiement, stationnement : seuls attributs lisibles)' : ''}.`, fix: st === 'ok' ? 'Rien à faire.' : 'Cochez les attributs qui vous concernent : ils servent de filtres aux IA.', task: gbpTask }));
  }
  out.push(
    p.website === undefined
      ? crit({ id: 'website', group: 'completude', label: 'Site internet', status: 'unknown', max: 4, detail: unk(), fix: 'Ajoutez l’adresse de votre site.', task: gbpTask })
      : crit({ id: 'website', group: 'completude', label: 'Site internet', status: p.website ? 'ok' : 'fail', max: 4, detail: p.website ? 'Lien vers le site présent.' : 'Aucun site renseigné.', fix: p.website ? 'Rien à faire.' : 'Ajoutez l’adresse de votre site (ou de votre page hébergée Repéré).', task: gbpTask }),
  );
  out.push(
    p.phone === undefined
      ? crit({ id: 'phone', group: 'completude', label: 'Téléphone', status: 'unknown', max: 3, detail: unk(), fix: 'Ajoutez votre numéro principal.', task: gbpTask })
      : crit({ id: 'phone', group: 'completude', label: 'Téléphone', status: p.phone ? 'ok' : 'fail', max: 3, detail: p.phone ? 'Téléphone présent.' : 'Aucun téléphone.', fix: p.phone ? 'Rien à faire.' : 'Ajoutez votre numéro principal (le même partout).', task: gbpTask }),
  );

  // --- Avis (20)
  if (p.reviewCount === undefined) out.push(crit({ id: 'reviews_count', group: 'avis', label: 'Nombre d’avis', status: 'unknown', max: 8, detail: unk(), fix: 'Demandez un avis à chaque client, sans filtre.', task: reviewTask }));
  else {
    const [pts, st] = tier(p.reviewCount, [[50, 8], [20, 6], [10, 4], [1, 2]], 8);
    out.push(crit({ id: 'reviews_count', group: 'avis', label: 'Nombre d’avis', status: st, max: 8, points: pts, detail: `${p.reviewCount} avis.`, fix: st === 'ok' ? 'Continuez à demander un avis après chaque prestation.' : 'Demandez un avis à tous vos clients après chaque prestation (même message pour tous, sans filtre).', task: reviewTask }));
  }
  if (p.rating === undefined || !p.reviewCount) out.push(crit({ id: 'reviews_rating', group: 'avis', label: 'Note moyenne', status: 'unknown', max: 4, detail: p.reviewCount === 0 ? 'Pas encore d’avis.' : unk(), fix: 'Répondez à chaque avis et traitez les points critiqués.', task: replyTask }));
  else {
    const [pts, st] = tier(p.rating, [[4.5, 4], [4.0, 3], [3.5, 2], [1, 0]], 4);
    out.push(crit({ id: 'reviews_rating', group: 'avis', label: 'Note moyenne', status: st, max: 4, points: pts, detail: `Note moyenne ${fr(p.rating)} sur 5.`, fix: st === 'ok' ? 'Rien à faire.' : 'Analysez les thèmes des avis négatifs et répondez-y ; ne demandez jamais d’avis seulement aux clients satisfaits.', task: replyTask }));
  }
  const lastReview = ageDays(p.lastReviewAt, now);
  if (lastReview === undefined) out.push(crit({ id: 'reviews_recency', group: 'avis', label: 'Avis récents', status: 'unknown', max: 4, detail: unk(), fix: 'Visez au moins un nouvel avis par mois.', task: reviewTask }));
  else {
    const [pts, st]: [number, CriterionStatus] = lastReview === null ? [0, 'fail'] : lastReview <= 30 ? [4, 'ok'] : lastReview <= 90 ? [2, 'warn'] : [0, 'fail'];
    out.push(crit({ id: 'reviews_recency', group: 'avis', label: 'Avis récents', status: st, max: 4, points: pts, detail: lastReview === null ? 'Aucun avis.' : `Dernier avis il y a ${lastReview} jour${lastReview > 1 ? 's' : ''}${p.source === 'places' ? ' (parmi les 5 avis renvoyés par Google)' : ''}.`, fix: st === 'ok' ? 'Rien à faire.' : 'Relancez les demandes d’avis : la récence compte autant que le volume.', task: reviewTask }));
  }
  if (p.replyRate === undefined) out.push(crit({ id: 'reviews_replies', group: 'avis', label: 'Réponses aux avis', status: 'unknown', max: 4, detail: unk(), fix: 'Répondez à chaque avis, positif ou négatif, sous 7 jours.', task: replyTask }));
  else {
    const r = Math.max(0, Math.min(1, p.replyRate));
    const [pts, st] = tier(r, [[0.8, 4], [0.5, 2], [0, 0]], 4);
    out.push(crit({ id: 'reviews_replies', group: 'avis', label: 'Réponses aux avis', status: st, max: 4, points: pts, detail: `${Math.round(r * 100)} % des avis récents ont une réponse.`, fix: st === 'ok' ? 'Rien à faire.' : 'Répondez à chaque avis : Repéré prépare un brouillon, vous le validez.', task: replyTask }));
  }

  // --- Photos (10)
  if (p.photosCount === undefined) out.push(crit({ id: 'photos_count', group: 'photos', label: 'Nombre de photos', status: 'unknown', max: 5, detail: unk(), fix: 'Ajoutez au moins 10 photos : façade, équipe, réalisations.', task: gbpTask }));
  else {
    const cap = p.source === 'places' ? 10 : 20; // Places renvoie 10 photos au maximum
    const [pts, st] = tier(p.photosCount, [[cap, 5], [Math.ceil(cap / 2), 3], [1, 1]], 5);
    out.push(crit({ id: 'photos_count', group: 'photos', label: 'Nombre de photos', status: st, max: 5, points: pts, detail: p.source === 'places' && p.photosCount >= 10 ? 'Au moins 10 photos (plafond de lecture de l’API).' : `${p.photosCount} photo${p.photosCount > 1 ? 's' : ''}.`, fix: st === 'ok' ? 'Ajoutez régulièrement des photos récentes.' : 'Ajoutez au moins 10 photos : façade, intérieur, équipe, avant/après.', task: gbpTask }));
  }
  const lastPhoto = ageDays(p.lastPhotoAt, now);
  if (lastPhoto === undefined) out.push(crit({ id: 'photos_recent', group: 'photos', label: 'Photos récentes', status: 'unknown', max: 5, detail: unk(), fix: 'Ajoutez une photo par mois.', task: gbpTask }));
  else {
    const [pts, st]: [number, CriterionStatus] = lastPhoto === null ? [0, 'fail'] : lastPhoto <= 90 ? [5, 'ok'] : lastPhoto <= 180 ? [2, 'warn'] : [0, 'fail'];
    out.push(crit({ id: 'photos_recent', group: 'photos', label: 'Photos récentes', status: st, max: 5, points: pts, detail: lastPhoto === null ? 'Aucune photo.' : `Dernière photo il y a ${lastPhoto} jours.`, fix: st === 'ok' ? 'Rien à faire.' : 'Ajoutez une photo récente (une réalisation, l’équipe) au moins une fois par mois.', task: gbpTask }));
  }

  // --- Activité (10)
  const lastPost = ageDays(p.lastPostAt, now);
  if (lastPost === undefined) out.push(crit({ id: 'posts', group: 'activite', label: 'Posts Google récents', status: 'unknown', max: 10, detail: unk(), fix: 'Publiez un post par semaine (calendrier de posts Repéré, texte prêt à coller).', task: gbpTask }));
  else {
    const [pts, st]: [number, CriterionStatus] = lastPost === null ? [0, 'fail'] : lastPost <= 7 ? [10, 'ok'] : lastPost <= 30 ? [6, 'warn'] : lastPost <= 90 ? [2, 'warn'] : [0, 'fail'];
    out.push(crit({ id: 'posts', group: 'activite', label: 'Posts Google récents', status: st, max: 10, points: pts, detail: lastPost === null ? 'Aucun post publié.' : `Dernier post il y a ${lastPost} jour${lastPost > 1 ? 's' : ''}.`, fix: st === 'ok' ? 'Rien à faire.' : 'Suivez le calendrier de posts : un post par semaine, texte prêt à coller, publication manuelle.', task: gbpTask }));
  }

  // --- Cohérence avec la fiche de vérité (15)
  const f = ctx.facts ?? {};
  const cohe = (id: string, label: string, max: number, ref: string | undefined, got: string | undefined, same: (a: string, b: string) => boolean) => {
    if (!ref) return crit({ id, group: 'coherence', label, status: 'unknown', max, detail: 'Renseignez ce champ dans votre fiche de vérité pour le comparer.', fix: 'Complétez votre fiche de vérité.', task: napTask });
    if (got === undefined) return crit({ id, group: 'coherence', label, status: 'unknown', max, detail: unk(), fix: 'Vérifiez que la fiche Google reprend exactement votre fiche de vérité.', task: napTask });
    if (!got) return crit({ id, group: 'coherence', label, status: 'fail', max, detail: 'Absent de la fiche Google.', fix: `Ajoutez-le tel qu’il figure dans votre fiche de vérité : ${ref}.`, task: napTask });
    const ok = same(ref, got);
    return crit({ id, group: 'coherence', label, status: ok ? 'ok' : 'fail', max, detail: ok ? 'Identique à votre fiche de vérité.' : `Différent de votre fiche de vérité (référence : ${ref}).`, fix: ok ? 'Rien à faire.' : 'Corrigez la fiche Google (ou votre fiche de vérité si c’est elle qui est périmée).', task: napTask });
  };
  out.push(cohe('coh_name', 'Nom', 3, ctx.businessName, p.name, (a, b) => sameName(a, b)));
  out.push(cohe('coh_address', 'Adresse', 4, f.adresse, p.address, sameAddress));
  out.push(cohe('coh_phone', 'Téléphone', 4, f.telephone, p.phone, samePhone));
  out.push(cohe('coh_website', 'Site', 2, f.site, p.website, sameSite));
  out.push(cohe('coh_hours', 'Horaires', 2, f.horaires, p.hoursText ?? (p.hasHours === false ? '' : undefined), sameHours));
  return out;
}

export function sameName(a: string, b: string): boolean {
  const x = norm(a).replace(/[^a-z0-9]/g, '');
  const y = norm(b).replace(/[^a-z0-9]/g, '');
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
}
export function samePhone(a: string, b: string): boolean {
  const x = normalizePhone(a);
  return x.length >= 9 && x === normalizePhone(b);
}
/** Abréviations non couvertes par le moteur (« r. », « bd. », « av. » suivis d'un point). */
function expandAbbr(s: string): string {
  return s.replace(/\br\.?\s/gi, 'rue ').replace(/\b(av|bd|pl|imp|fg|fbg)\./gi, '$1 ').replace(/\bch\.?\s/gi, 'chemin ');
}
export function sameAddress(a: string, b: string): boolean {
  const x = normalizeAddress(expandAbbr(a));
  const y = normalizeAddress(expandAbbr(b));
  if (x.cp && y.cp && x.cp !== y.cp) return false;
  if (x.number && y.number && x.number !== y.number) return false;
  const sx = x.street.replace(/\s+/g, ' ').trim();
  const sy = y.street.replace(/\s+/g, ' ').trim();
  return !!sx && !!sy && (sx === sy || sx.includes(sy) || sy.includes(sx));
}
/** Toutes les plages horaires de la référence se retrouvent dans la fiche (référence illisible = pas d'écart). */
export function sameHours(ref: string, got: string): boolean {
  const r = parseTimeRanges(ref);
  if (!r.length) return true;
  const g = new Set(parseTimeRanges(got).map(([a, b]) => `${a}-${b}`));
  return r.every(([a, b]) => g.has(`${a}-${b}`));
}
export function sameSite(a: string, b: string): boolean {
  const h = (u: string) => u.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '');
  return h(a) === h(b);
}

/** Saisie guidée → profil normalisé (champs absents = non évalués). */
export function profileFromManual(m: ManualGbpInput, now: Date = new Date(), source: GbpSource = 'manual'): GbpProfile {
  const num = (v: unknown, max = 1e6): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, max) : undefined);
  const str = (v: unknown, max = 300): string | undefined => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);
  const days = (v: unknown): string | null | undefined => (v === null ? null : num(v, 36500) === undefined ? undefined : daysAgoIso(num(v, 36500)!, now));
  const list = (v: unknown): string[] | undefined => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, 30).map((x) => x.trim().slice(0, 120)) : undefined);
  const services = list(m.services);
  const replied = m.repliedOfLast && num(m.repliedOfLast.total) ? Math.min(1, (num(m.repliedOfLast.replied) ?? 0) / num(m.repliedOfLast.total)!) : num(m.replyRate, 1);
  const description = str(m.description, 2000);
  return {
    source,
    name: str(m.name, 200),
    primaryCategory: str(m.primaryCategory, 120),
    secondaryCategories: list(m.secondaryCategories),
    descriptionLength: description !== undefined ? description.length : num(m.descriptionLength, 5000),
    hasHours: typeof m.hasHours === 'boolean' ? m.hasHours : str(m.hoursText) ? true : undefined,
    hoursText: str(m.hoursText, 400),
    hasSpecialHours: typeof m.hasSpecialHours === 'boolean' ? m.hasSpecialHours : undefined,
    servicesCount: services ? services.length : num(m.servicesCount, 500),
    attributesCount: num(m.attributesCount, 200),
    photosCount: num(m.photosCount, 100000),
    lastPhotoAt: days(m.lastPhotoDaysAgo),
    lastPostAt: days(m.lastPostDaysAgo),
    website: str(m.website, 300),
    phone: str(m.phone, 40),
    address: str(m.address, 300),
    reviewCount: num(m.reviewCount, 1e6),
    rating: num(m.rating, 5),
    lastReviewAt: days(m.lastReviewDaysAgo),
    replyRate: replied,
  };
}

export const GBP_NOTES = {
  method: 'Score Repéré sur 100 (catégories 15, complétude 30, avis 20, photos 10, activité 10, cohérence 15), calculé sur les seuls critères lisibles. Ce n’est pas une note Google et il ne garantit aucun classement.',
  places: 'Source : API Google Places. Le contenu de la fiche n’est pas conservé : seuls l’identifiant de lieu et nos scores calculés le sont. Posts, description, services et taux de réponse ne sont pas lisibles par cette API : complétez-les par la saisie guidée.',
  manual: 'Source : vos réponses (saisie guidée). Le score dépend de leur exactitude.',
  demo: 'Données de démonstration (commerce fictif).',
};

/** Audit complet. */
export function auditGbp(profile: GbpProfile, ctx: GbpContext): GbpAudit {
  const criteria = gbpCriteria(profile, ctx);
  const groups = Object.fromEntries(
    (Object.keys(GBP_WEIGHTS) as GbpGroup[]).map((g) => {
      const cs = criteria.filter((c) => c.group === g);
      return [g, { points: cs.reduce((n, c) => n + c.points, 0), max: GBP_WEIGHTS[g], evaluated: cs.filter((c) => c.status !== 'unknown').reduce((n, c) => n + c.max, 0) }];
    }),
  ) as GbpAudit['groups'];
  const evaluated = criteria.filter((c) => c.status !== 'unknown').reduce((n, c) => n + c.max, 0);
  const points = criteria.reduce((n, c) => n + c.points, 0);
  const notes = [GBP_NOTES.method, GBP_NOTES[profile.source]];
  if (evaluated < 50) notes.push('Moins de la moitié de la grille a pu être évaluée : complétez la saisie guidée pour un score fiable.');
  return {
    id: newLocalId('gbp', ctx.businessId),
    businessId: ctx.businessId,
    source: profile.source,
    ...(profile.placeId ? { placeId: profile.placeId } : {}),
    score: evaluated ? clamp100((points / evaluated) * 100) : 0,
    coverage: evaluated,
    groups,
    criteria,
    createdAt: (ctx.now ?? new Date()).toISOString(),
    ...(profile.source === 'demo' ? { demo: true } : {}),
    notes,
    contentStored: profile.source !== 'places',
  };
}

/**
 * Version stockable d'un audit (règles Places) : pour la source `places`, les `detail` (qui reprennent du contenu
 * Google : note, nombre d'avis, catégorie, adresse…) sont remplacés par un libellé générique dérivé du statut.
 */
export function toStorableAudit(a: GbpAudit): GbpAudit {
  if (a.source !== 'places') return a;
  const generic: Record<CriterionStatus, string> = {
    ok: 'Conforme lors du dernier calcul.',
    warn: 'À améliorer lors du dernier calcul.',
    fail: 'Manquant ou non conforme lors du dernier calcul.',
    unknown: 'Non lisible par l’API Places.',
  };
  return {
    ...a,
    criteria: a.criteria.map((c) => ({ ...c, detail: generic[c.status], fix: c.fix.replace(/ : .*$/, '.') })),
    contentStored: false,
  };
}

/** Critères à corriger, du plus rentable au moins rentable (points perdus). */
export function gbpPriorities(a: GbpAudit, n = 5): Criterion[] {
  return a.criteria
    .filter((c) => c.status === 'fail' || c.status === 'warn')
    .sort((x, y) => y.max - y.points - (x.max - x.points))
    .slice(0, n);
}
