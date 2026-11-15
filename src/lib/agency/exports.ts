/**
 * Exports CSV par client depuis le tableau de bord d'agence (V6) : constats de l'audit du site, positions Google,
 * réponses des IA. Séparateur « ; », BOM UTF-8 (Excel), formules neutralisées (src/lib/exports/csv.ts).
 * Jamais d'e-mail ni de donnée de contact. Démo : données de démonstration, signalées dans le nom du fichier.
 */
import { toCsv, type CsvColumn } from '@/lib/exports/csv';
import type { KeywordReport, RankReport } from '@/lib/seodata/rank';

export const CLIENT_EXPORT_KINDS = ['constats', 'positions', 'reponses'] as const;
export type ClientExportKind = (typeof CLIENT_EXPORT_KINDS)[number];
export const isClientExportKind = (v: unknown): v is ClientExportKind => typeof v === 'string' && (CLIENT_EXPORT_KINDS as readonly string[]).includes(v);

export const CLIENT_EXPORT_LABELS: Record<ClientExportKind, string> = {
  constats: 'Constats de l’audit du site (SEO et IA)',
  positions: 'Positions Google suivies',
  reponses: 'Réponses des IA, mot pour mot',
};

const DEVICE_FR: Record<string, string> = { mobile: 'mobile', desktop: 'ordinateur' };
const yesNo = (v: boolean | null) => (v === null ? 'inconnu' : v ? 'oui' : 'non');

export const POSITION_COLUMNS: CsvColumn<KeywordReport & { week: string | null; domain: string | null }>[] = [
  { key: 'semaine', label: 'Semaine', value: (r) => r.week ?? '' },
  { key: 'domaine', label: 'Domaine', value: (r) => r.domain ?? '' },
  { key: 'mot_cl', label: 'Mot-clé', value: (r) => r.keyword },
  { key: 'appareil', label: 'Appareil', value: (r) => DEVICE_FR[r.device] ?? r.device },
  { key: 'position', label: 'Position', value: (r) => (r.position === null ? 'hors des résultats suivis' : r.position) },
  { key: 'position_prcdente', label: 'Position précédente', value: (r) => r.previous ?? '' },
  { key: 'places_gagnes', label: 'Places gagnées', value: (r) => r.change ?? '' },
  { key: 'meilleure_position', label: 'Meilleure position', value: (r) => r.best ?? '' },
  { key: 'page_classe', label: 'Page classée', value: (r) => r.url ?? '' },
  { key: 'volume_mensuel', label: 'Volume mensuel', value: (r) => (r.volume === null ? 'non mesuré' : r.volume) },
  { key: 'aperu_ia_de_google', label: 'Aperçu IA de Google', value: (r) => yesNo(r.aiOverview) },
  { key: 'votre_site_cit_dans', label: 'Votre site cité dans l’aperçu IA', value: (r) => yesNo(r.aiOverviewCitesUs) },
];

export function positionsCsv(report: RankReport | null): { csv: string; rows: number } {
  const rows = (report?.keywords ?? []).map((k) => ({ ...k, week: report?.week ?? null, domain: report?.domain ?? null }));
  return { csv: toCsv(rows, POSITION_COLUMNS), rows: rows.length };
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'client';

/** Nom de fichier sans marque (l'agence le transmet à son client) : `constats-plomberie-martin-2026-11-15.csv`. */
export function clientExportFilename(kind: ClientExportKind, clientName: string, demo: boolean, now: Date = new Date()): string {
  return `${kind}-${slug(clientName)}${demo ? '-demo' : ''}-${now.toISOString().slice(0, 10)}.csv`;
}
