/** Fonctions pures du modèle ChangeSet : états, calcul de « après », agrégats. */
import crypto from 'node:crypto';
import { KIND_RISK, PublishError, RISK_RANK, type Change, type ChangePatch, type ChangeSet, type ChangeSetStatus, type Risk } from './types';

/** Transitions d'état permises (action → états de départ acceptés). */
export const TRANSITIONS: Record<'propose' | 'edit' | 'validate' | 'reject' | 'apply' | 'verify' | 'revert', readonly ChangeSetStatus[]> = {
  propose: ['draft'],
  edit: ['draft', 'proposed', 'validated'],
  validate: ['proposed'],
  reject: ['draft', 'proposed', 'validated'],
  // une application interrompue ou partielle peut être relancée (idempotent)
  apply: ['validated', 'failed', 'partially_applied'],
  verify: ['applied', 'partially_applied', 'verified'],
  revert: ['applied', 'partially_applied', 'verified', 'failed'],
};

export function assertTransition(cs: ChangeSet, action: keyof typeof TRANSITIONS): void {
  if (!TRANSITIONS[action].includes(cs.status)) {
    const msg: Record<string, string> = {
      apply: 'Ces modifications doivent être validées avant d’être appliquées.',
      validate: 'Seules des modifications proposées peuvent être validées.',
      propose: 'Ces modifications ont déjà été proposées.',
      revert: 'Rien à annuler : aucune modification n’a été appliquée.',
      verify: 'Rien à vérifier : aucune modification n’a été appliquée.',
    };
    throw new PublishError(409, msg[action] ?? `Action impossible dans l’état « ${cs.status} ».`, 'bad_state');
  }
}

export function maxRisk(risks: Risk[]): Risk {
  return risks.reduce<Risk>((m, r) => (RISK_RANK[r] > RISK_RANK[m] ? r : m), 'low');
}

export function riskOf(changes: Pick<Change, 'risk'>[]): Risk {
  return maxRisk(changes.map((c) => c.risk));
}

export { KIND_RISK };

/** Normalisation de comparaison : fins de ligne et espaces de fin (WordPress, Shopify réécrivent parfois). */
export function sameValue(a: string | null | undefined, b: string | null | undefined): boolean {
  const n = (v: string | null | undefined) => (v == null ? null : v.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim());
  return n(a) === n(b);
}

/** « après » à partir de l'état réel. `replace` exige un passage présent une seule fois. */
export function computeAfter(before: string | null, patch: ChangePatch): string {
  const cur = before ?? '';
  switch (patch.op) {
    case 'set':
      return patch.value;
    case 'append': {
      if (cur.includes(patch.value.trim())) return cur; // déjà présent : idempotent
      return cur ? `${cur.replace(/\s+$/, '')}\n\n${patch.value}` : patch.value;
    }
    case 'replace': {
      const find = patch.find ?? '';
      if (!find) throw new PublishError(400, 'Passage à remplacer manquant.');
      const first = cur.indexOf(find);
      if (first < 0) {
        if (cur.includes(patch.value)) return cur; // déjà remplacé
        throw new PublishError(409, 'Le passage à réécrire n’a pas été trouvé tel quel sur la page.', 'passage_not_found');
      }
      if (patch.all) return cur.split(find).join(patch.value);
      if (cur.indexOf(find, first + 1) >= 0) throw new PublishError(409, 'Le passage à réécrire apparaît plusieurs fois : précisez-le.', 'passage_ambiguous');
      return cur.slice(0, first) + patch.value + cur.slice(first + find.length);
    }
  }
}

export function stableId(prefix: string, ...parts: (string | undefined | null)[]): string {
  return `${prefix}_${crypto.createHash('sha256').update(parts.map((p) => p ?? '').join('\u0000')).digest('base64url').slice(0, 16)}`;
}

export const newChangeSetId = () => `cs_${crypto.randomBytes(9).toString('base64url')}`;

/** Statut d'ensemble après une application. */
export function statusAfterApply(changes: Change[]): ChangeSetStatus {
  const done = changes.filter((c) => c.status === 'applied' || c.status === 'verified').length;
  const failed = changes.filter((c) => c.status === 'failed').length;
  if (done === 0) return 'failed';
  if (failed > 0 || changes.some((c) => c.status === 'pending')) return 'partially_applied';
  return changes.every((c) => c.status === 'verified' || c.status === 'skipped') ? 'verified' : 'applied';
}

/** Statut d'ensemble après un retour arrière (total ou partiel). */
export function statusAfterRevert(changes: Change[], previous: ChangeSetStatus): ChangeSetStatus {
  const live = changes.filter((c) => c.status === 'applied' || c.status === 'verified').length;
  if (live === 0) return 'reverted';
  return previous === 'verified' && changes.every((c) => c.status !== 'applied') ? 'verified' : previous === 'failed' ? 'partially_applied' : previous;
}

/** Vue publique : tout sauf rien (aucun secret dans un ChangeSet) ; tronque les très longs contenus. */
export function summarizeChange(c: Change, max = 4000): Change {
  const cut = (s: string | null) => (s && s.length > max ? `${s.slice(0, max)}… (${s.length} caractères)` : s);
  return { ...c, before: cut(c.before), after: cut(c.after) };
}
