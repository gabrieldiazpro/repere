'use client';
// Mots-clés suivis (APP-SEO) : tableau des positions, ajout, suppression, suggestions. Écrit via /api/v5/seodata/keywords.
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/toast';
import { Sparkline } from '@/components/ui/Sparkline';
import { Delta } from '@/components/ui/Delta';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/app/icons';
import { fmtInt, pathOf } from './model';

export interface KwRow {
  keyword: string;
  volume: number | null;
  mobile: { position: number | null; change: number | null; history: (number | null)[] } | null;
  desktop: { position: number | null; change: number | null; history: (number | null)[] } | null;
  url: string | null;
  aiOverview: boolean | null;
  aiCitesUs: boolean | null;
  features: string[];
  tracked: boolean;
}

export interface Suggestion {
  keyword: string;
  reason: string;
  volume: number | null;
  position: number | null;
}

const FEAT: Record<string, string> = { local_pack: 'Carte locale', people_also_ask: 'Autres questions', featured_snippet: 'Extrait optimisé', shopping: 'Shopping', popular_products: 'Produits populaires', images: 'Images' };

async function post(businessId: string, body: Record<string, unknown>) {
  const r = await fetch('/api/v5/seodata/keywords', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ businessId, ...body }) });
  const j = (await r.json().catch(() => ({}))) as { error?: string; added?: string[]; skipped?: string[] };
  if (!r.ok) throw new Error(j.error ?? 'La modification n’a pas été enregistrée.');
  return j;
}

function Pos({ v }: { v: KwRow['mobile'] }) {
  if (!v) return <span className="ui-caption">—</span>;
  const hist = v.history.filter((x): x is number => x !== null);
  return (
    <span className="inline-flex items-center gap-2">
      <b className="tabular-nums">{v.position ?? '> 20'}</b>
      {v.change !== null && v.change !== 0 && <Delta value={v.change} unit="" label="" />}
      {hist.length > 2 && <Sparkline values={hist.map((x) => 21 - Math.min(20, x))} width={56} height={18} label={`Positions : ${hist.join(', ')}`} className="text-[var(--tone-brand)]" />}
    </span>
  );
}

export function KeywordManager({ businessId, demo, rows, suggestions, limit, canTrack, reason }: { businessId: string; demo: boolean; rows: KwRow[]; suggestions: Suggestion[]; limit: number; canTrack: boolean; reason?: string | null }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState<'volume' | 'position' | 'change'>('volume');
  const router = useRouter();
  const sorted = useMemo(() => {
    const p = (r: KwRow) => r.mobile?.position ?? r.desktop?.position ?? 999;
    const c = (r: KwRow) => r.mobile?.change ?? r.desktop?.change ?? 0;
    return [...rows].sort((a, b) => (sort === 'volume' ? (b.volume ?? -1) - (a.volume ?? -1) : sort === 'position' ? p(a) - p(b) : c(b) - c(a)));
  }, [rows, sort]);
  const hasMobile = rows.some((r) => r.mobile);
  const hasDesktop = rows.some((r) => r.desktop);

  const act = async (body: Record<string, unknown>, ok: string) => {
    if (demo) {
      toast({ text: 'Compte de démonstration : la liste de mots-clés n’est pas modifiable.', tone: 'info' });
      return;
    }
    setBusy(true);
    try {
      const j = await post(businessId, body);
      toast({ text: j.skipped?.length ? `${ok} ${j.skipped.length} ignoré(s) : plafond de votre offre (${limit}).` : ok, tone: 'success' });
      setText('');
      router.refresh();
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const kws = text.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
    if (kws.length) void act({ action: 'add', keywords: kws }, kws.length > 1 ? `${kws.length} mots-clés ajoutés.` : 'Mot-clé ajouté.');
  };

  const th = (id: typeof sort, label: string) => (
    <th className="num" aria-sort={sort === id ? 'descending' : 'none'}>
      <button type="button" onClick={() => setSort(id)}>
        {label}
        {sort === id ? ' ↓' : ''}
      </button>
    </th>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {canTrack ? (
        <form className="seo-kw-add" onSubmit={add}>
          <label className="sr-only" htmlFor="kw-new">
            Mots-clés à suivre
          </label>
          <input id="kw-new" className="rp-input" placeholder="Ajouter des mots-clés (séparés par une virgule)" value={text} onChange={(e) => setText(e.target.value)} maxLength={800} />
          <button className="ui-btn" type="submit" disabled={busy || !text.trim()}>
            <Icon name="plus" size={15} /> Suivre
          </button>
          <span className="ui-caption self-center">
            {rows.length} / {limit} mots-clés
          </span>
        </form>
      ) : (
        <p className="ui-small">{reason ?? 'Le suivi de positions n’est pas inclus dans votre offre.'}</p>
      )}
      {rows.length === 0 ? (
        <EmptyState title="Aucun mot-clé suivi" compact>
          Ajoutez les mots que vos clients tapent sur Google : Repéré relève votre place chaque semaine.
        </EmptyState>
      ) : (
        <div className="seo-table-wrap">
          <table className="seo-table">
            <caption className="sr-only">Positions Google de vos mots-clés suivis</caption>
            <thead>
              <tr>
                <th>Mot-clé</th>
                {th('volume', 'Recherches / mois')}
                {hasMobile && <th>Mobile</th>}
                {hasDesktop && <th>Ordinateur</th>}
                <th>Aperçu IA</th>
                <th>Page classée</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.keyword}>
                  <td className="kw">
                    {r.keyword}
                    {r.features.length > 0 && <span className="block text-[12px] font-normal text-[var(--muted)]">{r.features.map((f) => FEAT[f]).filter(Boolean).join(', ')}</span>}
                  </td>
                  <td className="num">{r.volume === null ? <span title="Volume non fourni">—</span> : fmtInt(r.volume)}</td>
                  {hasMobile && (
                    <td>
                      <Pos v={r.mobile} />
                    </td>
                  )}
                  {hasDesktop && (
                    <td>
                      <Pos v={r.desktop} />
                    </td>
                  )}
                  <td>
                    {r.aiOverview === null ? (
                      <span className="ui-caption">Non relevé</span>
                    ) : r.aiOverview ? (
                      <span className="seo-pill" data-tone={r.aiCitesUs ? 'up' : 'warn'}>
                        {r.aiCitesUs ? 'Vous êtes cité' : 'Vous n’êtes pas cité'}
                      </span>
                    ) : (
                      <span className="ui-caption">Aucun</span>
                    )}
                  </td>
                  <td className="url" title={r.url ?? ''}>
                    {r.url ? pathOf(r.url) : '—'}
                  </td>
                  <td>
                    {canTrack && (
                      <button type="button" className="seo-x" aria-label={`Ne plus suivre « ${r.keyword} »`} onClick={() => act({ action: 'remove', keywords: [r.keyword] }, 'Mot-clé retiré.')} disabled={busy}>
                        <Icon name="close" size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ui-caption mt-2">Trier :             <button type="button" className="rp-link" onClick={() => setSort('volume')}>volume</button>, <button type="button" className="rp-link" onClick={() => setSort('position')}>position</button>, <button type="button" className="rp-link" onClick={() => setSort('change')}>progression</button>. « &gt; 20 » : absent des 20 premiers résultats.
          </p>
        </div>
      )}
      {suggestions.length > 0 && canTrack && (
        <div>
          <h3 className="ui-h2 mb-2">Mots-clés à suivre</h3>
          <ul className="seo-fixes">
            {suggestions.slice(0, 6).map((sg) => (
              <li key={sg.keyword} className="seo-fix" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                <div className="min-w-0">
                  <p className="seo-fix-t">{sg.keyword}</p>
                  <p className="seo-fix-m">
                    {sg.reason}
                    {sg.volume !== null ? ` ${fmtInt(sg.volume)} recherches par mois.` : ''}
                  </p>
                </div>
                <button type="button" className="ui-btn" data-size="sm" disabled={busy} onClick={() => act({ action: 'add', keywords: [sg.keyword], source: 'search-console' }, 'Mot-clé ajouté.')}>
                  <Icon name="plus" size={14} /> Suivre
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
