// Vérité : grille champ × IA et historique des erreurs d'une mesure à l'autre (logique pure, testée).
import type { ProviderId } from '@/lib/engine';
import type { BrandFactField, ExecTask, FactCheckItem, FactCheckReport } from '@/lib/engine/types-v2';

export type Cell = 'ok' | 'faux' | 'partiel' | 'inconnu';

export interface TruthGrid {
  fields: BrandFactField[];
  providers: ProviderId[];
  cells: Record<string, Cell>;
  /** champs distincts vérifiés */
  checked: number;
  correct: number;
  wrong: number;
  /** paires champ × IA comptées */
  answers: number;
}

const RANK: Record<Cell, number> = { faux: 3, partiel: 2, ok: 1, inconnu: 0 };
const CELL: Record<FactCheckItem['verdict'], Cell> = { correct: 'ok', faux: 'faux', incomplet: 'partiel', non_verifiable: 'inconnu' };

export const cellKey = (f: BrandFactField, p: ProviderId) => `${f}|${p}`;

/** Une case par champ × IA ; plusieurs réponses → la plus grave l'emporte (une erreur n'est jamais masquée). */
export function truthGrid(items: FactCheckItem[], providerOrder: ProviderId[] = []): TruthGrid {
  const cells: Record<string, Cell> = {};
  for (const it of items) {
    const k = cellKey(it.field, it.provider);
    const c = CELL[it.verdict];
    if (!cells[k] || RANK[c] > RANK[cells[k]]) cells[k] = c;
  }
  const fields = [...new Set(items.map((i) => i.field))];
  const seen = new Set(items.map((i) => i.provider));
  const providers = [...providerOrder.filter((p) => seen.has(p)), ...[...seen].filter((p) => !providerOrder.includes(p))];
  const vals = Object.values(cells);
  return {
    fields,
    providers,
    cells,
    checked: fields.length,
    correct: vals.filter((v) => v === 'ok').length,
    wrong: vals.filter((v) => v === 'faux').length,
    answers: vals.filter((v) => v !== 'inconnu').length,
  };
}

export interface ErrorHistory {
  field: BrandFactField;
  provider: ProviderId;
  stated: string;
  firstSeen: string;
  lastSeen: string;
  /** date de la première mesure où l'erreur n'apparaît plus (null : toujours présente) */
  resolvedAt: string | null;
  /** tâche de correction faite pour ce champ, s'il y en a une */
  taskDoneAt: string | null;
}

type AuditLike = { factCheck?: FactCheckReport; measuredAt?: string; createdAt: string };

const FIELD_RE: Partial<Record<BrandFactField, RegExp>> = {
  adresse: /adresse/i,
  telephone: /t[ée]l[ée]phone|num[ée]ro/i,
  horaires: /horaire/i,
  prix: /prix|tarif/i,
  zone: /zone/i,
  services: /service/i,
  statut: /statut|ferm/i,
  livraison: /livraison/i,
  retours: /retour/i,
};

/**
 * Frise de chaque erreur (champ × IA) sur les mesures, de la plus ancienne à la plus récente :
 * « détectée le 5 oct. · toujours présente le 5 nov. » ou « corrigée le 5 nov. ».
 * Une erreur n'est « corrigée » que si la mesure suivante a vérifié ce champ auprès de cette IA.
 */
export function errorHistory(audits: AuditLike[], tasks: Pick<ExecTask, 'kind' | 'title' | 'status' | 'doneAt'>[] = []): ErrorHistory[] {
  const date = (a: AuditLike) => a.measuredAt ?? a.createdAt;
  const sorted = [...audits].filter((a) => a.factCheck).sort((x, y) => date(x).localeCompare(date(y)));
  const open = new Map<string, ErrorHistory>();
  const out: ErrorHistory[] = [];
  for (const a of sorted) {
    const items = a.factCheck!.items;
    const wrong = new Map(items.filter((i) => i.verdict === 'faux').map((i) => [cellKey(i.field, i.provider), i]));
    const checked = new Set(items.filter((i) => i.verdict !== 'non_verifiable').map((i) => cellKey(i.field, i.provider)));
    for (const [k, h] of open) {
      if (wrong.has(k)) {
        h.lastSeen = date(a);
        h.stated = wrong.get(k)!.stated;
      } else if (checked.has(k)) {
        h.resolvedAt = date(a);
        out.push(h);
        open.delete(k);
      }
    }
    for (const [k, i] of wrong) {
      if (!open.has(k)) open.set(k, { field: i.field, provider: i.provider, stated: i.stated, firstSeen: date(a), lastSeen: date(a), resolvedAt: null, taskDoneAt: null });
    }
  }
  const all = [...out, ...open.values()];
  for (const h of all) {
    const re = FIELD_RE[h.field];
    const t = tasks.find((x) => x.kind === 'fact_fix' && x.status === 'done' && x.doneAt && (!re || re.test(x.title)));
    h.taskDoneAt = t?.doneAt ?? null;
  }
  return all.sort((x, y) => (x.resolvedAt === null ? 0 : 1) - (y.resolvedAt === null ? 0 : 1) || y.lastSeen.localeCompare(x.lastSeen));
}
