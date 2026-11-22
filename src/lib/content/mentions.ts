/**
 * « Mentions à obtenir » (remplace l'échange de liens) : les sites que les IA citent quand on leur pose les questions
 * du client — annuaires, comparatifs, presse locale, fédérations et organismes, plateformes d'avis — où le client
 * n'apparaît pas encore. Pour chacun : la raison (citations mesurées, concurrents présents), la voie de contact
 * publique connue, les étapes et un message de demande rédigé. RIEN n'est envoyé automatiquement ; pas d'échange de
 * liens, pas d'article sponsorisé non signalé, pas de faux avis, pas de commentaire non déclaré sur un forum.
 */
import { CATEGORY_ACTIONS, CATEGORY_LABEL, tableEntry } from '@/lib/engine/sources';
import type { DomainStat, SourceCategory } from '@/lib/engine/types-v2';
import { PROVIDER_LABELS, type ProviderId } from '@/lib/engine/types';
import { stableId } from '@/lib/geo/util';
import { factValue } from './facts';
import { todo } from './markdown';
import type { FactSheet, MentionTarget } from './types';

const ALLOWED: SourceCategory[] = ['annuaire', 'avis', 'comparatif', 'media_local', 'media_national', 'institutionnel', 'marketplace'];

const CAUTION: Partial<Record<SourceCategory, string>> = {
  avis: 'Demandez des avis à de vrais clients, sans contrepartie ni tri : les faux avis sont interdits (article L121-4 du Code de la consommation) et sanctionnés par les plateformes.',
  comparatif: 'Si l’auteur propose une place payante, elle doit être signalée comme publicité. Repéré ne conseille pas d’acheter un lien.',
  media_local: 'Aucune garantie de publication : proposez une vraie information, jamais un article payé présenté comme éditorial.',
  media_national: 'Aucune garantie de publication : proposez une expertise ou une donnée, jamais un article payé non signalé.',
  marketplace: 'Calculez vos marges (commissions) avant d’ouvrir un compte vendeur.',
};

export interface MentionInput {
  name: string;
  site: string;
  segment: 'local' | 'pme' | 'ecommerce';
  city?: string;
  facts: FactSheet;
  domains: DomainStat[];
  measuredAt?: string;
  demo?: boolean;
}

function providersLabel(ps: string[]): string[] {
  return ps.map((p) => PROVIDER_LABELS[p as ProviderId] ?? p);
}

function message(cat: SourceCategory, label: string, i: MentionInput): { subject: string; body: string } {
  const f = (k: Parameters<typeof factValue>[1], hint: string) => factValue(i.facts, k) ?? todo(hint);
  const sign = [i.name, factValue(i.facts, 'telephone'), i.site].filter(Boolean).join(' · ');
  const presentation = `${i.name} — ${f('activite', 'votre activité en une phrase')}${i.city ? `, ${i.city}` : ''}.`;
  switch (cat) {
    case 'annuaire':
      return {
        subject: `Ajout de ${i.name} sur ${label}`,
        body: `Bonjour,\n\nJe souhaite référencer mon entreprise sur ${label} :\n- Nom : ${i.name}\n- Activité : ${f('activite', 'votre activité')}\n- Adresse : ${f('adresse', 'votre adresse exacte, identique à votre fiche Google')}\n- Téléphone : ${f('telephone', 'votre téléphone')}\n- Site : ${i.site}\n\nPouvez-vous m’indiquer la marche à suivre si la fiche ne peut pas être créée en ligne ?\n\nMerci,\n${sign}`,
      };
    case 'avis':
      return {
        subject: `Votre avis sur ${i.name}`,
        body: `Bonjour,\n\nMerci de votre confiance. Si vous avez un instant, votre avis sur ${label} nous aiderait beaucoup — qu’il soit positif ou non, il sera publié tel quel.\n\n${todo('lien direct vers votre page d’avis sur ' + label)}\n\nMerci,\n${sign}`,
      };
    case 'comparatif':
      return {
        subject: `Proposition d’ajout à votre comparatif : ${i.name}`,
        body: `Bonjour,\n\nVotre page compare des solutions comme la nôtre. ${presentation}\n\nQuelques faits vérifiables, si vous souhaitez nous ajouter :\n- Services : ${f('services', 'vos services')}\n- Tarifs : ${f('prix', 'vos tarifs publics')}\n- Ce qui nous distingue : ${f('difference', 'un fait vérifiable')}\n\nJe peux vous transmettre tout justificatif utile. Nous ne demandons pas de place payante.\n\nCordialement,\n${sign}`,
      };
    case 'media_local':
    case 'media_national':
      return {
        subject: `Information ${i.city ? `à ${i.city}` : ''} : ${todo('votre actualité en quelques mots')}`.replace(/\s+:/, ' :'),
        body: `Bonjour,\n\n${presentation}\n\nNous avons une information qui pourrait intéresser vos lecteurs : ${todo('votre actualité réelle (ouverture, anniversaire, recrutement, chiffre, événement)')}.\n\nJe reste disponible pour un échange ou des photos.\n\nCordialement,\n${sign}`,
      };
    case 'institutionnel':
      return {
        subject: `Référencement de ${i.name}`,
        body: `Bonjour,\n\n${presentation}\n\nNous souhaitons figurer sur ${label} (annuaire des membres ou des professionnels). ${factValue(i.facts, 'certifications') ? `Labels détenus : ${factValue(i.facts, 'certifications')}.` : todo('votre label, adhésion ou qualification justifiant le référencement')}\n\nPouvez-vous m’indiquer les conditions et les pièces à fournir ?\n\nCordialement,\n${sign}`,
      };
    default:
      return {
        subject: `${i.name} sur ${label}`,
        body: `Bonjour,\n\n${presentation}\n\nNous souhaitons proposer nos produits sur ${label}. Pouvez-vous m’indiquer les conditions d’ouverture d’un compte vendeur ?\n\nCordialement,\n${sign}`,
      };
  }
}

export function mentionTargets(i: MentionInput): MentionTarget[] {
  const out: MentionTarget[] = [];
  for (const d of i.domains) {
    if (!ALLOWED.includes(d.category)) continue;
    if (d.category === 'marketplace' && i.segment !== 'ecommerce') continue;
    if (d.clientPresence === 'present') continue;
    const entry = tableEntry(d.domain);
    const providers = providersLabel(d.providers);
    const comp = d.competitorsPresent.slice(0, 3);
    // Plateforme d'avis qui interdit de solliciter des avis (ex. Yelp) : pas de message de demande d'avis.
    const noAsk = d.category === 'avis' && /interdit de solliciter|ne (pas )?solliciter/i.test(entry?.howToGetListed ?? '');
    out.push({
      id: `mn_${stableId(d.domain)}`,
      domain: d.domain,
      label: d.label || entry?.label || d.domain,
      category: d.category,
      categoryLabel: CATEGORY_LABEL[d.category],
      why: `Cité ${d.citations} fois par ${providers.join(', ') || 'les IA'} sur vos questions${comp.length ? ` ; on y trouve ${comp.join(', ')}` : ''}${d.clientPresence === 'absent' ? ', pas vous' : ''}.`,
      citations: d.citations,
      providers,
      competitors: comp,
      ...(d.sampleUrls[0] ? { sampleUrl: d.sampleUrls[0] } : {}),
      contact: entry?.howToGetListed ?? null,
      steps: CATEGORY_ACTIONS[d.category].steps.slice(0, 3),
      message: noAsk ? message('annuaire', d.label || entry?.label || d.domain, i) : message(d.category, d.label || entry?.label || d.domain, i),
      ...(noAsk ? { caution: 'Cette plateforme interdit de solliciter des avis : revendiquez et complétez seulement votre page.' } : CAUTION[d.category] ? { caution: CAUTION[d.category] } : {}),
      ...(i.demo ? { demo: true } : {}),
    });
  }
  const weight = (m: MentionTarget) => m.citations * (m.competitors.length ? 1.5 : 1);
  return out.sort((a, b) => weight(b) - weight(a)).slice(0, 15);
}
