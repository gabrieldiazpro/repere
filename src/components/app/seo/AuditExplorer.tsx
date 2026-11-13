'use client';
// Explorateur de l'audit SEO (APP-SEO) : scores par section, filtres sévérité / section / correction automatique,
// pages concernées, export CSV des constats filtrés.
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Tabs } from '@/components/ui/Tabs';
import { ProgressBar } from '@/components/ui/Progress';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Icon } from '@/components/app/icons';
import { SEVERITY_LABEL, SEVERITY_TONE, canAutoFix, findingsCsv, fmtInt, pathOf, type RankedFix } from './model';

type Sev = 'all' | 'top' | 'medium' | 'low';
const SEV_OF: Record<Exclude<Sev, 'all'>, RankedFix['severity'][]> = { top: ['critical', 'high'], medium: ['medium'], low: ['low', 'info'] };

export interface SectionLite {
  id: string;
  label: string;
  score: number;
  applicable: boolean;
  count: number;
}

export function AuditExplorer({ findings, sections, fileName, initial }: { findings: RankedFix[]; sections: SectionLite[]; fileName: string; initial?: string | null }) {
  const [sev, setSev] = useState<Sev>('all');
  const [section, setSection] = useState('all');
  const [auto, setAuto] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!initial) return;
    const el = document.getElementById(`constat-${initial}`) as HTMLDetailsElement | null;
    if (el) {
      el.open = true;
      el.scrollIntoView({ block: 'center' });
      el.querySelector('summary')?.focus();
    }
  }, [initial]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return findings
      .filter((f) => sev === 'all' || SEV_OF[sev].includes(f.severity))
      .filter((f) => section === 'all' || f.section === section)
      .filter((f) => !auto || canAutoFix(f))
      .filter((f) => !needle || f.title.toLowerCase().includes(needle) || f.affected.some((a) => a.url.toLowerCase().includes(needle)))
      .sort((a, b) => b.priority - a.priority || b.affectedCount - a.affectedCount);
  }, [findings, sev, section, auto, q]);

  const count = (s: Sev) => findings.filter((f) => s === 'all' || SEV_OF[s].includes(f.severity)).length;

  const exportCsv = () => {
    const blob = new Blob([findingsCsv(shown)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <div className="seo-grid seo-grid-main">
      <div className="ui-card" data-elevation="base" style={{ padding: 'var(--sp-5)' }}>
        <div className="seo-filters">
          <Tabs
            variant="pill"
            label="Gravité"
            idBase="sev"
            value={sev}
            onChange={(v) => setSev(v as Sev)}
            items={[
              { id: 'all', label: 'Tous', count: count('all') },
              { id: 'top', label: 'Importants', count: count('top') },
              { id: 'medium', label: 'Moyens', count: count('medium') },
              { id: 'low', label: 'Mineurs', count: count('low') },
            ]}
          />
          <label className="sr-only" htmlFor="seo-sec">
            Section
          </label>
          <select id="seo-sec" className="seo-select" value={section} onChange={(e) => setSection(e.target.value)}>
            <option value="all">Toutes les sections</option>
            {sections
              .filter((s) => s.applicable)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} ({s.count})
                </option>
              ))}
          </select>
          <label className="inline-flex items-center gap-2 text-[13.5px]">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            Corrigeables par Repéré
          </label>
          <label className="sr-only" htmlFor="seo-q">
            Chercher un constat ou une page
          </label>
          <input id="seo-q" className="seo-select" type="search" placeholder="Chercher une page…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="button" className="ui-btn" data-size="sm" onClick={exportCsv} disabled={!shown.length}>
            <Icon name="download" size={14} /> Exporter en CSV
          </button>
        </div>
        <div role="tabpanel" id="sev-panel" className="ui-tabpanel" key={`${sev}${section}${auto}`}>
          {shown.length === 0 ? (
            <EmptyState title="Aucun constat avec ces filtres" compact>
              Élargissez les filtres pour revoir tous les points.
            </EmptyState>
          ) : (
            shown.map((f) => (
              <details key={f.id} id={`constat-${f.id}`} className="seo-finding">
                <summary>
                  <span className="seo-finding-sev">
                    <StatusBadge tone={SEVERITY_TONE[f.severity]}>{SEVERITY_LABEL[f.severity]}</StatusBadge>
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold leading-snug">{f.title}</span>
                    <span className="ui-caption">
                      {f.sectionLabel}
                      {f.affectedCount > 0 ? ` · ${fmtInt(f.affectedCount)} page${f.affectedCount > 1 ? 's' : ''}` : ''}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {canAutoFix(f) && (
                      <span className="seo-pill" data-tone="up">
                        <Icon name="spark" size={12} /> Auto
                      </span>
                    )}
                    <Icon name="chevron" size={16} className="seo-finding-chev" />
                  </span>
                </summary>
                <div className="seo-finding-body">
                  <div>
                    <h4>Pourquoi c’est important</h4>
                    <p>{f.why}</p>
                  </div>
                  <div>
                    <h4>Quoi faire</h4>
                    <p>{f.fix}</p>
                  </div>
                  {f.evidence && (
                    <div>
                      <h4>Mesuré</h4>
                      <p>{f.evidence}</p>
                    </div>
                  )}
                  {f.affected.length > 0 && (
                    <div>
                      <h4>
                        Pages concernées ({fmtInt(f.affectedCount)}
                        {f.affectedCount > f.affected.length ? `, ${f.affected.length} affichées` : ''})
                      </h4>
                      <ul className="seo-urls">
                        {f.affected.map((a, i) => (
                          <li key={i}>
                            <code>{pathOf(a.url) || a.url}</code>
                            {a.detail && <span>{a.detail}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    {canAutoFix(f) ? (
                      <Link className="ui-btn" data-variant="primary" data-size="sm" href={`/app/agent?source=seo&constat=${encodeURIComponent(f.id)}`}>
                        <Icon name="spark" size={14} /> Laisser Repéré le faire
                      </Link>
                    ) : (
                      <span className="ui-caption">Correction à faire sur votre site (ou par votre prestataire).</span>
                    )}
                    <span className="ui-caption">Réf. {f.id}</span>
                  </div>
                </div>
              </details>
            ))
          )}
        </div>
      </div>
      <aside className="ui-card" data-elevation="flat" style={{ padding: 'var(--sp-5)', alignSelf: 'start' }} aria-labelledby="seo-sections-h">
        <h2 id="seo-sections-h" className="ui-h2 mb-3">
          Score par section
        </h2>
        <ul className="seo-bars">
          {sections
            .filter((s) => s.applicable)
            .map((s) => (
              <li key={s.id} className="seo-bar">
                <button type="button" className="seo-bar-l" onClick={() => setSection(section === s.id ? 'all' : s.id)} aria-pressed={section === s.id}>
                  <span className={section === s.id ? 'font-semibold underline' : ''}>{s.label}</span>
                  {s.count > 0 && <span className="ui-caption"> · {s.count}</span>}
                </button>
                <span className="seo-bar-v">{s.score}</span>
                <ProgressBar value={s.score} max={100} size="sm" tone={s.score >= 75 ? 'up' : s.score >= 50 ? 'warn' : 'down'} label={`${s.label} : ${s.score} sur 100`} />
              </li>
            ))}
        </ul>
        <p className="ui-caption mt-3">Cliquez une section pour filtrer. Les sections sans objet pour votre type de site ne comptent pas.</p>
      </aside>
    </div>
  );
}
