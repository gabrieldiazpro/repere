/**
 * Faits incohérents entre la fiche officielle, le site du client, sa fiche Google et les réponses des IA (reprend la
 * vérification de la fiche Vérité). Fonctions pures : les observations sont chargées par service.ts.
 */
import type { BrandFactField, FactCheckItem } from '@/lib/engine/types-v2';
import { sameAddress, sameHours, sameName, samePhone, sameSite } from '@/lib/local/gbp';
import { PROVIDER_LABELS } from '@/lib/engine/types';
import { FICHE_FIELDS } from './model';
import type { FactSource, FicheAlert, OfficialFiche, SiteObservation, TextKey } from './types';

/** Ce que dit la fiche Google (saisie guidée de /app/local, ou démo). */
export interface GoogleObservation {
  at: string;
  name?: string;
  phone?: string;
  address?: string;
  website?: string;
  hoursText?: string;
}

/** Constat déjà établi par l'analyse du site (GEO, section entité). */
export interface SiteFinding {
  id: string;
  title: string;
  at: string;
}

export interface Suggestion {
  key: TextKey;
  value: string;
  source: Exclude<FactSource, 'client'>;
  at: string;
}

export interface ConsistencyInput {
  fiche: OfficialFiche;
  site?: SiteObservation | null;
  siteFindings?: SiteFinding[];
  google?: GoogleObservation | null;
  ia?: { checkedAt: string; items: FactCheckItem[] } | null;
}

const SEV: Partial<Record<TextKey, FicheAlert['severity']>> = { telephone: 'haute', adresse: 'haute', horaires: 'haute', prix: 'haute', statut: 'haute', site: 'moyenne', nom: 'moyenne', zone: 'moyenne', livraison: 'moyenne', produits: 'moyenne' };
const sev = (k: TextKey | 'services' | 'sameAs') => (k === 'services' ? 'moyenne' : k === 'sameAs' ? 'basse' : (SEV[k] ?? 'basse'));
const label = (k: TextKey | 'services' | 'sameAs') => (k === 'services' ? 'Services' : k === 'sameAs' ? 'Liens officiels' : FICHE_FIELDS[k].label);

/** Fiche de vérité → clé de la fiche officielle (réponses des IA). */
const IA_FIELD: Partial<Record<BrandFactField, TextKey | 'services'>> = {
  adresse: 'adresse',
  telephone: 'telephone',
  horaires: 'horaires',
  prix: 'prix',
  zone: 'zone',
  services: 'services',
  dirigeant: 'dirigeant',
  creation: 'creation',
  site: 'site',
  statut: 'statut',
  produits: 'produits',
  livraison: 'livraison',
  clients: 'clients',
  retours: 'retours',
  ingredients: 'ingredients',
  certifications: 'services',
};

const COMPARE: Partial<Record<TextKey, (a: string, b: string) => boolean>> = {
  telephone: samePhone,
  adresse: sameAddress,
  site: sameSite,
  nom: sameName,
  horaires: (a, b) => sameHours(a, b) && sameHours(b, a),
  email: (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase(),
};

const FIX: Record<FicheAlert['where'], (l: string) => string> = {
  site: (l) => `Mettez votre site à jour avec la valeur de la fiche (${l.toLowerCase()}), ou corrigez la fiche si c’est elle qui est périmée.`,
  google: (l) => `Corrigez votre fiche Google (${l.toLowerCase()}) pour qu’elle reprenne la fiche officielle, ou corrigez la fiche si c’est elle qui est périmée.`,
  ia: () => 'Publiez la bonne valeur partout (site, fiche Google, annuaires) : les IA reprennent ce qu’elles trouvent en ligne. Aucune garantie de délai.',
};

export function checkConsistency(input: ConsistencyInput): { alerts: FicheAlert[]; suggestions: Suggestion[] } {
  const { fiche } = input;
  const alerts: FicheAlert[] = [];
  const suggestions: Suggestion[] = [];
  const val = (k: TextKey) => fiche.text[k]?.value ?? null;

  const compare = (where: 'site' | 'google', whereLabel: string, at: string, pairs: [TextKey, string | undefined][]) => {
    for (const [k, found] of pairs) {
      if (!found?.trim()) continue;
      const expected = val(k);
      if (!expected) {
        suggestions.push({ key: k, value: found.trim(), source: where, at });
        continue;
      }
      const same = COMPARE[k] ?? ((a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase());
      if (same(expected, found)) continue;
      alerts.push({ id: `${where}:${k}`, field: k, label: label(k), severity: sev(k), expected, where, whereLabel, found: found.trim(), at, fix: FIX[where](label(k)), href: where === 'google' ? '/app/local' : '/app/seo/geo' });
    }
  };

  const s = input.site;
  if (s) {
    compare('site', 'votre site', s.at, [
      ['telephone', s.telephone],
      ['adresse', s.adresse],
      ['horaires', s.horaires],
      ['email', s.email],
    ]);
    const known = new Set((fiche.sameAs?.value ?? []).map((u) => u.replace(/\/$/, '').toLowerCase()));
    for (const u of s.sameAs ?? []) {
      if (known.has(u.replace(/\/$/, '').toLowerCase())) continue;
      alerts.push({ id: `site:sameAs:${u}`, field: 'sameAs', label: label('sameAs'), severity: 'basse', expected: null, where: 'site', whereLabel: 'votre site', found: u, at: s.at, fix: 'Si ce profil est bien le vôtre, ajoutez-le aux liens officiels de la fiche (il sera repris dans le balisage sameAs).' });
    }
  }
  for (const f of input.siteFindings ?? []) {
    const field: TextKey | null = /phone/.test(f.id) ? 'telephone' : /address/.test(f.id) ? 'adresse' : null;
    if (!field || alerts.some((a) => a.where === 'site' && a.field === field)) continue;
    alerts.push({ id: `site:${f.id}`, field, label: label(field), severity: 'haute', expected: val(field), where: 'site', whereLabel: 'l’analyse de votre site', found: f.title, at: f.at, fix: FIX.site(label(field)), href: '/app/seo/geo' });
  }

  const g = input.google;
  if (g) {
    compare('google', 'votre fiche Google', g.at, [
      ['nom', g.name],
      ['telephone', g.phone],
      ['adresse', g.address],
      ['site', g.website],
      ['horaires', g.hoursText],
    ]);
  }

  const ia = input.ia;
  if (ia) {
    for (const it of ia.items) {
      if (it.verdict !== 'faux') continue;
      const k = IA_FIELD[it.field];
      if (!k) continue;
      const provider = (PROVIDER_LABELS as Record<string, string>)[it.provider] ?? it.provider;
      alerts.push({
        id: `ia:${it.provider}:${it.field}`,
        field: k,
        label: label(k),
        severity: it.severity,
        expected: k === 'services' ? (fiche.services?.value.map((x) => x.name).join(', ') ?? it.expected) : (val(k) ?? it.expected),
        where: 'ia',
        whereLabel: provider,
        found: it.stated,
        at: ia.checkedAt,
        fix: FIX.ia(label(k)),
        href: '/app/verite',
      });
    }
  }

  const order = { haute: 0, moyenne: 1, basse: 2 } as const;
  const where = { google: 0, site: 1, ia: 2 } as const;
  alerts.sort((a, b) => order[a.severity] - order[b.severity] || where[a.where] - where[b.where] || a.label.localeCompare(b.label));
  // Une suggestion par champ (la fiche Google d'abord : c'est elle que lisent Google et beaucoup d'IA).
  const seen = new Set<string>();
  const uniq = suggestions
    .sort((a, b) => (a.source === b.source ? 0 : a.source === 'google' ? -1 : 1))
    .filter((x) => (seen.has(x.key) ? false : (seen.add(x.key), true)));
  return { alerts, suggestions: uniq };
}
