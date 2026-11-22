'use client';
// Réglages › API : création (jeton affiché une seule fois) et révocation des clés, journal d'utilisation.
import { useState, useTransition } from 'react';
import type { ApiKeyView, KeyAccess } from '@/lib/publicapi/keys';
import type { KeyUsage } from '@/lib/publicapi/usage';
import { toast } from '@/components/app/shell/client';
import { createKeyAction, revokeKeyAction } from './actions';

export interface KeyRow extends ApiKeyView {
  usage: Pick<KeyUsage, 'total30' | 'recent' | 'days'>;
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }) : 'jamais';

function Spark({ days }: { days: { date: string; total: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.total));
  return (
    <div className="flex h-8 items-end gap-[2px]" role="img" aria-label={`Appels des 30 derniers jours : ${days.reduce((s, d) => s + d.total, 0)}`}>
      {days.map((d) => (
        <span key={d.date} title={`${d.date} : ${d.total}`} className="w-[5px] rounded-sm bg-[var(--accent,#2563eb)]" style={{ height: `${Math.max(2, (d.total / max) * 32)}px`, opacity: d.total ? 0.9 : 0.2 }} />
      ))}
    </div>
  );
}

export function KeyManager({
  spaceKeys,
  agencyKeys,
  canSpace,
  canAgency,
  spaceName,
}: {
  spaceKeys: KeyRow[];
  agencyKeys: KeyRow[] | null;
  canSpace: boolean;
  canAgency: boolean;
  spaceName: string;
}) {
  const [label, setLabel] = useState('');
  const [access, setAccess] = useState<KeyAccess>('read');
  const [target, setTarget] = useState<'space' | 'agency'>(canSpace ? 'space' : 'agency');
  const [created, setCreated] = useState<{ token: string; key: ApiKeyView } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoked, setRevoked] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await createKeyAction({ target, access, label });
      if (r.ok) {
        setCreated(r.data);
        setLabel('');
      } else setError(r.error);
    });
  };
  const revoke = (k: KeyRow) => {
    if (!window.confirm(`Révoquer « ${k.label} » ? Les programmes qui l’utilisent recevront une erreur 401 immédiatement. Cette action est définitive.`)) return;
    start(async () => {
      const r = await revokeKeyAction({ target: k.scope, id: k.id });
      if (r.ok) {
        setRevoked((s) => new Set(s).add(k.id));
        toast({ text: 'Clé révoquée', tone: 'success' });
      } else setError(r.error);
    });
  };
  const copy = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t);
      toast({ text: 'Clé copiée', tone: 'success' });
    } catch {
      toast({ text: 'Copie impossible : sélectionnez la clé et copiez-la', tone: 'error' });
    }
  };

  const list = (rows: KeyRow[], title: string) => (
    <div className="mt-6">
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-1 text-[14px] text-[var(--muted)]">Aucune clé pour l’instant.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-3">
          {rows.map((k) => {
            const off = !!k.revokedAt || revoked.has(k.id);
            return (
              <li key={k.id} className="rounded-xl border border-[var(--line)] p-4" style={{ opacity: off ? 0.6 : 1 }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {k.label}{' '}
                      <span className={`rp-chip ${k.access === 'write' ? 'rp-chip-warning' : ''}`}>{k.access === 'write' ? 'Lecture et écriture' : 'Lecture seule'}</span>{' '}
                      {off && <span className="rp-chip">Révoquée</span>}
                    </p>
                    <p className="mt-1 break-all font-mono text-[13px] text-[var(--muted)]">
                      {k.prefix}
                      {k.last4}
                    </p>
                    <p className="mt-1 text-[13px] text-[var(--muted)]">
                      Créée le {fmt(k.createdAt)}
                      {k.createdBy ? ` par ${k.createdBy}` : ''} · dernière utilisation : {fmt(k.lastUsedAt)} · {k.usage.total30} appel(s) sur 30 jours
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Spark days={k.usage.days} />
                    {!off && (
                      <button type="button" className="rp-btn" onClick={() => revoke(k)} disabled={pending}>
                        Révoquer
                      </button>
                    )}
                  </div>
                </div>
                {k.usage.recent.length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-[13px] text-[var(--muted)]">Derniers appels ({k.usage.recent.length})</summary>
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full min-w-[30rem] text-left text-[13px]">
                        <thead>
                          <tr className="text-[var(--muted)]">
                            <th scope="col" className="py-1 pr-3 font-normal">Date</th>
                            <th scope="col" className="py-1 pr-3 font-normal">Appel</th>
                            <th scope="col" className="py-1 pr-3 font-normal">Statut</th>
                            <th scope="col" className="py-1 font-normal">Durée</th>
                          </tr>
                        </thead>
                        <tbody>
                          {k.usage.recent.slice(0, 20).map((e, i) => (
                            <tr key={`${e.at}-${i}`} className="border-t border-[var(--line)]">
                              <td className="py-1 pr-3">{fmt(e.at)}</td>
                              <td className="break-all py-1 pr-3 font-mono">
                                {e.method} {e.path}
                              </td>
                              <td className="py-1 pr-3">{e.status}</td>
                              <td className="py-1">{e.ms} ms</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <div>
      {created && (
        <div className="mb-5 rounded-xl border-2 border-[var(--warning,#b45309)] p-4" role="status">
          <p className="font-semibold">Votre nouvelle clé « {created.key.label} »</p>
          <p className="mt-1 text-[14px]">Copiez-la maintenant : elle ne sera plus jamais affichée. Nous n’en gardons qu’une empreinte.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-[var(--surface-2,rgba(127,127,127,.12))] px-3 py-2 font-mono text-[13px]">{created.token}</code>
            <button type="button" className="rp-btn rp-btn-primary" onClick={() => copy(created.token)}>
              Copier
            </button>
          </div>
          <button type="button" className="mt-3 text-[13px] underline" onClick={() => setCreated(null)}>
            J’ai copié la clé, masquer
          </button>
        </div>
      )}

      {(canSpace || canAgency) && (
        <form onSubmit={create} className="flex flex-col gap-4" aria-label="Créer une clé d’API">
          <label className="block">
            <span className="text-[14px] font-medium">Nom de la clé</span>
            <input className="rp-input mt-1" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder="Ex. : tableau de bord Looker, Zapier" />
          </label>
          <fieldset>
            <legend className="text-[14px] font-medium">Droits</legend>
            <div className="mt-1 flex flex-wrap gap-4 text-[14px]">
              <label className="flex items-center gap-2">
                <input type="radio" name="access" checked={access === 'read'} onChange={() => setAccess('read')} /> Lecture seule (recommandé)
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="access" checked={access === 'write'} onChange={() => setAccess('write')} /> Lecture et écriture (questions suivies, nouvelle mesure)
              </label>
            </div>
          </fieldset>
          {canSpace && canAgency && (
            <fieldset>
              <legend className="text-[14px] font-medium">Portée</legend>
              <div className="mt-1 flex flex-wrap gap-4 text-[14px]">
                <label className="flex items-center gap-2">
                  <input type="radio" name="target" checked={target === 'space'} onChange={() => setTarget('space')} /> Cet espace seulement ({spaceName})
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="target" checked={target === 'agency'} onChange={() => setTarget('agency')} /> Toute l’agence (tous vos espaces clients)
                </label>
              </div>
            </fieldset>
          )}
          {error && (
            <p role="alert" className="text-[14px] text-[var(--danger,#b91c1c)]">
              {error}
            </p>
          )}
          <div>
            <button type="submit" className="rp-btn rp-btn-primary" disabled={pending}>
              {pending ? 'Création…' : 'Créer la clé'}
            </button>
          </div>
        </form>
      )}

      {canSpace && list(spaceKeys, `Clés de l’espace ${spaceName}`)}
      {agencyKeys && list(agencyKeys, 'Clés de l’agence')}
    </div>
  );
}
