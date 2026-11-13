'use client';
// Tableaux Search Console (APP-SEO) : requêtes / pages, tri par colonne, recherche.
import { useMemo, useState } from 'react';
import { Tabs } from '@/components/ui/Tabs';
import { fmtInt, fmtPct, fmtPos, pathOf, type QueryRow } from './model';

type Key = 'clicks' | 'impressions' | 'ctr' | 'position';

export function GscTables({ queries, pages }: { queries: QueryRow[]; pages: QueryRow[] }) {
  const [tab, setTab] = useState<'q' | 'p'>('q');
  const [sort, setSort] = useState<Key>('clicks');
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const src = tab === 'q' ? queries : pages;
    const n = q.trim().toLowerCase();
    return src
      .filter((r) => !n || r.key.toLowerCase().includes(n))
      .sort((a, b) => (sort === 'position' ? a.position - b.position : b[sort] - a[sort]))
      .slice(0, 50);
  }, [tab, queries, pages, sort, q]);
  const th = (k: Key, label: string) => (
    <th className="num" aria-sort={sort === k ? (k === 'position' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => setSort(k)}>
        {label}
        {sort === k ? (k === 'position' ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );
  return (
    <div>
      <div className="seo-filters">
        <Tabs variant="pill" label="Afficher" idBase="gsc" value={tab} onChange={(v) => setTab(v as 'q' | 'p')} items={[{ id: 'q', label: 'Requêtes', count: queries.length }, { id: 'p', label: 'Pages', count: pages.length }]} />
        <label className="sr-only" htmlFor="gsc-q">
          Filtrer
        </label>
        <input id="gsc-q" className="seo-select" type="search" placeholder={tab === 'q' ? 'Filtrer les requêtes…' : 'Filtrer les pages…'} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div role="tabpanel" id="gsc-panel" className="ui-tabpanel seo-table-wrap" key={tab}>
        <table className="seo-table">
          <caption className="sr-only">{tab === 'q' ? 'Requêtes Google' : 'Pages'} sur 28 jours</caption>
          <thead>
            <tr>
              <th>{tab === 'q' ? 'Requête' : 'Page'}</th>
              {th('clicks', 'Clics')}
              {th('impressions', 'Impressions')}
              {th('ctr', 'Taux de clic')}
              {th('position', 'Position')}
              {tab === 'q' && <th className="num">Évolution</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const gain = r.previousPosition != null ? Math.round((r.previousPosition - r.position) * 10) / 10 : null;
              return (
                <tr key={r.key}>
                  <td className={tab === 'q' ? 'kw' : 'url'} title={r.key}>
                    {tab === 'q' ? r.key : pathOf(r.key)}
                  </td>
                  <td className="num">{fmtInt(r.clicks)}</td>
                  <td className="num">{fmtInt(r.impressions)}</td>
                  <td className="num">{fmtPct(r.ctr)}</td>
                  <td className="num">{fmtPos(r.position)}</td>
                  {tab === 'q' && (
                    <td className="num" style={{ color: gain == null || Math.abs(gain) < 0.5 ? 'var(--muted)' : gain > 0 ? 'var(--tone-up)' : 'var(--tone-down)' }}>
                      {gain == null ? '—' : Math.abs(gain) < 0.5 ? 'stable' : `${gain > 0 ? '↑ +' : '↓ −'}${fmtPos(Math.abs(gain))}`}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
