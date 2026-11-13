'use client';
// Écran Journal : historique complet, filtrable, avec la vérification de la chaîne d'empreintes (comptes réels).
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs } from '@/components/ui/Tabs';
import { Icon } from '../icons';
import { JournalList } from './JournalList';
import { cleanTitle, type JournalEntry } from './model';
import { useAgent } from './state';

type F = 'all' | 'writes' | 'decisions';
const WRITES = new Set<JournalEntry['action']>(['change.applied', 'change.reverted', 'change.failed', 'change.revert_failed', 'applied', 'verified', 'reverted']);
const DECISIONS = new Set<JournalEntry['action']>(['validated', 'rejected', 'edited', 'connection.added', 'connection.removed']);

export function JournalView() {
  const a = useAgent();
  const [f, setF] = useState<F>('all');
  const list = a.journal.filter((e) => (f === 'all' ? true : f === 'writes' ? WRITES.has(e.action) : DECISIONS.has(e.action)));
  const live = a.changeSets.filter((c) => c.status === 'verified' || c.status === 'applied' || c.status === 'partially_applied');

  if (!a.journal.length) {
    return (
      <EmptyState title="Rien au journal pour l’instant" icon={<Icon name="list" />} action={<Link className="ui-btn" href="/app/agent">Voir les propositions</Link>}>
        Chaque proposition, validation, écriture et annulation sera inscrite ici, avec qui l’a faite et quand.
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section aria-labelledby="ag-j-t" className="min-w-0">
        <h2 id="ag-j-t" className="sr-only">
          Historique
        </h2>
        <Tabs
          variant="pill"
          label="Filtrer le journal"
          idBase="ag-j"
          value={f}
          onChange={(v) => setF(v as F)}
          className="mb-4"
          items={[
            { id: 'all', label: 'Tout', count: a.journal.length },
            { id: 'writes', label: 'Écritures sur le site' },
            { id: 'decisions', label: 'Décisions' },
          ]}
        />
        <div role="tabpanel" id="ag-j-panel" className="ui-tabpanel ui-card" key={f}>
          <div className="ui-card-body">{list.length ? <JournalList entries={list} changeSets={a.changeSets} meId={a.meId} /> : <p className="ui-small m-0 text-[var(--muted)]">Rien dans cette catégorie.</p>}</div>
        </div>
      </section>
      <aside className="flex flex-col gap-4">
        <div className="ui-card" data-elevation="flat">
          <div className="ui-card-body flex flex-col gap-2">
            <p className="ui-h2 m-0">En ligne en ce moment</p>
            {live.length ? (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {live.map((c) => (
                  <li key={c.id} className="text-[14px]">
                    <Link href={`/app/agent/${c.id}`} className="font-medium underline-offset-2 hover:underline">
                      {cleanTitle(c.title)}
                    </Link>
                    <span className="block text-[12.5px] text-[var(--muted)]">Annulable depuis sa fiche</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ui-small m-0 text-[var(--muted)]">Aucune modification de l’agent n’est en ligne.</p>
            )}
          </div>
        </div>
        <div className="ui-card" data-elevation="flat">
          <div className="ui-card-body flex flex-col gap-1.5">
            <p className="ui-h2 m-0">Un journal qu’on ne peut pas retoucher</p>
            <p className="ui-small m-0 text-[var(--muted)]">
              Chaque entrée porte l’empreinte de la précédente : une entrée modifiée ou supprimée casserait la chaîne. Une annulation
              ajoute une entrée, elle n’efface rien.
            </p>
            {a.demo && <span className="ag-simtag self-start">Démo : journal d’exemple</span>}
          </div>
        </div>
      </aside>
    </div>
  );
}
