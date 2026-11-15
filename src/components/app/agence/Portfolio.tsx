'use client';
// Portefeuille d'agence : tous les clients, tri et filtres, accès en un clic (V6, agent AGENCES).
import Link from 'next/link';
import { useMemo, useRef, useState, useTransition } from 'react';
import { Sparkline } from '@/components/ui/Sparkline';
import { Delta } from '@/components/ui/Delta';
import { Icon } from '../icons';
import { toast } from '../shell/client';
import { filterClients, sortClients, SEGMENT_LABEL, type PortfolioClient, type PortfolioFilter, type SortKey } from '@/lib/agency/portfolio';
import { exportHref, openHref } from '@/lib/agency/links';
import { CLIENT_EXPORT_KINDS, CLIENT_EXPORT_LABELS } from '@/lib/agency/exports';
import { inviteClientAction } from '@/app/app/agence/actions';

const VIEWS: { v: NonNullable<PortfolioFilter['view']>; label: string }[] = [
  { v: 'all', label: 'Tous' },
  { v: 'alert', label: 'À traiter' },
  { v: 'pending', label: 'À valider' },
  { v: 'ok', label: 'Au vert' },
];

const SORTS: { v: SortKey; label: string }[] = [
  { v: 'priority', label: 'Priorité' },
  { v: 'name', label: 'Nom' },
  { v: 'ai', label: 'Score IA' },
  { v: 'aiDelta', label: 'Évolution IA' },
  { v: 'seo', label: 'Score Google' },
  { v: 'seoDelta', label: 'Évolution Google' },
  { v: 'pending', label: 'Propositions à valider' },
];

const STATUS: Record<PortfolioClient['status'], { label: string; tone: string }> = {
  alert: { label: 'À traiter', tone: 'down' },
  watch: { label: 'À surveiller', tone: 'warn' },
  ok: { label: 'Au vert', tone: 'up' },
  setup: { label: 'Démarrage', tone: 'neutral' },
};

function Score({ kind, s, trend }: { kind: 'IA' | 'Google'; s: { score: number; delta: number | null } | null; trend?: number[] }) {
  if (!s) return <span className="ag-score-none">{kind === 'IA' ? 'Première mesure à venir' : 'Pas encore d’audit'}</span>;
  return (
    <span className="ag-score">
      <span className="ag-score-num rp-num">
        {s.score}
        <span className="ag-score-unit">/100</span>
      </span>
      {s.delta !== null ? <Delta value={s.delta} unit=" pt" label={`${kind} : depuis la mesure précédente comparable`} /> : <span className="ag-score-first">1ʳᵉ mesure</span>}
      {trend && trend.length > 1 && <Sparkline values={trend} width={64} height={22} area={false} label={`${kind} : ${trend.join(', ')}`} className="ag-spark" />}
    </span>
  );
}

function Alerts({ c }: { c: PortfolioClient }) {
  const shown = c.alerts.filter((a) => a.kind !== 'ai_up' || c.alerts.length === 1);
  if (!shown.length) return <span className="ag-quiet">Rien à signaler</span>;
  const [first, ...rest] = shown;
  return (
    <span className="ag-alert" data-tone={first.tone}>
      <Icon name={first.tone === 'info' ? 'info' : 'alert'} size={14} />
      <span>{first.label}</span>
      {rest.length > 0 && <span className="ag-more" title={rest.map((r) => r.label).join('\n')}>+{rest.length}</span>}
    </span>
  );
}

function InviteDialog({ client, demo, onClose }: { client: PortfolioClient; demo: boolean; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (demo) {
      setMsg('Démo : aucune invitation n’est envoyée. Sur votre compte Agence, votre client reçoit un lien valable 14 jours.');
      return;
    }
    start(async () => {
      const r = await inviteClientAction(client.id, { email, name });
      if (r.ok) {
        toast({ text: `Invitation envoyée à ${r.data.email}`, tone: 'success' });
        onClose();
      } else setMsg(r.error);
    });
  };
  return (
    <div className="ag-dialog-back" role="presentation" onClick={onClose}>
      <form className="ag-dialog" role="dialog" aria-modal="true" aria-labelledby="ag-inv-t" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 id="ag-inv-t" className="rp-display text-[19px]">
          Inviter {client.name} sur son espace
        </h2>
        <p className="mt-1 text-[14px] text-[var(--muted)]">Votre client voit ses résultats et valide les corrections proposées par l’agent. Il ne peut modifier aucun réglage ; c’est vous qui appliquez.</p>
        <label className="mt-4 block text-[13px] font-medium">
          E-mail du client
          <input className="rp-input mt-1 w-full" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@entreprise.fr" />
        </label>
        <label className="mt-3 block text-[13px] font-medium">
          Nom (facultatif)
          <input className="rp-input mt-1 w-full" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </label>
        {msg && (
          <p className="mt-3 text-[13px] text-[var(--warning-ink)]" role="status">
            {msg}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className="rp-btn" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="rp-btn rp-btn-primary" disabled={pending} aria-busy={pending}>
            Envoyer l’invitation
          </button>
        </div>
      </form>
    </div>
  );
}

function RowMenu({ c, canInvite, onInvite }: { c: PortfolioClient; canInvite: boolean; onInvite: () => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details className="ag-menu" ref={ref}>
      <summary className="rp-btn rp-btn-sm" aria-label={`Plus d’actions pour ${c.name}`}>
        <Icon name="more" size={16} />
      </summary>
      <div className="ag-menu-pop" role="menu">
        <a role="menuitem" href={openHref(c.id, '/app/rapports/mensuel')}>
          <Icon name="file" size={15} /> Rapport mensuel
        </a>
        <a role="menuitem" href={openHref(c.id, '/app/validation')}>
          <Icon name="check" size={15} /> Propositions de l’agent
        </a>
        {CLIENT_EXPORT_KINDS.map((k) => (
          <a key={k} role="menuitem" href={exportHref(c.id, k)} download>
            <Icon name="download" size={15} /> CSV : {CLIENT_EXPORT_LABELS[k].toLowerCase()}
          </a>
        ))}
        {canInvite && (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              ref.current?.removeAttribute('open');
              onInvite();
            }}
          >
            <Icon name="users" size={15} /> Inviter le client
          </button>
        )}
      </div>
    </details>
  );
}

export function Portfolio({ clients, demo, canInvite }: { clients: PortfolioClient[]; demo: boolean; canInvite: boolean }) {
  const [q, setQ] = useState('');
  const [segment, setSegment] = useState<PortfolioFilter['segment']>('all');
  const [view, setView] = useState<NonNullable<PortfolioFilter['view']>>('all');
  const [sort, setSort] = useState<SortKey>('priority');
  const [invite, setInvite] = useState<PortfolioClient | null>(null);
  const segments = useMemo(() => [...new Set(clients.map((c) => c.segment))], [clients]);
  const counts = useMemo(
    () => ({ all: clients.length, alert: filterClients(clients, { view: 'alert' }).length, pending: filterClients(clients, { view: 'pending' }).length, ok: filterClients(clients, { view: 'ok' }).length }),
    [clients],
  );
  const rows = useMemo(() => sortClients(filterClients(clients, { q, segment, view }), sort, sort === 'name' ? 'asc' : 'desc'), [clients, q, segment, view, sort]);

  return (
    <section aria-labelledby="ag-list-h" className="ag-board">
      <h2 id="ag-list-h" className="sr-only">
        Vos clients
      </h2>
      <div className="ag-tools">
        <div role="tablist" aria-label="Filtrer les clients" className="ag-views">
          {VIEWS.map((o) => (
            <button key={o.v} type="button" role="tab" aria-selected={view === o.v} className="ag-view" onClick={() => setView(o.v)}>
              {o.label}
              <span className="ag-view-n">{counts[o.v]}</span>
            </button>
          ))}
        </div>
        <div className="ag-filters">
          <label className="ag-search">
            <Icon name="search" size={16} />
            <span className="sr-only">Rechercher un client</span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un client" />
          </label>
          {segments.length > 1 && (
            <label>
              <span className="sr-only">Parcours</span>
              <select className="rp-input ag-select" value={segment} onChange={(e) => setSegment(e.target.value as PortfolioFilter['segment'])}>
                <option value="all">Tous les parcours</option>
                {segments.map((s) => (
                  <option key={s} value={s}>
                    {SEGMENT_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span className="sr-only">Trier par</span>
            <select className="rp-input ag-select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              {SORTS.map((o) => (
                <option key={o.v} value={o.v}>
                  Trier : {o.label.toLowerCase()}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="ag-empty">
          <p className="font-semibold">Aucun client ne correspond.</p>
          <button type="button" className="rp-btn rp-btn-sm mt-2" onClick={() => { setQ(''); setSegment('all'); setView('all'); }}>
            Afficher tous les clients
          </button>
        </div>
      ) : (
        <ul className="ag-rows" aria-live="polite">
          <li className="ag-row ag-head" aria-hidden="true">
            <span>Client</span>
            <span>Visibilité dans les IA</span>
            <span>Audit Google du site</span>
            <span>Alertes</span>
            <span>À valider</span>
            <span />
          </li>
          {rows.map((c) => (
            <li key={c.id} className="ag-row" data-status={c.status}>
              <span className="ag-client">
                <span className="ag-status" data-tone={STATUS[c.status].tone} title={STATUS[c.status].label}>
                  <span className="sr-only">{STATUS[c.status].label}</span>
                </span>
                <span className="min-w-0">
                  <span className="ag-name">
                    {c.openable ? <Link href={openHref(c.id)}>{c.name}</Link> : c.name}
                    {c.demo && <span className="ag-tag">démo</span>}
                  </span>
                  <span className="ag-desc">
                    {SEGMENT_LABEL[c.segment]}
                    {c.descriptor ? `, ${c.descriptor}` : ''}
                    {c.clientSeats > 0 ? `. Client invité` : ''}
                  </span>
                </span>
              </span>
              <span className="ag-cell" data-label="IA">
                <Score kind="IA" s={c.ai} trend={c.aiTrend} />
                {c.ai && <span className="ag-margin">marge ± {c.ai.margin}</span>}
              </span>
              <span className="ag-cell" data-label="Google">
                <Score kind="Google" s={c.seo} />
              </span>
              <span className="ag-cell ag-cell-alert" data-label="Alertes">
                <Alerts c={c} />
              </span>
              <span className="ag-cell" data-label="À valider">
                {c.pending > 0 ? (
                  <a className="ag-pending" href={openHref(c.id, '/app/validation')}>
                    {c.pending} proposition{c.pending > 1 ? 's' : ''}
                  </a>
                ) : (
                  <span className="ag-quiet">Aucune</span>
                )}
              </span>
              <span className="ag-actions">
                {c.openable ? (
                  <a className="rp-btn rp-btn-sm" href={openHref(c.id)}>
                    Ouvrir
                    <Icon name="chevron" size={14} />
                  </a>
                ) : (
                  <span className="ag-quiet text-[12px]">Exemple sans espace</span>
                )}
                {c.openable && <RowMenu c={c} canInvite={canInvite} onInvite={() => setInvite(c)} />}
              </span>
            </li>
          ))}
        </ul>
      )}
      {invite && <InviteDialog client={invite} demo={demo} onClose={() => setInvite(null)} />}
    </section>
  );
}
