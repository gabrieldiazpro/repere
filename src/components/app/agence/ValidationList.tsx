'use client';
// Propositions de l'agent à valider (accès client V6). Valider ou refuser ; l'application reste à l'agence.
import { useState, useTransition } from 'react';
import { decideProposal } from '@/app/app/validation/actions';
import { toast } from '../shell/client';
import { Icon } from '../icons';

export interface ProposalView {
  id: string;
  title: string;
  site: string;
  risk: string;
  proposedAt: string | null;
  changes: { id: string; kind: string; url: string; before: string | null; after: string | null; rationale: string }[];
}

const RISK_FR: Record<string, string> = { low: 'risque faible', medium: 'risque moyen', high: 'risque élevé' };
const KIND_FR: Record<string, string> = { 'meta.title': 'Titre de la page', 'meta.description': 'Description', 'llms.txt': 'Fichier llms.txt', 'robots.txt': 'Fichier robots.txt', 'jsonld': 'Données structurées' };
const frDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export function ValidationList({ businessId, items, canDecide, demo }: { businessId: string; items: ProposalView[]; canDecide: boolean; demo: boolean }) {
  const [done, setDone] = useState<Record<string, 'validated' | 'rejected'>>({});
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const decide = (id: string, d: 'validate' | 'reject') => {
    if (demo) {
      setDone((x) => ({ ...x, [id]: d === 'validate' ? 'validated' : 'rejected' }));
      toast({ text: 'Démo : décision affichée sur cet appareil seulement, rien n’est enregistré.', tone: 'info' });
      return;
    }
    setBusy(id);
    start(async () => {
      const r = await decideProposal(businessId, id, d);
      setBusy(null);
      if (r.ok) {
        setDone((x) => ({ ...x, [id]: d === 'validate' ? 'validated' : 'rejected' }));
        toast({ text: d === 'validate' ? 'Proposition validée : votre agence peut l’appliquer.' : 'Proposition refusée.', tone: 'success' });
      } else toast({ text: r.error, tone: 'error' });
    });
  };
  return (
    <ul className="flex flex-col gap-3">
      {items.map((p) => {
        const d = done[p.id];
        return (
          <li key={p.id} className="ag-prop">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[16px] font-semibold">{p.title}</h3>
                <p className="text-[13px] text-[var(--muted)]">
                  {p.changes.length} modification{p.changes.length > 1 ? 's' : ''} sur {p.site.replace(/^https?:\/\//, '')}, {RISK_FR[p.risk] ?? p.risk}
                  {p.proposedAt ? `, proposée le ${frDate(p.proposedAt)}` : ''}
                </p>
              </div>
              {d ? (
                <p className="flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: d === 'validated' ? 'var(--success-ink)' : 'var(--muted)' }} role="status">
                  <Icon name={d === 'validated' ? 'check' : 'close'} size={16} />
                  {d === 'validated' ? 'Validée' : 'Refusée'}
                </p>
              ) : canDecide ? (
                <div className="flex flex-none gap-2">
                  <button type="button" className="rp-btn" disabled={pending && busy === p.id} onClick={() => decide(p.id, 'reject')}>
                    Refuser
                  </button>
                  <button type="button" className="rp-btn rp-btn-primary v4-press" disabled={pending && busy === p.id} aria-busy={pending && busy === p.id} onClick={() => decide(p.id, 'validate')}>
                    <Icon name="check" size={16} /> Valider
                  </button>
                </div>
              ) : (
                <p className="text-[13px] text-[var(--muted)]">En attente de la validation du client</p>
              )}
            </div>
            <div className="mt-3">
              {p.changes.map((c) => (
                <div key={c.id} className="ag-change">
                  <div>
                    <p className="font-medium">{KIND_FR[c.kind] ?? c.kind}</p>
                    <p className="text-[12px] text-[var(--muted)] [overflow-wrap:anywhere]">{c.url.replace(/^https?:\/\//, '')}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[12px] text-[var(--muted)]">Aujourd’hui</p>
                    <p className="ag-before">{c.before?.trim() ? c.before : <em>vide</em>}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[12px] text-[var(--muted)]">Proposé</p>
                    <p className="ag-after">{c.after?.trim() ? c.after : <em>suppression</em>}</p>
                  </div>
                </div>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
