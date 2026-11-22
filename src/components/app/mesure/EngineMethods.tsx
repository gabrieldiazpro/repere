/**
 * V8 : « Comment chaque IA est mesurée » — fiche de mesure par IA (`AuditResult.engines`, src/lib/engine/engines.ts) :
 * API officielle ou page de résultats, modèle, recherche web, pays / langue / appareil, échantillons, marge, taux
 * d'affichage des aperçus IA. Noms en texte, aucun logo. Rien n'est affiché si l'audit n'a pas de fiche (anciens audits).
 */
import type { EngineMeasure } from '@/lib/engine';

const pct = (x: number) => `${Math.round(x * 100)} %`;

function line(e: EngineMeasure): string {
  const parts: string[] = [];
  if (e.questions) parts.push(`${e.questions} question${e.questions > 1 ? 's' : ''} × ${e.runsPerQuestion} passage${e.runsPerQuestion > 1 ? 's' : ''}`);
  if (e.displayed) parts.push(`réponse IA affichée sur ${e.displayed.shown} recherche${e.displayed.shown > 1 ? 's' : ''} sur ${e.displayed.total}`);
  if (e.mentionRate !== null && e.marginPts !== null) parts.push(`cité dans ${pct(e.mentionRate)} des réponses (± ${String(Math.round(e.marginPts))} points)`);
  else parts.push('aucune réponse exploitable pour le taux de mention');
  if (e.errors) parts.push(`${e.errors} appel${e.errors > 1 ? 's' : ''} en erreur, non comptés`);
  return parts.join(' · ');
}

export function EngineMethods({ engines }: { engines?: EngineMeasure[] | null }) {
  if (!engines?.length) return null;
  return (
    <details className="mt-4 text-[13px]">
      <summary className="cursor-pointer font-semibold">Comment chaque IA est mesurée</summary>
      <ul className="mt-3 flex flex-col gap-3">
        {engines.map((e) => (
          <li key={e.provider}>
            <p>
              <span className="font-semibold">{e.label}</span>
              <span className="text-[var(--muted)]">
                {' '}
                · {e.via === 'serp' ? 'page de résultats' : 'API officielle'}
                {e.webSearch ? ', avec recherche web' : ', sans recherche web'}
                {e.demo ? ' · démonstration' : ''}
              </span>
            </p>
            <p className="text-[var(--muted)]">{e.note}</p>
            <p className="rp-num text-[12px] text-[var(--muted)]">{line(e)}</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-[var(--muted)]">
        Marge : intervalle à 90 % sur le taux de mention de chaque IA. Une recherche sans réponse IA affichée (aperçu IA absent) est comptée à part, jamais comme un oubli.
      </p>
    </details>
  );
}
