'use client';

import { useState } from 'react';
import type { ModuleId } from '@/lib/analysis/types';
import s from './analysis.module.css';
import { ScoreDial } from './ScoreDial';
import { SiteMap } from './SiteMap';
import { SEVERITY_LABEL, SEVERITY_TONE, SOURCE_LABEL, clock, hostOf, pathOf, providerLabel, seconds } from './format';
import type { LiveState } from './stream';

const STEP_ORDER: { id: ModuleId; label: string }[] = [
  { id: 'detect', label: 'Lecture de la page d’accueil' },
  { id: 'crawl', label: 'Exploration du site' },
  { id: 'seo', label: 'Audit Google (SEO)' },
  { id: 'geo', label: 'Audit IA (GEO)' },
  { id: 'ai', label: 'Questions posées aux IA' },
  { id: 'data', label: 'Vitesse mobile (PageSpeed)' },
];

const PHASE: Record<string, string> = {
  robots: 'Lecture du robots.txt',
  sitemaps: 'Lecture du plan du site',
  pages: 'Lecture des pages',
  done: 'Exploration terminée',
};

/**
 * Écran « analyse en cours » : tout ce qui bouge vient du flux réel (pages lues, constats, scores, réponses des IA).
 * Le chronomètre affiche le temps réel écoulé depuis le lancement.
 */
export function LiveAnalysis({
  live,
  elapsedMs,
  onCorrect,
  onCancel,
}: {
  live: LiveState;
  elapsedMs: number;
  onCorrect: (v: { brand: string; city: string }) => void;
  onCancel: () => void;
}) {
  const host = hostOf(live.url);
  const d = live.detection;
  const [editing, setEditing] = useState(false);
  const findings = [...live.findings].reverse();
  const aiPct = live.ai.total ? live.ai.done / live.ai.total : 0;
  return (
    <section aria-labelledby="live-title">
      <div className={s.liveHead}>
        <div className="min-w-0">
          <p className={s.small} id="live-status" role="status" aria-live="polite">
            {live.crawl.fetched > 0 ? `${live.crawl.fetched} pages lues` : 'Connexion au site'}
            {live.findings.length ? `, ${live.findings.length} constats` : ''}
          </p>
          <h1 id="live-title" className={s.liveTitle}>
            Analyse de {host || 'votre site'}
          </h1>
          <div className={s.chips}>
            {d ? (
              <>
                <span className={s.chip}>
                  Marque <b>{d.brand}</b>
                </span>
                {d.city ? (
                  <span className={s.chip}>
                    Ville <b>{d.city}</b>
                  </span>
                ) : null}
                {d.activity ? (
                  <span className={s.chip}>
                    Activité <b>{d.activity}</b>
                  </span>
                ) : null}
                <button type="button" className={s.linkBtn} onClick={() => setEditing((x) => !x)} aria-expanded={editing}>
                  {editing ? 'Fermer' : 'Corriger'}
                </button>
              </>
            ) : (
              <span className={s.chip}>Détection de la marque et de la ville…</span>
            )}
          </div>
          {editing && d ? <CorrectForm brand={d.brand} city={d.city ?? ''} onSubmit={onCorrect} /> : null}
        </div>
        <div className={s.clock} aria-hidden="true">
          <div className={s.clockNum}>{clock(elapsedMs)}</div>
          <div className={s.clockLabel}>temps réel</div>
        </div>
      </div>

      <div className={s.liveGrid}>
        <div className={s.scan}>
          <div className={s.scanTop}>
            <div>
              <div className={s.scanCount}>{live.crawl.fetched}</div>
              <div className={s.scanCountLabel}>
                pages lues{live.crawl.queued ? `, ${live.crawl.queued} en file` : ''}
              </div>
            </div>
            <div className={s.scanPhase}>{live.steps.crawl?.status === 'ok' ? `Exploration terminée en ${seconds(live.steps.crawl.ms ?? 0)}` : PHASE[live.crawl.phase] ?? 'Exploration'}</div>
          </div>
          <SiteMap urls={live.crawl.urls} current={live.steps.crawl?.status === 'running' ? live.crawl.current : undefined} fetched={live.crawl.fetched} />
          <div className={s.ticker} aria-hidden="true">
            <span>Page en cours </span>
            {live.crawl.current ? (
              <span key={live.crawl.current} className={s.tickerUrl} style={{ color: '#fff' }}>
                {pathOf(live.crawl.current)}
              </span>
            ) : (
              '…'
            )}
          </div>
        </div>

        <div className={s.side}>
          <div className={s.panel}>
            <div className={s.dials}>
              <ScoreDial value={live.scores.seo} name="Google" sub="SEO" size={120} waiting={live.steps.seo?.status === 'skipped' ? 'non mesuré' : 'en cours'} />
              <ScoreDial value={live.scores.geo} name="IA" sub="GEO" size={120} waiting={live.steps.geo?.status === 'skipped' ? 'non mesuré' : 'en cours'} />
            </div>
          </div>
          <div className={s.panel}>
            <h2 className={s.panelTitle}>
              Premiers constats
              <span className={s.count} aria-label={`${live.findings.length} constats`}>
                {live.findings.length}
              </span>
            </h2>
            {findings.length ? (
              <ul className={s.feed} aria-live="polite" aria-relevant="additions">
                {findings.map((f) => (
                  <li key={f.id} className={s.feedItem}>
                    <span className={s.sev} data-tone={SEVERITY_TONE[f.severity]} aria-hidden="true" />
                    <span>
                      {f.title}
                      <small>
                        {SEVERITY_LABEL[f.severity]}, côté {SOURCE_LABEL[f.source]}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={s.feedEmpty}>Les constats apparaissent ici dès que nous les trouvons.</p>
            )}
          </div>
        </div>
      </div>

      <div className={s.bottomGrid}>
        <div className={s.panel}>
          <h2 className={s.panelTitle}>Étapes</h2>
          <ol className={s.steps}>
            {STEP_ORDER.map((st) => {
              const cur = live.steps[st.id];
              const status = cur?.status ?? 'pending';
              return (
                <li key={st.id} className={s.step} data-status={status}>
                  <StepIcon status={status} />
                  <span>{st.label}</span>
                  <span className={s.stepMs}>{cur?.ms != null && status !== 'running' ? seconds(cur.ms) : status === 'running' ? 'en cours' : ''}</span>
                  {cur?.error && status !== 'ok' ? <span className={s.stepNote}>{stepNote(cur.error)}</span> : null}
                </li>
              );
            })}
          </ol>
        </div>
        <div className={s.panel}>
          <h2 className={s.panelTitle}>Questions posées aux IA</h2>
          {live.ai.total ? (
            <>
              <p className={s.aiLine}>
                <b>{live.ai.done}</b> réponses reçues sur <b>{live.ai.total}</b>
                {live.ai.last && live.ai.done < live.ai.total ? `, ${providerLabel(live.ai.last)} répond…` : ''}
              </p>
              <div className={s.aiBar} role="progressbar" aria-label="Réponses des IA reçues" aria-valuemin={0} aria-valuemax={live.ai.total} aria-valuenow={live.ai.done}>
                <div className={s.aiFill} style={{ transform: `scaleX(${aiPct})` }} />
              </div>
              <div className={s.chips}>
                {live.ai.providers.map((p) => (
                  <span key={p} className={s.chip}>
                    {providerLabel(p)}
                  </span>
                ))}
              </div>
              {live.findings.some((f) => f.id === 'ai.quick.mentions' && f.severity === 'info') ? (
                <p className={`${s.small} mt-2`}>Démonstration : aucune IA n’est branchée sur ce serveur, les réponses sont simulées.</p>
              ) : null}
            </>
          ) : (
            <p className={s.aiLine}>{live.steps.ai?.status === 'skipped' ? 'Contrôle non lancé pour cette activité.' : 'Préparation des questions de vos clients…'}</p>
          )}
          <p className={`${s.small} mt-3`}>Les réponses complètes s’affichent dans le rapport.</p>
        </div>
      </div>
      <p className="mt-6">
        <button type="button" className={s.linkBtn} onClick={onCancel}>
          Annuler l’analyse
        </button>
      </p>
    </section>
  );
}

function stepNote(err: string): string {
  if (/non configur/i.test(err)) return 'Fournisseur non configuré : rien n’est estimé.';
  if (/injoignable/i.test(err)) return 'La page d’accueil n’a pas répondu à notre robot.';
  if (/exploration indisponible/i.test(err)) return 'Impossible sans exploration du site.';
  if (/délai/i.test(err)) return 'Temps dépassé : résultat partiel.';
  return err;
}

function StepIcon({ status }: { status: string }) {
  if (status === 'running')
    return (
      <svg className={`${s.stepIcon} ${s.spin}`} viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" aria-label="en cours" role="img">
        <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
      </svg>
    );
  if (status === 'ok')
    return (
      <svg className={s.stepIcon} viewBox="0 0 24 24" fill="none" stroke="var(--tone-up-solid)" strokeWidth="2.6" aria-label="terminé" role="img">
        <path className={s.tick} d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" pathLength={24} />
      </svg>
    );
  if (status === 'failed' || status === 'timeout')
    return (
      <svg className={s.stepIcon} viewBox="0 0 24 24" fill="none" stroke="var(--tone-down-solid)" strokeWidth="2.4" aria-label="échec" role="img">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v6M12 16.5v.5" strokeLinecap="round" />
      </svg>
    );
  if (status === 'skipped')
    return (
      <svg className={s.stepIcon} viewBox="0 0 24 24" fill="none" stroke="var(--tone-neutral-solid)" strokeWidth="2.4" aria-label="non lancé" role="img">
        <path d="M6 12h12" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg className={s.stepIcon} viewBox="0 0 24 24" fill="none" stroke="var(--line)" strokeWidth="2" aria-label="à venir" role="img">
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

function CorrectForm({ brand, city, onSubmit }: { brand: string; city: string; onSubmit: (v: { brand: string; city: string }) => void }) {
  const [b, setB] = useState(brand);
  const [c, setC] = useState(city);
  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ brand: b.trim(), city: c.trim() });
      }}
    >
      <label className="min-w-0 flex-[1_1_12rem]">
        <span className={s.small}>Nom de la marque</span>
        <input className={`${s.input} ${s.inputSm}`} value={b} onChange={(e) => setB(e.target.value)} maxLength={80} autoComplete="organization" />
      </label>
      <label className="min-w-0 flex-[1_1_10rem]">
        <span className={s.small}>Ville (facultatif)</span>
        <input className={`${s.input} ${s.inputSm}`} value={c} onChange={(e) => setC(e.target.value)} maxLength={60} autoComplete="address-level2" />
      </label>
      <button type="submit" className="ui-btn" data-variant="primary">
        Relancer avec ces informations
      </button>
    </form>
  );
}

export default LiveAnalysis;
