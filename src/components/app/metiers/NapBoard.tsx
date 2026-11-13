'use client';
// Audit NAP sur annuaires : statut par annuaire, incohérences, ajout d'URL de fiche à vérifier (POST /api/local/nap).
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from '@/components/app/icons';
import type { Directory, NapAudit, NapEntryInput, NapRow } from '@/lib/local/types';
import { api, DEMO_SAVED, Notice, useLocalState } from './client';
import { NAP_FIELD_LABEL, NAP_META, taskHref } from './logic';

type Presence = 'yes' | 'no' | '';

function initialEntries(directories: Directory[], entries: NapEntryInput[], audit: NapAudit | null): Record<string, NapEntryInput> {
  const out: Record<string, NapEntryInput> = {};
  for (const d of directories) {
    const e = entries.find((x) => x.directoryId === d.id);
    const row = audit?.rows.find((r) => r.directory.id === d.id);
    out[d.id] = e ?? { directoryId: d.id, present: row ? (row.status === 'absent' ? false : row.status === 'unknown' ? null : true) : null, url: row?.url };
  }
  return out;
}

const presence = (e?: NapEntryInput): Presence => (e?.present === true || e?.url ? 'yes' : e?.present === false ? 'no' : '');

export function NapBoard({ businessId, demo, directories, audit: initialAudit, entries }: { businessId: string; demo: boolean; directories: Directory[]; audit: NapAudit | null; entries: NapEntryInput[] }) {
  const router = useRouter();
  const [audit, setAudit] = useState<NapAudit | null>(initialAudit);
  const [local, setLocal, loaded] = useLocalState<Record<string, NapEntryInput> | null>(`nap:${businessId}`, null);
  const [draft, setDraft] = useState<Record<string, NapEntryInput>>(() => initialEntries(directories, entries, initialAudit));
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'error' | 'success' | 'demo'; text: string } | null>(null);
  const cur = demo && loaded && local ? local : draft;

  const update = (id: string, patch: Partial<NapEntryInput>) => {
    const next = { ...cur, [id]: { ...cur[id], ...patch, directoryId: id } };
    setDraft(next);
    if (demo) setLocal(next);
  };

  async function verify() {
    setBusy(true);
    setMsg(null);
    const r = await api<{ audit: NapAudit; saved: boolean }>('/api/local/nap', { body: { businessId, entries: Object.values(cur), verify: true } });
    setBusy(false);
    if (!r.ok || !r.data) return setMsg({ tone: 'error', text: r.error ?? 'La vérification a échoué.' });
    if (r.data.saved) {
      setAudit(r.data.audit);
      setMsg({ tone: 'success', text: 'Annuaires vérifiés et enregistrés.' });
      router.refresh();
    } else setMsg({ tone: 'demo', text: `${DEMO_SAVED} L’audit affiché reste celui de la démonstration.` });
  }

  const rowOf = (id: string): NapRow | undefined => audit?.rows.find((r) => r.directory.id === id);

  return (
    <div className="flex flex-col gap-4">
      {audit && audit.issues.length > 0 && (
        <section aria-labelledby="nap-issues-h" className="rounded-xl bg-[var(--danger-bg)] p-4 text-[var(--danger-ink)]">
          <h3 id="nap-issues-h" className="flex items-center gap-2 font-semibold">
            <Icon name="alert" size={16} /> {audit.issues.length} incohérence{audit.issues.length > 1 ? 's' : ''} de nom, adresse ou téléphone
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5 text-[14px]">
            {audit.issues.map((i, k) => (
              <li key={k}>
                <strong>{directories.find((d) => d.id === i.directoryId)?.name ?? i.directoryId}</strong> · {NAP_FIELD_LABEL[i.field]} : {i.message}{' '}
                <span className="opacity-80">
                  (attendu « {i.expected} », trouvé « {i.found} »)
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[13px]">Les IA recoupent les annuaires : un numéro différent d’un site à l’autre fait douter de la bonne information. Corrigez-le sur l’annuaire concerné.</p>
        </section>
      )}

      <ul className="flex flex-col divide-y divide-[var(--hair)] rounded-xl border border-[var(--line)]">
        {directories.map((d) => {
          const row = rowOf(d.id);
          const status = row?.status ?? 'unknown';
          const meta = NAP_META[status];
          const e = cur[d.id];
          const isOpen = open === d.id;
          return (
            <li key={d.id} className="p-3 lg:px-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{d.name}</span>
                    <span className={`rp-chip ${meta.chip}`}>{meta.label}</span>
                    {d.priority === 1 && <span className="text-[12px] text-[var(--muted)]">indispensable</span>}
                  </p>
                  <p className="text-[13px] text-[var(--muted)]">{row?.check?.note ?? d.note}</p>
                  {row?.issues.length ? <p className="text-[13px] text-[var(--danger-ink)]">{row.issues.map((i) => i.message).join(' ')}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {status === 'absent' && (
                    <Link href={taskHref(d.task)} className="rp-btn rp-btn-sm rp-btn-primary">
                      S’inscrire sur {d.name}
                    </Link>
                  )}
                  {row?.url && (
                    <a href={row.url} target="_blank" rel="noopener noreferrer" className="rp-btn rp-btn-sm">
                      Voir la fiche <Icon name="external" size={14} />
                    </a>
                  )}
                  <button type="button" className="rp-btn rp-btn-sm rp-btn-ghost" aria-expanded={isOpen} aria-controls={`nap-${d.id}`} onClick={() => setOpen(isOpen ? null : d.id)}>
                    {isOpen ? 'Fermer' : status === 'unknown' ? 'Renseigner' : 'Modifier'}
                  </button>
                </div>
              </div>
              {isOpen && (
                <div id={`nap-${d.id}`} className="mt-3 grid gap-3 rounded-lg bg-[var(--bg)] p-3 sm:grid-cols-2">
                  <fieldset className="sm:col-span-2">
                    <legend className="mb-1 text-[13px] font-semibold">Êtes-vous inscrit sur {d.name} ?</legend>
                    <div className="flex flex-wrap gap-4 text-[14px]">
                      {(
                        [
                          ['yes', 'Oui'],
                          ['no', 'Non'],
                          ['', 'Je ne sais pas'],
                        ] as [Presence, string][]
                      ).map(([v, l]) => (
                        <label key={v || 'na'} className="flex items-center gap-1.5">
                          <input type="radio" name={`p-${d.id}`} checked={presence(e) === v} onChange={() => update(d.id, { present: v === 'yes' ? true : v === 'no' ? false : null, ...(v === 'no' ? { url: undefined } : {}) })} />
                          {l}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {presence(e) === 'yes' && (
                    <>
                      <label className="flex flex-col gap-1 sm:col-span-2">
                        <span className="text-[13px] font-semibold">Adresse de votre fiche sur {d.name}</span>
                        <input className="rp-input" type="url" inputMode="url" placeholder={`https://www.${d.domain}/…`} value={e?.url ?? ''} onChange={(ev) => update(d.id, { url: ev.target.value || undefined })} />
                        <span className="text-[12px] text-[var(--muted)]">Nous lisons la page (en respectant le fichier robots.txt du site) pour retrouver votre nom et votre téléphone.</span>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[13px] font-semibold">Téléphone affiché (facultatif)</span>
                        <input className="rp-input" type="tel" value={e?.listed?.phone ?? ''} onChange={(ev) => update(d.id, { listed: { ...e?.listed, phone: ev.target.value || undefined } })} />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[13px] font-semibold">Adresse affichée (facultatif)</span>
                        <input className="rp-input" value={e?.listed?.address ?? ''} onChange={(ev) => update(d.id, { listed: { ...e?.listed, address: ev.target.value || undefined } })} />
                      </label>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2">
        <div>
          <button type="button" className="rp-btn rp-btn-primary" onClick={verify} disabled={busy} aria-busy={busy}>
            {busy ? 'Vérification en cours…' : 'Enregistrer et vérifier les fiches'}
          </button>
        </div>
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      </div>
    </div>
  );
}
