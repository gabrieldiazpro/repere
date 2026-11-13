'use client';

import { useState } from 'react';
import type { SiteAuditRun } from '@/lib/siteaudit/runs';
import type { BotVerdict, ReadinessReport } from '@/lib/siteaudit/types';
import { CopyButton } from '../CopyButton';
import { Icon } from '../icons';
import { fmtDate, fmtInt } from '../tokens';
import { CheckList, CreateTaskButton, ScoreBlock } from './Checks';

const BOT_UI: Record<BotVerdict['status'], { label: string; cls: string }> = {
  allowed: { label: 'Autorisé', cls: 'rp-chip-success' },
  blocked: { label: 'Bloqué', cls: 'rp-chip-danger' },
  not_mentioned: { label: 'Non mentionné (autorisé)', cls: '' },
};

const RENDER_UI: Record<ReadinessReport['render']['verdict'], string> = {
  lisible: 'Lisible sans JavaScript',
  partiel: 'Partiellement lisible sans JavaScript',
  quasi_vide: 'Presque vide sans JavaScript',
};

export interface ServedMarkup {
  published: boolean;
  types: string[];
  scriptUrl: string;
  /** bloc <script type="application/ld+json"> statique, prêt à coller dans le <head> */
  block: string;
  jsonUrl: string;
}

function Robots({ report, seen, businessId, demo }: { report: ReadinessReport; seen: Record<string, number>; businessId: string; demo: boolean }) {
  const r = report.robots;
  if (!r) return <p className="text-[13px] text-[var(--muted)]">Le fichier robots.txt n’a pas pu être lu.</p>;
  const blocked = r.bots.filter((b) => b.status === 'blocked' && b.role !== 'training');
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-[var(--muted)]">
        {r.found ? (
          <>
            Fichier lu :{' '}
            <a className="rp-link break-all" href={r.robotsUrl} target="_blank" rel="noopener noreferrer">
              {r.robotsUrl}
            </a>
          </>
        ) : r.unreachable ? (
          'robots.txt injoignable : les robots respectueux considèrent alors tout le site comme interdit.'
        ) : (
          'Pas de robots.txt : tous les robots sont autorisés par défaut.'
        )}
      </p>
      <div className="rp-scroll">
        <table className="rp-table">
          <thead>
            <tr>
              <th scope="col">Robot</th>
              <th scope="col">Rôle</th>
              <th scope="col">État</th>
              <th scope="col" className="num">
                Vu (90 j)
              </th>
            </tr>
          </thead>
          <tbody>
            {r.bots.map((b) => (
              <tr key={b.token}>
                <td>
                  <span className="font-medium">{b.token}</span>
                  <span className="block text-[12px] text-[var(--muted)]">{b.product}</span>
                </td>
                <td className="text-[13px]">{b.roleLabel}</td>
                <td>
                  <span className={`rp-chip ${BOT_UI[b.status].cls}`}>{BOT_UI[b.status].label}</span>
                  {b.line !== null && <span className="block text-[12px] text-[var(--muted)]">ligne {b.line} : {b.rule}</span>}
                  {b.severity !== 'ok' && b.severity !== 'info' && <span className="block text-[12px]">{b.recommendation}</span>}
                </td>
                <td className="num text-[13px]">{seen[b.token] ? fmtInt(seen[b.token]) : <span className="text-[var(--muted)]">jamais</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-[var(--muted)]">« Vu » : passages relevés par votre script de suivi ou le plugin WordPress. Bloquer un robot d’entraînement n’empêche pas d’être cité ; bloquer un robot de recherche, si.</p>
      {blocked.length > 0 && (
        <div className="rounded-lg bg-[var(--danger-bg)] p-3 text-[13px] text-[var(--danger-ink)]">
          <p className="font-semibold">
            {blocked.map((b) => b.token).join(', ')} : bloqué{blocked.length > 1 ? 's' : ''}, vous ne pouvez pas être cité par {[...new Set(blocked.map((b) => b.product))].join(', ')}.
          </p>
          <div className="mt-2">
            <CreateTaskButton businessId={businessId} demo={demo} task={{ title: 'Autoriser les robots de recherche des IA dans robots.txt', why: `Bloqués aujourd’hui : ${blocked.map((b) => b.token).join(', ')}.`, steps: ['Remplacer les règles concernées par le robots.txt proposé ci-dessous', 'Relancer l’analyse « Prêt pour les IA »'], minutes: 20, impact: 3 }} />
          </div>
        </div>
      )}
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-[13px] font-semibold">robots.txt proposé : être cité, sans servir à l’entraînement</p>
          <CopyButton text={r.recommended.citeNoTraining} />
        </div>
        <pre className="rp-code">{r.recommended.citeNoTraining}</pre>
      </div>
    </div>
  );
}

export function TechAudit({
  businessId,
  demo,
  website,
  initial,
  history,
  served,
  botsSeen,
  wpPlugin,
  sample = null,
}: {
  businessId: string;
  demo: boolean;
  website: string;
  initial: ReadinessReport | null;
  history: { at: string; score: number }[];
  served: ServedMarkup;
  botsSeen: Record<string, number>;
  wpPlugin: boolean;
  /** démo : rapport d'une page d'exemple, calculé côté serveur sans appel réseau */
  sample?: ReadinessReport | null;
}) {
  const [url, setUrl] = useState(initial?.url ?? website);
  const [report, setReport] = useState(initial);
  const [isSample, setIsSample] = useState(false);
  const [hist, setHist] = useState(history);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/siteaudit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ businessId, url: url.trim(), kind: 'readiness' }) });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; data?: SiteAuditRun; error?: string } | null;
      if (!res.ok || !j?.ok || !j.data) throw new Error(j?.error ?? 'L’analyse a échoué.');
      if (!j.data.readiness) throw new Error(j.data.error ?? 'Le site n’a pas pu être lu.');
      setReport(j.data.readiness);
      setIsSample(false);
      if (!j.data.demo) setHist((h) => [{ at: j.data!.createdAt, score: j.data!.readiness!.score }, ...h]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'L’analyse a échoué.');
    } finally {
      setBusy(false);
    }
  }

  const wpDetected = report?.render.frameworks.some((f) => /wordpress/i.test(f)) ?? false;
  const botsReported = Object.keys(botsSeen).length > 0;

  return (
    <div className="flex flex-col gap-4" data-visite="technique">
      <form
        className="rp-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-end lg:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim()) void run();
        }}
      >
        <div className="min-w-0 flex-1">
          <label htmlFor="ta-url" className="text-[14px] font-semibold">
            Site analysé
          </label>
          <input id="ta-url" type="url" required className="rp-input mt-2 w-full" placeholder="https://www.exemple.fr" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <button type="submit" className="rp-btn rp-btn-primary" disabled={busy || !url.trim()}>
          <Icon name="bolt" size={16} /> {busy ? 'Analyse en cours…' : report ? 'Relancer l’analyse' : 'Lancer l’analyse'}
        </button>
      </form>
      {err && (
        <p role="alert" className="text-[13px] text-[var(--danger-ink)]">
          {err} Vérifiez que l’adresse est publique puis relancez.
        </p>
      )}
      {demo && sample && (
        <p className="-mt-2 text-[13px] text-[var(--muted)]">
          Démo : l’analyse d’une vraie adresse fonctionne, mais n’est pas enregistrée.{' '}
          <button
            type="button"
            className="rp-link"
            disabled={busy}
            onClick={() => {
              setErr(null);
              setReport(sample);
              setIsSample(true);
            }}
          >
            Voir l’analyse d’un site d’exemple
          </button>
        </p>
      )}
      {busy && <p role="status" className="text-[13px] text-[var(--muted)]">Lecture de la page d’accueil, de robots.txt et du sitemap, 10 à 20 secondes…</p>}

      {!report ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] p-5 text-[14px] text-[var(--muted)]">
          {demo ? 'Démo : saisissez l’adresse de n’importe quel site public, ou ouvrez le site d’exemple ci-dessus. ' : 'Aucune analyse encore. '}
          Repéré vérifie si les robots des IA peuvent lire votre site : robots.txt robot par robot, texte lisible sans JavaScript, données structurées, sitemap.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
          <div className="flex flex-col gap-4">
            <section className="rp-panel p-4 lg:p-5" aria-label="Score prêt pour les IA">
              <ScoreBlock score={report.score} label="Prêt pour les IA" sub={isSample ? <>Site d’exemple (démo) : page et robots.txt fictifs, pour montrer les contrôles</> : <>Analysé le {fmtDate(report.fetchedAt, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} · réponse en {fmtInt(report.elapsedMs)} ms</>} />
              {report.cap && (
                <p className="mt-3 rounded-lg bg-[var(--warning-bg)] px-3 py-2 text-[13px] text-[var(--warning-ink)]">
                  <span className="font-semibold">Score plafonné : </span>
                  {report.cap} Tant que ce point bloque, les autres corrections ne peuvent pas faire monter le score au-delà du plafond.
                </p>
              )}
            </section>
            <section className="rp-panel" aria-labelledby="ctrl-h">
              <div className="rp-panel-head">
                <h2 id="ctrl-h" className="rp-h2">
                  Contrôles et correctifs
                </h2>
              </div>
              <div className="rp-panel-body pt-0">
                <CheckList checks={report.checks} businessId={businessId} demo={demo} taskPrefix="Site" />
              </div>
            </section>
            <section className="rp-panel" aria-labelledby="robots-h">
              <div className="rp-panel-head">
                <h2 id="robots-h" className="rp-h2">
                  Robots des IA
                </h2>
              </div>
              <div className="rp-panel-body pt-0">
                <Robots report={report} seen={botsSeen} businessId={businessId} demo={demo} />
              </div>
            </section>
          </div>
          <div className="flex flex-col gap-4">
            <section className="rp-panel" aria-labelledby="rendu-h">
              <div className="rp-panel-head">
                <h2 id="rendu-h" className="rp-h2">
                  Ce que lit un robot
                </h2>
              </div>
              <div className="rp-panel-body flex flex-col gap-2 pt-0 text-[13px]">
                <p className="font-semibold">{RENDER_UI[report.render.verdict]}</p>
                <p className="text-[var(--muted)]">
                  {fmtInt(report.render.words)} mots dans le HTML brut{report.render.frameworks.length ? ` · ${report.render.frameworks.join(', ')}` : ''}
                </p>
                {report.render.preview && <p className="rounded-lg bg-[var(--bg)] p-2 text-[12px]">{report.render.preview}</p>}
                <ul className="mt-1 flex flex-col gap-1">
                  <li>Sitemap : {report.sitemap.found ? 'trouvé' : 'absent'}</li>
                  <li>Données structurées : {report.jsonLdTypes.length ? report.jsonLdTypes.join(', ') : 'aucune'}</li>
                  <li>llms.txt : {report.llmsTxt.found ? 'présent' : 'absent'}</li>
                </ul>
                <p className="text-[12px] text-[var(--muted)]">{report.llmsTxt.note}</p>
              </div>
            </section>
            <section className="rp-panel" aria-labelledby="servi-h">
              <div className="rp-panel-head">
                <h2 id="servi-h" className="rp-h2">
                  Balisage servi par Repéré
                </h2>
              </div>
              <div className="rp-panel-body flex flex-col gap-3 pt-0 text-[13px]">
                {served.published ? (
                  <>
                    <p>
                      <span className="rp-chip rp-chip-success">Actif</span> {served.types.length ? served.types.join(', ') : 'balisage'} à jour avec votre fiche de vérité.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <CopyButton text={served.block} label="Copier le bloc à coller" />
                      <a href={served.jsonUrl} target="_blank" rel="noopener noreferrer" className="rp-btn rp-btn-sm">
                        <Icon name="external" size={14} /> Voir le JSON-LD
                      </a>
                    </div>
                    <p className="text-[12px] text-[var(--muted)]">
                      Sur votre site : {report.jsonLdTypes.length ? `balisage détecté (${report.jsonLdTypes.join(', ')})` : 'aucun balisage détecté pour l’instant'}. Les robots des IA ne lisent pas le balisage injecté par JavaScript : préférez le plugin WordPress ou le bloc statique.
                    </p>
                  </>
                ) : (
                  <p className="text-[var(--muted)]">Pas de balisage publié : complétez votre fiche de vérité, Repéré le génère.</p>
                )}
                <div className="border-t border-[var(--hair)] pt-3">
                  <p className="font-semibold">Plugin WordPress</p>
                  <p className="mt-1 text-[var(--muted)]">
                    {wpDetected ? 'Site WordPress détecté. ' : 'WordPress non détecté sur la page analysée. '}
                    {botsReported ? 'Des passages de robots IA nous parviennent bien.' : 'Aucun passage de robot ne nous parvient encore.'}
                  </p>
                  {wpPlugin && (
                    <a href="/integrations/repere-ia-wordpress.zip" className="rp-btn rp-btn-sm mt-2" download>
                      <Icon name="download" size={14} /> Télécharger le plugin
                    </a>
                  )}
                </div>
              </div>
            </section>
            {hist.length > 0 && (
              <section className="rp-panel" aria-labelledby="hist-t-h">
                <div className="rp-panel-head">
                  <h2 id="hist-t-h" className="rp-h2">
                    Historique
                  </h2>
                </div>
                <ul className="rp-panel-body flex flex-col gap-1 pt-0 text-[13px]">
                  {hist.slice(0, 8).map((h) => (
                    <li key={h.at} className="flex justify-between gap-2">
                      <span>{fmtDate(h.at, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <span className="rp-num font-semibold">{Math.round(h.score)}/100</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {report.limits.length > 0 && (
              <details className="text-[12px] text-[var(--muted)]">
                <summary className="cursor-pointer">Limites de l’analyse</summary>
                <ul className="mt-1 list-disc pl-4">
                  {report.limits.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
