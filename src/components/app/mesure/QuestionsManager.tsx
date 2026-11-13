'use client';

// Gestion des questions suivies : liste filtrable, ajout, modification, archivage, import, suggestions.
// Écritures par /api/prompts ; compte démo → modifications gardées sur cet appareil, signalées « démo ».
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ProviderId } from '@/lib/engine/types';
import { Icon } from '../icons';
import { PROVIDER_LABEL } from '../tokens';
import { demoStore } from './demoStore';

export type DemandLevel = 'faible' | 'moyen' | 'fort';
export type Trend = 'hausse' | 'baisse' | 'stable';

export interface QRow {
  id: string;
  text: string;
  theme: string;
  tags: string[];
  intentLabel: string;
  demand: DemandLevel;
  demandSignals: string[];
  active: boolean;
  origin: 'gabarit' | 'suggestion' | 'client' | 'local';
  last: { provider: ProviderId; cited: boolean | null; rank: number | null }[];
  trend: Trend | null;
  measured: boolean;
  /** question sur la marque, déjà posée : hors score (réponses lues sur la page de la question) */
  brand?: boolean;
  /** href de la page détail (null pour une question ajoutée sur l'appareil en démo) */
  href: string | null;
}

interface Suggestion {
  text: string;
  intent: string;
  intentLabel: string;
  theme: string;
  tags: string[];
  why: string;
  source: string;
  demand: { level: DemandLevel };
  queryId?: string;
}

type Panel = null | 'add' | 'import' | 'suggest';
type Status = 'actives' | 'archivees' | 'toutes';
type Msg = { tone: 'ok' | 'demo' | 'err'; text: string } | null;

const DEMAND_LABEL: Record<DemandLevel, string> = { faible: 'faible', moyen: 'moyenne', fort: 'forte' };
const TREND: Record<Trend, { label: string; cls: string; sym: string }> = {
  hausse: { label: 'En hausse', cls: 'rp-chip-success', sym: '↑' },
  baisse: { label: 'En baisse', cls: 'rp-chip-danger', sym: '↓' },
  stable: { label: 'Stable', cls: '', sym: '→' },
};
const SOURCE_LABEL: Record<string, string> = { site: 'Votre site', offre: 'Votre offre', secteur: 'Votre secteur', concurrents: 'Vos concurrents' };

function parseTags(s: string): string[] {
  return [...new Set(s.split(/[,;]/).map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 8);
}

async function call(url: string, method: string, body?: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> | null }> {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body) });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { ok: res.ok, status: res.status, data };
}

export function QuestionsManager({
  businessId,
  demo,
  rows: initialRows,
  quota,
  providers,
  initial,
  exportSlot,
}: {
  businessId: string;
  demo: boolean;
  rows: QRow[];
  quota: { limit: number; used: number };
  providers: ProviderId[];
  initial: { q: string; tag: string | null; theme: string | null; statut: Status };
  exportSlot?: React.ReactNode;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [q, setQ] = useState(initial.q);
  const [tag, setTag] = useState<string | null>(initial.tag);
  const [theme, setTheme] = useState<string | null>(initial.theme);
  const [statut, setStatut] = useState<Status>(initial.statut);
  const [panel, setPanel] = useState<Panel>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Démo : applique les modifications gardées sur cet appareil.
  useEffect(() => {
    if (!demo) return setRows(initialRows);
    const edits = demoStore.edits(businessId);
    const added = demoStore.added(businessId).map<QRow>((p) => ({
      id: p.id,
      text: p.text,
      theme: p.theme,
      tags: p.tags,
      intentLabel: '—',
      demand: 'moyen',
      demandSignals: [],
      active: p.active,
      origin: 'local',
      last: providers.map((provider) => ({ provider, cited: null, rank: null })),
      trend: null,
      measured: false,
      href: null,
    }));
    setRows([...initialRows, ...added].map((r) => ({ ...r, ...(edits[r.id] ?? {}) })));
  }, [demo, businessId, initialRows, providers]);

  // Filtres dans l'URL (sans recharger la page).
  useEffect(() => {
    const u = new URL(window.location.href);
    const set = (k: string, v: string | null) => (v ? u.searchParams.set(k, v) : u.searchParams.delete(k));
    set('q', q.trim() || null);
    set('tag', tag);
    set('theme', theme);
    set('statut', statut === 'actives' ? null : statut);
    window.history.replaceState(null, '', u.pathname + (u.search ? u.search : ''));
  }, [q, tag, theme, statut]);

  const used = demo ? rows.filter((r) => r.active).length : quota.used;
  const full = used >= quota.limit;
  const tags = useMemo(() => [...new Set(rows.flatMap((r) => r.tags))].sort((a, b) => a.localeCompare(b, 'fr')), [rows]);
  const themes = useMemo(() => [...new Set(rows.map((r) => r.theme))].sort((a, b) => a.localeCompare(b, 'fr')), [rows]);
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const shown = rows.filter(
    (r) =>
      (statut === 'toutes' || (statut === 'actives' ? r.active : !r.active)) &&
      (!tag || r.tags.includes(tag)) &&
      (!theme || r.theme === theme) &&
      (!q.trim() || fold(`${r.text} ${r.theme} ${r.tags.join(' ')}`).includes(fold(q.trim()))),
  );

  function done(text: string, local: boolean) {
    setMsg(local ? { tone: 'demo', text: `${text} Compte de démonstration : modification gardée sur cet appareil seulement.` } : { tone: 'ok', text });
    if (!local) router.refresh();
  }

  async function add(input: { text: string; theme?: string; tags?: string[]; origin?: 'suggestion' | 'client'; intent?: string; queryId?: string }): Promise<boolean> {
    setBusy(true);
    setMsg(null);
    try {
      const r = await call('/api/prompts', 'POST', { businessId, ...input });
      if (r.ok) {
        done('Question ajoutée. Elle sera posée aux IA à la prochaine mesure.', false);
        return true;
      }
      if (demo && (r.status === 403 || r.status === 401)) {
        if (full) {
          setMsg({ tone: 'err', text: `Quota atteint : ${quota.limit} questions actives. Archivez une question pour en ajouter une.` });
          return false;
        }
        const n = demoStore.add(businessId, { text: input.text.trim(), theme: input.theme?.trim() || 'Personnalisée', tags: input.tags ?? [], active: true });
        setRows((rs) => [
          ...rs,
          { id: n.id, text: n.text, theme: n.theme, tags: input.tags ?? [], intentLabel: '—', demand: 'moyen', demandSignals: [], active: true, origin: 'local', last: providers.map((provider) => ({ provider, cited: null, rank: null })), trend: null, measured: false, href: null },
        ]);
        done('Question ajoutée.', true);
        return true;
      }
      setMsg({ tone: 'err', text: String(r.data?.error ?? 'La question n’a pas été ajoutée. Réessayez.') });
      return false;
    } catch {
      setMsg({ tone: 'err', text: 'Connexion impossible : la question n’a pas été ajoutée.' });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function patch(row: QRow, p: { text?: string; theme?: string; tags?: string[]; active?: boolean }, okText: string) {
    setBusy(true);
    setMsg(null);
    const local = () => {
      demoStore.edit(businessId, row.id, p);
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, ...p } : r)));
      done(okText, true);
    };
    try {
      if (row.origin === 'local') return local();
      const r = await call(`/api/prompts/${encodeURIComponent(row.id)}`, 'PATCH', p);
      if (r.ok) return done(okText, false);
      if (demo && (r.status === 403 || r.status === 401)) return local();
      setMsg({ tone: 'err', text: String(r.data?.error ?? 'La modification n’a pas été enregistrée. Réessayez.') });
    } catch {
      if (demo) local();
      else setMsg({ tone: 'err', text: 'Connexion impossible : la modification n’a pas été enregistrée.' });
    } finally {
      setBusy(false);
      setEditing(null);
    }
  }

  return (
    <div className="flex flex-col gap-4" data-visite="questions">
      <section className="rp-panel flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:p-5" aria-label="Quota et actions">
        <div className="min-w-0 flex-1">
          <p className="text-[14px]">
            <strong className="rp-num text-[18px]">{used}</strong> question{used > 1 ? 's' : ''} active{used > 1 ? 's' : ''} sur <strong className="rp-num">{quota.limit}</strong> dans votre offre
          </p>
          <div className="mt-2 h-1.5 max-w-[320px] overflow-hidden rounded-full bg-[var(--hair)]" aria-hidden="true">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, (used / Math.max(1, quota.limit)) * 100)}%`, background: full ? 'var(--warning)' : 'var(--primary)' }} />
          </div>
          {full && (
            <p className="mt-2 text-[13px] text-[var(--warning-ink)]">
              Quota atteint : archivez une question pour en suivre une autre, ou{' '}
              <Link href="/tarifs?depuis=app&fonction=questions" className="rp-link">
                passez à l’offre supérieure
              </Link>
              .
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`rp-btn ${panel === 'add' ? '' : 'rp-btn-primary'}`} aria-expanded={panel === 'add'} onClick={() => setPanel(panel === 'add' ? null : 'add')}>
            <Icon name="plus" size={16} /> Ajouter une question
          </button>
          <button type="button" className="rp-btn" aria-expanded={panel === 'suggest'} onClick={() => setPanel(panel === 'suggest' ? null : 'suggest')}>
            <Icon name="spark" size={16} /> Suggestions
          </button>
          <button type="button" className="rp-btn" aria-expanded={panel === 'import'} onClick={() => setPanel(panel === 'import' ? null : 'import')}>
            Importer
          </button>
          {exportSlot}
        </div>
      </section>

      {panel === 'add' && <AddForm busy={busy} full={full} themes={themes} onSubmit={async (v) => (await add({ ...v, origin: 'client' })) && setPanel(null)} onCancel={() => setPanel(null)} />}
      {panel === 'import' && <ImportPanel businessId={businessId} demo={demo} onImported={(n, local) => done(`${n} question${n > 1 ? 's' : ''} importée${n > 1 ? 's' : ''}.`, local)} onLocal={(texts) => texts.forEach((t) => demoStore.add(businessId, { text: t, theme: 'Importée', tags: [], active: true }))} />}
      {panel === 'suggest' && <SuggestPanel businessId={businessId} existing={rows.map((r) => r.text)} full={full} onAccept={(s) => add({ text: s.text, theme: s.theme, tags: s.tags, origin: 'suggestion', intent: s.intent, queryId: s.queryId })} />}

      <p role="status" aria-live="polite" className="text-[14px] empty:hidden">
        {msg && <span className={msg.tone === 'err' ? 'text-[var(--danger-ink)]' : msg.tone === 'demo' ? 'text-[var(--warning-ink)]' : 'text-[var(--success-ink)]'}>{msg.text}</span>}
      </p>

      <section className="rp-panel" aria-labelledby="ql-h">
        <div className="flex flex-col gap-3 px-4 pt-4 lg:px-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="ql-h" className="rp-h2">
              Questions suivies <span className="rp-num font-normal text-[var(--muted)]">({shown.length})</span>
            </h2>
            <span className="rp-segs" role="group" aria-label="Statut">
              {(['actives', 'archivees', 'toutes'] as Status[]).map((s) => (
                <a key={s} href="#" aria-current={statut === s ? 'true' : undefined} onClick={(e) => { e.preventDefault(); setStatut(s); }}>
                  {s === 'actives' ? 'Actives' : s === 'archivees' ? 'Archivées' : 'Toutes'}
                </a>
              ))}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-[200px] flex-1">
              <span className="sr-only">Rechercher une question</span>
              <input type="search" className="rp-input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une question, un thème, un tag" />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
                <Icon name="search" size={16} />
              </span>
            </label>
            {themes.length > 1 && (
              <label>
                <span className="sr-only">Thème</span>
                <select className="rp-select" value={theme ?? ''} onChange={(e) => setTheme(e.target.value || null)}>
                  <option value="">Tous les thèmes</option>
                  {themes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrer par tag">
              <span className="text-[12px] text-[var(--muted)]">Tags</span>
              {tags.map((t) => (
                <button key={t} type="button" aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)} className={`rp-chip ${tag === t ? 'rp-chip-primary' : ''}`} style={{ cursor: 'pointer' }}>
                  #{t}
                </button>
              ))}
            </div>
          )}
        </div>
        <ul className="rp-rows mt-3 border-t border-[var(--hair)]">
          {shown.map((r) =>
            editing === r.id ? (
              <li key={r.id} className="rp-row">
                <EditForm row={r} busy={busy} themes={themes} onCancel={() => setEditing(null)} onSubmit={(p) => patch(r, p, 'Question modifiée.')} />
              </li>
            ) : (
              <li key={r.id} className="rp-row flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-5">
                <div className="min-w-0 flex-1">
                  <p className={`text-[15px] font-medium leading-snug ${r.active ? '' : 'text-[var(--muted)]'}`}>
                    {r.href ? (
                      <Link href={r.href} className="hover:underline">
                        {r.text}
                      </Link>
                    ) : (
                      r.text
                    )}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--muted)]">
                    <span className="font-semibold text-[var(--ink)]">{r.theme}</span>
                    {r.intentLabel !== '—' && r.intentLabel.toLowerCase() !== r.theme.toLowerCase() && <span>· {r.intentLabel}</span>}
                    <span title={r.demandSignals.length ? `Signaux : ${r.demandSignals.join(', ')}` : 'Indice estimé à partir du type de question'}>
                      · Demande {DEMAND_LABEL[r.demand]} <span className="italic">(estimation)</span>
                    </span>
                    {r.tags.map((t) => (
                      <span key={t} className="rp-chip">
                        #{t}
                      </span>
                    ))}
                    {!r.active && <span className="rp-chip rp-chip-warning">Archivée</span>}
                    {r.origin === 'local' && <span className="rp-chip rp-chip-warning">Démo, cet appareil</span>}
                    {r.origin === 'suggestion' && <span className="rp-chip">Suggestion acceptée</span>}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {r.measured ? (
                    <span className="flex items-center gap-2" aria-label="Dernier résultat par IA">
                      {r.last.map((c) => (
                        <span key={c.provider} className="inline-flex items-center gap-1 text-[12px]" title={`${PROVIDER_LABEL[c.provider]} : ${c.cited === null ? 'non mesuré' : c.cited ? `vous cite${c.rank ? `, rang ${c.rank}` : ''}` : 'ne vous cite pas'}`}>
                          <span className="rp-pip" data-on={c.cited ? 'true' : 'false'} aria-hidden="true" />
                          <span className="text-[var(--muted)]">{PROVIDER_LABEL[c.provider].replace(' (Le Chat)', '').slice(0, 10)}</span>
                          <span className="sr-only">{c.cited === null ? 'non mesuré' : c.cited ? 'cité' : 'absent'}</span>
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-[12px] text-[var(--muted)]">{r.brand ? 'Question de marque : hors score, réponses lues' : 'Mesurée à la prochaine mesure'}</span>
                  )}
                  {r.trend && (
                    <span className={`rp-chip ${TREND[r.trend].cls}`}>
                      <span aria-hidden="true">{TREND[r.trend].sym}</span> {TREND[r.trend].label}
                    </span>
                  )}
                  <span className="flex gap-1">
                    <button type="button" className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => setEditing(r.id)} disabled={busy}>
                      Modifier
                    </button>
                    <button
                      type="button"
                      className="rp-btn rp-btn-ghost rp-btn-sm"
                      disabled={busy || (!r.active && full)}
                      title={!r.active && full ? 'Quota atteint : archivez d’abord une autre question' : undefined}
                      onClick={() => patch(r, { active: !r.active }, r.active ? 'Question archivée : son historique est conservé.' : 'Question réactivée.')}
                    >
                      {r.active ? 'Archiver' : 'Réactiver'}
                    </button>
                  </span>
                </div>
              </li>
            ),
          )}
        </ul>
        {!shown.length && (
          <div className="border-t border-[var(--hair)] p-5 text-center">
            <p className="font-semibold">{rows.length ? 'Aucune question pour ces filtres' : 'Aucune question suivie pour l’instant'}</p>
            <p className="mx-auto mt-1 max-w-md text-[14px] text-[var(--muted)]">
              {rows.length ? 'Retirez un filtre ou cherchez un autre mot.' : 'Ajoutez les questions que vos clients posent aux IA, ou partez des 20 suggestions tirées de votre site et de votre secteur.'}
            </p>
            {!rows.length && (
              <button type="button" className="rp-btn rp-btn-primary mt-3" onClick={() => setPanel('suggest')}>
                Voir les suggestions
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function AddForm({ busy, full, themes, onSubmit, onCancel }: { busy: boolean; full: boolean; themes: string[]; onSubmit: (v: { text: string; theme?: string; tags?: string[] }) => void; onCancel: () => void }) {
  const [text, setText] = useState('');
  const [theme, setTheme] = useState('');
  const [tags, setTags] = useState('');
  return (
    <form
      className="rp-panel flex flex-col gap-3 p-4 lg:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ text, theme: theme || undefined, tags: tags ? parseTags(tags) : undefined });
      }}
    >
      <h2 className="rp-h2">Ajouter une question</h2>
      <label className="flex flex-col gap-1 text-[13px] font-medium">
        La question, telle qu’un client la poserait à une IA
        <input className="rp-input" value={text} onChange={(e) => setText(e.target.value)} minLength={5} maxLength={200} required placeholder="Quel plombier appeler en urgence dans le 11ᵉ ?" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[13px] font-medium">
          Thème (facultatif)
          <input className="rp-input" value={theme} onChange={(e) => setTheme(e.target.value)} maxLength={40} list="rp-themes" placeholder="Urgences" />
          <datalist id="rp-themes">
            {themes.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-medium">
          Tags, séparés par des virgules (facultatif)
          <input className="rp-input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="urgence, prix" />
        </label>
      </div>
      <p className="text-[12px] text-[var(--muted)]">De 5 à 200 caractères, sans lien. Une question très proche d’une question suivie est refusée pour ne pas compter deux fois.</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="rp-btn rp-btn-primary" disabled={busy || full}>
          Ajouter la question
        </button>
        <button type="button" className="rp-btn" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}

function EditForm({ row, busy, themes, onSubmit, onCancel }: { row: QRow; busy: boolean; themes: string[]; onSubmit: (p: { text?: string; theme?: string; tags?: string[] }) => void; onCancel: () => void }) {
  const [text, setText] = useState(row.text);
  const [theme, setTheme] = useState(row.theme);
  const [tags, setTags] = useState(row.tags.join(', '));
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const p: { text?: string; theme?: string; tags?: string[] } = {};
        if (text.trim() !== row.text) p.text = text.trim();
        if (theme.trim() !== row.theme) p.theme = theme.trim();
        const t = parseTags(tags);
        if (t.join(',') !== row.tags.join(',')) p.tags = t;
        if (Object.keys(p).length) onSubmit(p);
        else onCancel();
      }}
    >
      <label className="flex flex-col gap-1 text-[12px] text-[var(--muted)]">
        Question
        <input className="rp-input" value={text} onChange={(e) => setText(e.target.value)} minLength={5} maxLength={200} required />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[12px] text-[var(--muted)]">
          Thème
          <input className="rp-input" value={theme} onChange={(e) => setTheme(e.target.value)} maxLength={40} list="rp-themes-edit" />
          <datalist id="rp-themes-edit">
            {themes.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-[var(--muted)]">
          Tags
          <input className="rp-input" value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
      </div>
      {text.trim() !== row.text && <p className="text-[12px] text-[var(--warning-ink)]">Changer le texte démarre une nouvelle série : l’historique de l’ancienne formulation reste consultable dans les réponses.</p>}
      <div className="flex gap-2">
        <button type="submit" className="rp-btn rp-btn-primary rp-btn-sm" disabled={busy}>
          Enregistrer
        </button>
        <button type="button" className="rp-btn rp-btn-sm" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}

function ImportPanel({ businessId, demo, onImported, onLocal }: { businessId: string; demo: boolean; onImported: (n: number, local: boolean) => void; onLocal: (texts: string[]) => void }) {
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState<{ created: { text: string; active: boolean }[]; rejected: { line: number; text: string; reason: string }[]; pausedForQuota: number } | null>(null);
  const [state, setState] = useState<{ busy: boolean; err: string | null }>({ busy: false, err: null });

  async function run(dryRun: boolean) {
    setState({ busy: true, err: null });
    try {
      const r = await call('/api/prompts/import', 'POST', { businessId, content, dryRun });
      if (r.ok && r.data) {
        const d = r.data as unknown as NonNullable<typeof preview>;
        if (dryRun) setPreview(d);
        else {
          onImported(d.created.length, false);
          setPreview(null);
          setContent('');
        }
      } else if (!dryRun && demo && (r.status === 403 || r.status === 401) && preview) {
        onLocal(preview.created.filter((c) => c.active).map((c) => c.text));
        onImported(preview.created.filter((c) => c.active).length, true);
        setPreview(null);
        setContent('');
      } else setState({ busy: false, err: String(r.data?.error ?? 'L’import a échoué. Vérifiez le fichier et réessayez.') });
    } catch {
      setState({ busy: false, err: 'Connexion impossible : rien n’a été importé.' });
      return;
    }
    setState((s) => ({ ...s, busy: false }));
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 200_000) return setState({ busy: false, err: 'Fichier trop lourd (200 Ko au plus).' });
    setContent(await f.text());
    setPreview(null);
  }

  return (
    <section className="rp-panel flex flex-col gap-3 p-4 lg:p-5" aria-labelledby="imp-h">
      <h2 id="imp-h" className="rp-h2">
        Importer des questions
      </h2>
      <p className="text-[13px] text-[var(--muted)]">
        Collez une question par ligne, ou un fichier CSV avec les colonnes <code>question</code>, <code>theme</code>, <code>tags</code>. 500 lignes au plus. Les doublons sont écartés ; au-delà de votre quota, les questions sont importées en pause.
      </p>
      <textarea
        className="rp-input min-h-[140px] font-[inherit]"
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setPreview(null);
        }}
        placeholder={'Quel est le meilleur plombier du 11ᵉ ?\nCombien coûte un dépannage de chaudière à Paris ?'}
        aria-label="Questions à importer"
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="rp-btn rp-btn-sm cursor-pointer">
          Choisir un fichier CSV
          <input type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <button type="button" className="rp-btn rp-btn-sm" disabled={!content.trim() || state.busy} onClick={() => run(true)}>
          Vérifier avant import
        </button>
        <button type="button" className="rp-btn rp-btn-primary rp-btn-sm" disabled={!preview || !preview.created.length || state.busy} onClick={() => run(false)}>
          Importer {preview ? `${preview.created.length} question${preview.created.length > 1 ? 's' : ''}` : ''}
        </button>
      </div>
      {state.err && <p className="text-[13px] text-[var(--danger-ink)]">{state.err}</p>}
      {preview && (
        <div className="text-[13px]">
          <p>
            <strong>{preview.created.length}</strong> à importer
            {preview.pausedForQuota ? `, dont ${preview.pausedForQuota} en pause (quota)` : ''} · <strong>{preview.rejected.length}</strong> écartée{preview.rejected.length > 1 ? 's' : ''}
          </p>
          {preview.rejected.length > 0 && (
            <ul className="mt-1 flex max-h-40 flex-col gap-0.5 overflow-auto text-[var(--muted)]">
              {preview.rejected.slice(0, 30).map((r) => (
                <li key={`${r.line}-${r.text}`}>
                  Ligne {r.line} : {r.reason} {r.text ? `(« ${r.text.slice(0, 60)} »)` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function SuggestPanel({ businessId, existing, full, onAccept }: { businessId: string; existing: string[]; full: boolean; onAccept: (s: Suggestion) => Promise<boolean> }) {
  const [list, setList] = useState<Suggestion[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  useEffect(() => {
    let alive = true;
    call('/api/prompts/suggest', 'POST', { businessId })
      .then((r) => {
        if (!alive) return;
        if (r.ok && Array.isArray(r.data?.suggestions)) setList(r.data!.suggestions as Suggestion[]);
        else setErr(String(r.data?.error ?? 'Les suggestions n’ont pas pu être calculées.'));
      })
      .catch(() => alive && setErr('Connexion impossible : suggestions indisponibles.'));
    return () => {
      alive = false;
    };
  }, [businessId]);
  const have = new Set(existing.map((t) => t.toLowerCase()));
  return (
    <section className="rp-panel p-4 lg:p-5" aria-labelledby="sug-h" aria-busy={!list && !err}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="sug-h" className="rp-h2">
          Questions suggérées {list ? <span className="rp-num font-normal text-[var(--muted)]">({list.length})</span> : null}
        </h2>
        <span className="text-[12px] text-[var(--muted)]">Tirées de votre site, de votre offre, de votre secteur et des questions où vos concurrents sont cités</span>
      </div>
      {!list && !err && (
        <ul className="mt-3 flex flex-col gap-2" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="rp-skel h-10" />
          ))}
        </ul>
      )}
      {err && <p className="mt-3 text-[13px] text-[var(--danger-ink)]">{err}</p>}
      {list && (
        <ul className="mt-3 flex flex-col">
          {list.map((s) => {
            const isIn = accepted.has(s.text) || have.has(s.text.toLowerCase());
            return (
              <li key={s.text} className="flex flex-col gap-2 border-t border-[var(--hair)] py-3 first:border-t-0 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium">{s.text}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                    {SOURCE_LABEL[s.source] ?? s.source} · {s.theme} · demande {DEMAND_LABEL[s.demand.level]} <span className="italic">(estimation)</span> — {s.why}
                  </p>
                </div>
                {isIn ? (
                  <span className="rp-chip rp-chip-success">
                    <Icon name="check" size={13} /> Suivie
                  </span>
                ) : (
                  <button
                    type="button"
                    className="rp-btn rp-btn-sm"
                    disabled={full}
                    title={full ? 'Quota atteint' : undefined}
                    onClick={async () => {
                      if (await onAccept(s)) setAccepted((a) => new Set(a).add(s.text));
                    }}
                  >
                    <Icon name="plus" size={14} /> Suivre
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
