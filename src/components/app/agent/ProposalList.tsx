'use client';
// Liste des propositions de l'agent + le parcours en 5 étapes (avec le nombre de propositions à chaque étape).
import Link from 'next/link';
import { useState } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '../icons';
import { fmtDate } from '../tokens';
import { blockers, cleanTitle, impactOf, originOf, PLATFORM_NAME, RISK_VIEW, sortChangeSets, STATUS_VIEW, type ChangeSet } from './model';
import { useAgent } from './state';

type Filter = 'todo' | 'running' | 'done' | 'all';

const IN: Record<Exclude<Filter, 'all'>, ChangeSet['status'][]> = {
  todo: ['draft', 'proposed', 'validated'],
  running: ['applying', 'applied', 'partially_applied', 'failed'],
  done: ['verified', 'reverted', 'rejected'],
};

export function AgentFlow() {
  const a = useAgent();
  const n = (s: ChangeSet['status'][]) => a.changeSets.filter((c) => s.includes(c.status)).length;
  const toValidate = n(['proposed', 'draft']);
  const toApply = n(['validated']);
  const live = n(['verified', 'applied', 'partially_applied']);
  const measured = Object.values(a.effects).filter((e) => e.status === 'done').length;
  const plural = (k: number, one: string, many: string) => `${k} ${k > 1 ? many : one}`;
  return (
    <ol className="ag-flow" aria-label="Comment travaille l’agent">
      <li data-on="">
        <span className="ag-flow-t">Repère un problème</span>
        <span className="ag-flow-s">Constats SEO et IA de vos analyses</span>
      </li>
      <li data-on="">
        <span className="ag-flow-t">Prépare la correction</span>
        <span className="ag-flow-s">{plural(a.changeSets.length, 'proposition', 'propositions')}</span>
      </li>
      <li data-wait={toValidate ? '' : undefined} data-on={toValidate ? undefined : ''}>
        <span className="ag-flow-t">Vous validez</span>
        <span className="ag-flow-s">{toValidate ? `${toValidate} en attente de votre accord` : 'Rien en attente'}</span>
      </li>
      <li data-wait={toApply ? '' : undefined} data-on={toApply ? undefined : live ? '' : undefined}>
        <span className="ag-flow-t">Applique et vérifie</span>
        <span className="ag-flow-s">{toApply ? `${toApply} validée${toApply > 1 ? 's' : ''}, à appliquer` : `${plural(live, 'modification en ligne', 'modifications en ligne')}`}</span>
      </li>
      <li data-on={measured ? '' : undefined}>
        <span className="ag-flow-t">Mesure l’effet</span>
        <span className="ag-flow-s">{measured ? `${plural(measured, 'remesure faite', 'remesures faites')}` : 'Remesure 7 jours après'}</span>
      </li>
    </ol>
  );
}

function Row({ cs, flash }: { cs: ChangeSet; flash: boolean }) {
  const st = STATUS_VIEW[cs.status];
  const risk = RISK_VIEW[cs.risk];
  const o = originOf(cs);
  const todo = blockers(cs).length;
  const date = cs.verifiedAt ?? cs.appliedAt ?? cs.proposedAt ?? cs.createdAt;
  return (
    <li>
      <Link href={`/app/agent/${cs.id}`} className={`ag-row${flash ? ' ag-flash' : ''}`} data-risk={cs.risk} aria-describedby={`r-${cs.id}`}>
        <div className="min-w-0">
          <p className="ag-row-t m-0">{cleanTitle(cs.title)}</p>
          <p className="ag-row-m m-0" id={`r-${cs.id}`}>
            <span>{o.label}</span>
            <span>{PLATFORM_NAME[cs.platform]}</span>
            <span>
              {cs.changes.length} modification{cs.changes.length > 1 ? 's' : ''}
            </span>
            {cs.status === 'proposed' || cs.status === 'draft' ? <span>{impactOf(cs).label}</span> : <span>{fmtDate(date, { day: 'numeric', month: 'short' })}</span>}
            <span className="sr-only">{risk.label}</span>
          </p>
        </div>
        <div className="ag-row-side">
          <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
          {todo > 0 && (cs.status === 'proposed' || cs.status === 'draft') ? (
            <StatusBadge tone="warn" icon={false}>
              {todo} champ{todo > 1 ? 's' : ''} à compléter
            </StatusBadge>
          ) : (
            <span className="ui-caption text-[var(--muted)]" aria-hidden="true">
              {risk.label}
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}

export function ProposalList({ highlight }: { highlight?: string | null }) {
  const a = useAgent();
  const all = sortChangeSets(a.changeSets);
  const count = (f: Exclude<Filter, 'all'>) => all.filter((c) => IN[f].includes(c.status)).length;
  const [filter, setFilter] = useState<Filter>(count('todo') ? 'todo' : 'all');
  const list = filter === 'all' ? all : all.filter((c) => IN[filter].includes(c.status));

  if (!all.length) {
    return (
      <EmptyState
        title="Aucune proposition pour l’instant"
        icon={<Icon name="spark" />}
        action={
          <Link className="ui-btn" data-variant="primary" href="/app/technique">
            Voir l’analyse technique
          </Link>
        }
      >
        L’agent prépare ses corrections à partir de l’analyse de votre site (SEO et IA). Elles apparaîtront ici, à valider une par une.
      </EmptyState>
    );
  }

  return (
    <section aria-labelledby="ag-props-t">
      <h2 id="ag-props-t" className="sr-only">
        Propositions
      </h2>
      <Tabs
        variant="pill"
        label="Filtrer les propositions"
        idBase="ag-f"
        value={filter}
        onChange={(v) => setFilter(v as Filter)}
        className="mb-3"
        items={[
          { id: 'todo', label: 'À traiter', count: count('todo') },
          { id: 'running', label: 'En cours', count: count('running') },
          { id: 'done', label: 'Terminées', count: count('done') },
          { id: 'all', label: 'Toutes', count: all.length },
        ]}
      />
      <div role="tabpanel" id="ag-f-panel" className="ui-tabpanel" key={filter}>
        {list.length ? (
          <ul className="ag-list">
            {list.map((cs) => (
              <Row key={cs.id} cs={cs} flash={highlight === cs.id} />
            ))}
          </ul>
        ) : (
          <p className="ui-small text-[var(--muted)]">Rien dans cette catégorie.</p>
        )}
      </div>
    </section>
  );
}
