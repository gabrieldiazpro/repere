'use client';
// Tableau des scénarios (SCENARIOS, V9) : comparaison côte à côte de 2 ou 3 scénarios, scénario personnalisé
// (cases à cocher, recalcul serveur par le même moteur), lancement (brouillons agent + tâches « vous »).
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from '@/components/ui/toast';
import { Disclosure } from '@/components/ui/Disclosure';
import { Icon } from '@/components/app/icons';
import type { Candidate, PresetId, SectionDelta, SimResult, Who } from '@/lib/scenarios/types';
import { lancerScenario, simulerScenario } from '../actions';
import { ScoreBars } from './ScoreBars';

const WHO_LABEL: Record<Who, string> = { auto: 'Repéré automatiquement', guide: 'Repéré en guidé', vous: 'Vous' };
const WHO_SHORT: Record<Who, string> = { auto: 'Repéré (auto)', guide: 'Repéré (guidé)', vous: 'Vous' };
const WHO_HINT: Record<Who, string> = {
  auto: 'L’agent prépare la modification ; vous la validez avant publication.',
  guide: 'L’agent rédige une proposition ; vous la relisez et la validez.',
  vous: 'Une tâche dans votre Centre d’actions, avec la marche à suivre.',
};

export interface BoardScenario {
  id: PresetId;
  title: string;
  lead: string;
  keys: string[];
  result: SimResult;
}

export function fmtMinutes(m: number): string {
  if (m < 60) return `≈ ${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `≈ ${h} h ${String(r).padStart(2, '0')}` : `≈ ${h} h`;
}

const pathOf = (u: string) => {
  try {
    const x = new URL(u);
    return `${x.pathname}${x.search}` || '/';
  } catch {
    return u;
  }
};

const sign = (d: number) => (d > 0 ? `+${d}` : d < 0 ? `−${Math.abs(d)}` : '=');

function WhoChips({ who }: { who: Record<Who, number> }) {
  const list = (['auto', 'guide', 'vous'] as Who[]).filter((w) => who[w] > 0);
  if (!list.length) return null;
  return (
    <p className="scn-who" aria-label="Qui fait le travail">
      {list.map((w) => (
        <span key={w} data-who={w} title={WHO_HINT[w]}>
          {WHO_SHORT[w]} : {who[w]}
        </span>
      ))}
    </p>
  );
}

function Detail({ r, titles }: { r: SimResult; titles: Map<string, string> }) {
  const changed = r.sections.filter((s) => s.after !== s.before);
  return (
    <Disclosure title="Le détail" summary={`${r.applied.length} simulée(s)${r.excluded.length ? `, ${r.excluded.length} non simulée(s)` : ''}`}>
      {changed.length > 0 && (
        <>
          <p className="ui-caption mb-1">Sections qui bougent</p>
          <ul className="scn-list mb-3">
            {changed.map((s) => (
              <li key={`${s.origin}:${s.id}`} className="scn-plain">
                {s.label} <span className="scn-origin">{s.origin === 'seo' ? 'Google' : 'IA'}</span> : {s.before} → <b>{s.after}</b> ({sign(s.after - s.before)})
              </li>
            ))}
          </ul>
        </>
      )}
      {r.applied.length > 0 && (
        <>
          <p className="ui-caption mb-1">Corrections simulées</p>
          <ul className="scn-list mb-3">
            {r.applied.map((a) => {
              const rem = r.remaining.find((x) => x.key === a.key);
              return (
                <li key={a.key} className="scn-plain">
                  {a.title}
                  <small>
                    {r.resolved.includes(a.key) ? <span className="scn-ok">Réglé selon nos contrôles</span> : rem ? `Encore présent : ${rem.before} → ${rem.after} élément(s)` : null}
                    {a.notes.map((n) => ` · ${n}`)}
                    {a.skipped.length ? ` · ${a.skipped.length} élément(s) non rejoué(s) : ${a.skipped[0]}` : ''}
                  </small>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {r.excluded.length > 0 && (
        <>
          <p className="ui-caption mb-1">Non simulées (comptées dans le temps, pas dans les scores)</p>
          <ul className="scn-list mb-3">
            {r.excluded.map((x) => (
              <li key={x.key} className="scn-plain">
                {titles.get(x.key) ?? x.title}
                <small>{x.reason}</small>
              </li>
            ))}
          </ul>
        </>
      )}
      {r.appeared.length > 0 && (
        <>
          <p className="ui-caption mb-1">À surveiller : constats qui apparaîtraient ou s’aggraveraient</p>
          <ul className="scn-list">
            {r.appeared.map((x) => (
              <li key={x.key} className="scn-plain">
                {x.title}
              </li>
            ))}
          </ul>
        </>
      )}
    </Disclosure>
  );
}

function LaunchButton({ keys, title, demo, r }: { keys: string[]; title: string; demo: boolean; r: SimResult }) {
  const [ask, setAsk] = useState(false);
  const [pending, start] = useTransition();
  const agent = r.who.auto + r.who.guide;
  const you = r.who.vous;
  if (!keys.length) return null;
  const go = () =>
    start(async () => {
      const res = await lancerScenario(keys, title);
      setAsk(false);
      if (res.ok) {
        const parts = [res.changeSets ? `${res.changeSets} brouillon(s) pour l’agent, à valider` : null, res.tasks ? `${res.tasks} tâche(s) dans votre Centre d’actions` : null].filter(Boolean);
        toast({ text: `Scénario lancé : ${parts.join(' et ') || 'rien de nouveau à créer'}. Rien n’est publié sans votre validation.`, tone: 'success', href: res.changeSets ? '/app/validation' : '/app/actions', linkLabel: res.changeSets ? 'Voir les brouillons' : 'Voir les tâches' });
      } else toast({ text: res.error, tone: res.code === 'demo_read_only' ? 'info' : 'error' });
    });
  if (!ask)
    return (
      <button type="button" className="ui-btn" data-variant="primary" onClick={() => setAsk(true)}>
        Lancer ce scénario <Icon name="chevron" size={16} />
      </button>
    );
  return (
    <div className="scn-confirm" role="group" aria-label="Confirmer le lancement">
      <p className="m-0">
        {agent > 0 && <>L’agent préparera <b>{agent}</b> correction(s) en brouillon : rien n’est publié sans votre validation. </>}
        {you > 0 && <><b>{you}</b> tâche(s) iront dans votre Centre d’actions. </>}
        {demo && <>Compte de démonstration : rien ne sera créé.</>}
      </p>
      <div className="scn-confirm-acts">
        <button type="button" className="ui-btn" data-variant="primary" onClick={go} disabled={pending} aria-busy={pending}>
          {pending ? 'Lancement…' : 'Confirmer'}
        </button>
        <button type="button" className="ui-btn" onClick={() => setAsk(false)} disabled={pending}>
          Annuler
        </button>
      </div>
    </div>
  );
}

function ScenarioCard({ s, demo, titles }: { s: BoardScenario; demo: boolean; titles: Map<string, string> }) {
  const r = s.result;
  return (
    <article className="ui-card scn-card" aria-labelledby={`scn-${s.id}`}>
      <div className="ui-card-body scn-card" style={{ gap: 'var(--sp-3)' }}>
        <h3 id={`scn-${s.id}`} className="scn-h3">
          {s.title}
        </h3>
        <p className="scn-card-lead">{s.lead}</p>
        {s.keys.length === 0 ? (
          <p className="scn-note">Aucune correction ne correspond à ce scénario sur votre dernière exploration.</p>
        ) : (
          <>
            <ScoreBars before={r.before} after={r.after} />
            <ul className="scn-facts">
              <li>
                <b>{s.keys.length}</b> correction(s), dont <b>{r.applied.length}</b> simulée(s)
              </li>
              <li>
                <b>{r.pages}</b> page(s) concernée(s)
              </li>
              <li>
                <b>{fmtMinutes(r.minutes)}</b> de votre côté (estimé d’après l’effort de chaque contrôle)
              </li>
            </ul>
            <WhoChips who={r.who} />
            {r.after.seo === r.before.seo && r.sections.some((x) => x.origin === 'seo' && x.after !== x.before) && (
              <p className="scn-note">Le score Google est arrondi à 5 points : des sections progressent sans changer l’arrondi.</p>
            )}
            {r.appeared.length > 0 && <p className="scn-warn">{r.appeared.length} constat(s) à surveiller (voir le détail).</p>}
            <div className="scn-card-foot">
              <Detail r={r} titles={titles} />
              <LaunchButton keys={s.keys} title={s.title} demo={demo} r={r} />
            </div>
          </>
        )}
      </div>
    </article>
  );
}

function SectionsTable({ list, base }: { list: BoardScenario[]; base: SectionDelta[] }) {
  const rows = base.filter((b) => list.some((s) => s.result.sections.some((x) => x.origin === b.origin && x.id === b.id && x.after !== x.before)));
  if (!rows.length) return <p className="ui-small">Aucune section ne change dans les scénarios comparés.</p>;
  return (
    <div className="scn-table-wrap">
      <table className="scn-table">
        <caption className="sr-only">Score de chaque section aujourd’hui et après chaque scénario, sur 100</caption>
        <thead>
          <tr>
            <th scope="col">Section</th>
            <th scope="col">Aujourd’hui</th>
            {list.map((s) => (
              <th scope="col" key={s.id}>
                {s.title.replace(/^Les 3 corrections les plus rentables$/, '3 corrections').replace(/^Tout ce que Repéré peut faire seul$/, 'Repéré seul')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={`${b.origin}:${b.id}`}>
              <th scope="row" style={{ fontWeight: 500 }}>
                {b.label}
                <span className="scn-origin">{b.origin === 'seo' ? 'Google' : 'IA'}</span>
              </th>
              <td>{b.before}</td>
              {list.map((s) => {
                const x = s.result.sections.find((y) => y.origin === b.origin && y.id === b.id);
                const d = (x?.after ?? b.before) - b.before;
                return (
                  <td key={s.id}>
                    {x?.after ?? b.before}
                    {d !== 0 && <small data-d={d > 0 ? 'up' : 'down'}>{sign(d)}</small>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Filter = 'all' | Who;

export function ScenarioBoard({ scenarios, ranked, base, demo }: { scenarios: BoardScenario[]; ranked: Candidate[]; base: SectionDelta[]; demo: boolean }) {
  const titles = useMemo(() => new Map(ranked.map((c) => [c.key, c.title])), [ranked]);
  const [custom, setCustom] = useState<string[]>(() => scenarios[0]?.keys ?? []);
  const [customResult, setCustomResult] = useState<SimResult | null>(() => scenarios[0]?.result ?? null);
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<Filter>('all');
  const [compare, setCompare] = useState<PresetId[]>(() => scenarios.map((s) => s.id).slice(0, 3));
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      start(async () => {
        const r = await simulerScenario(custom);
        if (r.ok) setCustomResult(r.result);
        else toast({ text: r.error, tone: 'error' });
      });
    }, 350);
    return () => clearTimeout(t);
  }, [custom]);

  const perso: BoardScenario | null = customResult
    ? { id: 'perso', title: 'Personnalisé', lead: 'Les corrections que vous avez cochées ci-dessous.', keys: custom, result: customResult }
    : null;
  const all = [...scenarios, ...(perso ? [perso] : [])];
  const shown = all.filter((s) => compare.includes(s.id));

  const toggleCompare = (id: PresetId) =>
    setCompare((c) => (c.includes(id) ? (c.length > 1 ? c.filter((x) => x !== id) : c) : c.length >= 3 ? [...c.slice(1), id] : [...c, id]));

  // Les corrections simulables d'abord (ordre de priorité conservé), puis celles qui ne le sont pas.
  const visible = ranked.filter((c) => filter === 'all' || c.who === filter).sort((a, b) => Number(!!a.unsimulable) - Number(!!b.unsimulable));
  const toggle = (k: string) => setCustom((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));

  return (
    <div className="scn-stack">
      <section className="ui-card" aria-labelledby="scn-cmp">
        <div className="ui-card-head">
          <h2 id="scn-cmp" className="ui-h2 min-w-0 flex-1">
            Comparer les scénarios
          </h2>
        </div>
        <div className="ui-card-body scn-stack">
          <div className="scn-compare-pick" role="group" aria-label="Scénarios comparés (3 au plus)">
            <span>Comparer (3 au plus) :</span>
            {all.map((s) => (
              <button key={s.id} type="button" className="scn-chip" aria-pressed={compare.includes(s.id)} onClick={() => toggleCompare(s.id)}>
                {s.id === 'perso' ? 'Personnalisé' : s.title}
              </button>
            ))}
          </div>
          <div className="scn-cols" data-n={shown.length}>
            {shown.map((s) => (
              <ScenarioCard key={s.id} s={s} demo={demo} titles={titles} />
            ))}
          </div>
          <div>
            <h3 className="scn-h3 mb-2">Section par section</h3>
            <SectionsTable list={shown} base={base} />
          </div>
        </div>
      </section>

      <section className="ui-card" aria-labelledby="scn-perso">
        <div className="ui-card-head">
          <h2 id="scn-perso" className="ui-h2 min-w-0 flex-1">
            Personnalisé : cochez vos corrections
          </h2>
          <div className="ui-small">{pending ? 'Calcul…' : `${custom.length} cochée(s)`}</div>
        </div>
        <div className="ui-card-body scn-builder">
          <div>
            <div className="scn-filter" role="group" aria-label="Filtrer par qui fait le travail">
              {(['all', 'auto', 'guide', 'vous'] as Filter[]).map((f) => (
                <button key={f} type="button" className="scn-chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  {f === 'all' ? `Toutes (${ranked.length})` : `${WHO_LABEL[f]} (${ranked.filter((c) => c.who === f).length})`}
                </button>
              ))}
            </div>
            <ul className="scn-list">
              {visible.map((c) => {
                const id = `scn-c-${c.key.replace(/[^a-z0-9]/gi, '-')}`;
                return (
                  <li key={c.key} className="scn-item" data-off={!!c.unsimulable}>
                    <input id={id} type="checkbox" checked={custom.includes(c.key)} onChange={() => toggle(c.key)} />
                    <label htmlFor={id}>
                      <span className="scn-item-t">{c.title}</span>
                      <span className="scn-item-m">
                        <span>{c.sectionLabel}</span>
                        <span>{WHO_LABEL[c.who]}</span>
                        <span>{fmtMinutes(c.minutes)}</span>
                        {c.pages[0] && <span>{pathOf(c.pages[0])}{c.affectedCount > 1 ? ` +${c.affectedCount - 1}` : ''}</span>}
                        {c.unsimulable ? (
                          <span>Non simulé : {c.unsimulable}</span>
                        ) : c.alone ? (
                          <span>
                            Seule : <b>Google {sign(c.alone.seo)}</b> · <b>IA {sign(c.alone.geo)}</b>
                            {c.alone.seo === 0 && c.alone.geo === 0 && c.alone.sections !== 0 ? ` (sections ${sign(c.alone.sections)})` : ''}
                          </span>
                        ) : (
                          <span>Effet seul non calculé (site volumineux) : cochez-la pour le voir</span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="scn-builder-side" aria-live="polite">
            {perso && customResult ? (
              <ScenarioCard s={perso} demo={demo} titles={titles} />
            ) : (
              <p className="ui-small">Cochez des corrections pour voir leur effet sur vos contrôles.</p>
            )}
            <p className="scn-note mt-2">
              <Link href="/app/agent" className="rp-link">Agent</Link> : les brouillons à valider · <Link href="/app/actions" className="rp-link">Centre d’actions</Link> : vos tâches
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
