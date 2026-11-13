'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Finding, ScoredSection } from '@/lib/crawl/types';
import type { AiCheckSummary, FullAnalysis, ModuleReport } from '@/lib/analysis/types';
import { Disclosure } from '@/components/ui/Disclosure';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Delta } from '@/components/ui/Delta';
import { Typewriter } from '@/components/motion/Typewriter';
import { useInView } from '@/components/motion/useInView';
import s from './analysis.module.css';
import { ScoreDial } from './ScoreDial';
import {
  SEVERITY_LABEL,
  SEVERITY_TONE,
  diagnose,
  hasAutoFix,
  hostOf,
  partialNotes,
  pathOf,
  priorityKey,
  providerLabel,
  scoreTone,
  scoreWord,
  seconds,
  signupHref,
  sortedSections,
} from './format';

const dateFr = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });

/**
 * Rapport de l'analyse 60 s. Rendu à l'identique juste après l'analyse (/analyse) et sur le lien partagé
 * (/analyse/[id]?t=…). `shareUrl` absent : pas de bouton « Copier le lien ».
 */
export function AnalysisReport({
  analysis: a,
  shareUrl,
  onRerun,
  headingLevel = 'h1',
}: {
  analysis: FullAnalysis;
  shareUrl?: string | null;
  onRerun?: () => void;
  headingLevel?: 'h1' | 'h2';
}) {
  const problem = diagnose(a);
  const notes = partialNotes(a);
  const host = hostOf(a.crawl?.finalOrigin ?? a.input.url);
  const H = headingLevel;
  const fixable = a.autoFixes.length;
  const signup = signupHref(a);
  const down = problem?.kind === 'unreachable';
  const rerunHref = `/analyse?site=${encodeURIComponent(a.crawl?.finalOrigin ?? a.input.url)}`;

  // Impression / PDF : toutes les sections dépliées.
  useEffect(() => {
    const open = () => document.querySelectorAll<HTMLDetailsElement>('[data-report] details').forEach((d) => (d.open = true));
    window.addEventListener('beforeprint', open);
    return () => window.removeEventListener('beforeprint', open);
  }, []);

  return (
    <article data-report="" aria-labelledby="verdict">
      <header className={s.repHead}>
        <p className={s.meta}>
          <span>
            Analyse de <b className="text-ink">{host}</b>
          </span>
          <span>{dateFr(a.createdAt)}</span>
          <span>terminée en {seconds(a.durationMs)}</span>
          {a.crawl ? <span>{a.crawl.pagesFetched} page{a.crawl.pagesFetched > 1 ? 's' : ''} lue{a.crawl.pagesFetched > 1 ? 's' : ''}</span> : null}
        </p>
        <H id="verdict" className={s.verdict} data-long={a.verdict.length > 150 ? '' : undefined}>
          {a.verdict}
        </H>
        <div className={s.badges}>
          {a.demo ? <StatusBadge tone="warn">Démonstration : réponses des IA simulées</StatusBadge> : null}
          {a.partial ? <StatusBadge tone="warn">Résultat partiel</StatusBadge> : null}
          {fixable ? <StatusBadge tone="brand">{fixable} corrections que Repéré peut faire pour vous</StatusBadge> : null}
        </div>
      </header>

      {problem ? <ProblemBox problem={problem} onRerun={onRerun} rerunHref={rerunHref} /> : null}

      <div className={s.scores}>
        <div className={s.score}>
          <ScoreDial value={a.scores.seo} name="Google" waiting="non mesuré" size={116} />
          <span className={s.scoreWord}>SEO, {scoreWord(a.scores.seo)}</span>
        </div>
        <div className={s.score}>
          <ScoreDial value={a.scores.geo} name="IA" waiting="non mesuré" size={116} />
          <span className={s.scoreWord}>GEO, {scoreWord(a.scores.geo)}</span>
        </div>
        <div className={s.score} data-main="">
          <ScoreDial value={a.scores.global} name="Global" waiting="non mesuré" size={116} />
          <span className={s.scoreWord}>sur 100</span>
        </div>
      </div>

      {notes.length && !down ? (
        <div className={`${s.alert} mt-4`} data-tone="warn" role="note">
          <strong>Ce qui manque à ce résultat.</strong>
          <ul className="mt-1 list-disc pl-5">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {down ? null : (
      <div className={`${s.ctaBar} ${s.noPrint}`}>
        <Link href={signup} className="ui-btn" data-variant="primary" data-size="lg">
          Corriger avec Repéré
        </Link>
        <ShareActions shareUrl={shareUrl} host={host} />
        <p className={s.ctaNote}>Espace gratuit : cette analyse y est rattachée, rien n’est publié sur votre site sans votre accord.</p>
      </div>
      )}

      {a.priorities.length ? (
        <section className={s.section} aria-labelledby="prio-h">
          <h2 id="prio-h" className={s.h2}>
            Vos {a.priorities.length} priorités
          </h2>
          <p className={s.h2sub}>Classées par effet attendu et effort, Google et IA mélangés : commencez par la première.</p>
          <ol className={s.prios}>
            {a.priorities.map((p, i) => (
              <li key={priorityKey(p, i)} className={s.prio} data-first={i === 0 ? '' : undefined}>
                <div className={s.prioTop}>
                  <span className={s.src} data-src={p.source}>
                    {p.source === 'seo' ? 'Google' : 'IA'}
                  </span>
                  <StatusBadge tone={SEVERITY_TONE[p.severity]}>{SEVERITY_LABEL[p.severity]}</StatusBadge>
                  {hasAutoFix(a, p) ? <span className={s.autofix}>Repéré peut le faire pour vous</span> : null}
                </div>
                <h3 className={s.prioTitle}>{p.title}</h3>
                <div className={s.whyFix}>
                  <div>
                    <h4>Pourquoi c’est important</h4>
                    <p>{p.why}</p>
                  </div>
                  <div>
                    <h4>Quoi faire</h4>
                    <p>{p.fix}</p>
                  </div>
                </div>
                <AffectedPages f={p} max={3} />
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {a.comparison ? <Comparison a={a} /> : null}

      {a.seo || a.geo ? (
        <section className={s.section} aria-labelledby="detail-h">
          <h2 id="detail-h" className={s.h2}>
            Le détail, contrôle par contrôle
          </h2>
          <p className={s.h2sub}>Chaque thème avec son score et les pages concernées. Les thèmes sans problème sont en bas.</p>
          <div className={s.cols}>
            <ModuleDetail title="Google (SEO)" report={a.seo} a={a} />
            <ModuleDetail title="IA (GEO)" report={a.geo} a={a} />
          </div>
        </section>
      ) : null}

      {a.ai ? <AiSection ai={a.ai} brand={a.detected.brand} /> : null}

      <Performance a={a} />

      {down ? null : (
      <section className={`${s.final} ${s.noPrint}`} aria-labelledby="final-h">
        <div>
          <h2 id="final-h">Repéré corrige avec vous, puis mesure l’effet</h2>
          <p>
            {fixable
              ? `${fixable} corrections sont prêtes à appliquer (titres, descriptions, données structurées…). Vous validez chaque changement, tout est réversible.`
              : 'Plan d’action, corrections guidées et suivi mensuel de votre visibilité sur Google et dans les IA.'}
          </p>
        </div>
        <Link href={signup} className={s.finalBtn}>
          Corriger avec Repéré
        </Link>
      </section>
      )}

      <Method a={a} />
    </article>
  );
}

/* ------------------------------------------------------------------ */

function ShareActions({ shareUrl, host }: { shareUrl?: string | null; host: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!shareUrl) return;
    const full = new URL(shareUrl, window.location.origin).toString();
    try {
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: `Analyse SEO et IA de ${host}`, url: full });
        return;
      }
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* partage annulé */
    }
  };
  return (
    <>
      {shareUrl ? (
        <button type="button" className="ui-btn" onClick={copy} aria-live="polite">
          {copied ? 'Lien copié' : 'Partager le rapport'}
        </button>
      ) : null}
      <button type="button" className="ui-btn" data-variant="ghost" onClick={() => window.print()}>
        Imprimer ou PDF
      </button>
    </>
  );
}

function ProblemBox({ problem, onRerun, rerunHref }: { problem: NonNullable<ReturnType<typeof diagnose>>; onRerun?: () => void; rerunHref: string }) {
  const rerun = (label: string) =>
    onRerun ? (
      <button type="button" className="ui-btn" onClick={onRerun}>
        {label}
      </button>
    ) : (
      <Link href={rerunHref} className="ui-btn">
        {label}
      </Link>
    );
  if (problem.kind === 'unreachable')
    return (
      <div className={`${s.alert} mt-6`} data-tone="down" role="alert">
        <strong>{problem.host} n’a pas répondu à notre robot.</strong> Vérifiez que l’adresse s’ouvre dans un navigateur (sans mot de passe ni page
        d’attente), puis relancez. Si le site est en maintenance, réessayez plus tard.
        <div className="mt-3">{rerun('Relancer l’analyse')}</div>
      </div>
    );
  return (
    <div className={`${s.alert} ${s.robotsBox}`} data-tone="warn" role="alert">
      <strong>Le fichier robots.txt de {problem.host} refuse l’accès à notre robot, RepereBot.</strong> Nous respectons ce choix : nous n’avons lu
      aucune page. Pour autoriser l’analyse :
      <ol>
        <li>Ouvrez le fichier robots.txt à la racine du site (dans WordPress : extension SEO, réglage « robots.txt » ; Shopify : modèle robots.txt.liquid).</li>
        <li>Ajoutez ces deux lignes en haut du fichier, puis enregistrez :</li>
      </ol>
      <pre>{`User-agent: RepereBot\nAllow: /`}</pre>
      <p className="mt-2">
        Notre robot lit au plus 60 pages, 4 à la fois, et respecte le délai demandé par votre robots.txt. Si le fichier bloque aussi Google et les
        robots des IA, c’est votre premier chantier : voir les priorités ci-dessous.
      </p>
      <div className="mt-3">{rerun('J’ai autorisé RepereBot, relancer')}</div>
    </div>
  );
}

function AffectedPages({ f, max }: { f: Finding; max: number }) {
  const urls = [...new Set(f.affected.map((x) => x.url).filter(Boolean))];
  if (!urls.length) return f.evidence ? <p className={s.evidence}>{f.evidence}</p> : null;
  const shown = urls.slice(0, max);
  // `affectedCount` compte des éléments (pages, images, questions…) : on ne parle de pages que si chaque élément en est une.
  const allListed = f.affected.length >= f.affectedCount;
  const rest = allListed ? urls.length - shown.length : 0;
  const onePerPage = allListed && urls.length === f.affected.length;
  const details = urls.length === 1 ? f.affected.map((x) => x.detail).filter(Boolean).slice(0, 3) : [];
  return (
    <>
      <p className={s.pages}>
        <span>{onePerPage && urls.length > 1 ? `${urls.length} pages :` : urls.length > 1 ? 'Pages concernées :' : 'Page :'}</span>
        {shown.map((u) => (
          <code key={u} title={u}>
            {pathOf(u)}
          </code>
        ))}
        {rest > 0 ? <span>et {rest} autres</span> : !allListed ? <span>et d’autres</span> : null}
      </p>
      {details.length ? (
        <ul className={s.evidence}>
          {details.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

function ModuleDetail({ title, report, a }: { title: string; report: ModuleReport | null; a: FullAnalysis }) {
  if (!report)
    return (
      <div>
        <div className={s.colHead}>
          <h3>{title}</h3>
          <StatusBadge tone="neutral">non mesuré</StatusBadge>
        </div>
        <p className={s.small}>Ce module n’a pas pu tourner sur cette analyse.</p>
      </div>
    );
  const sections = sortedSections(report);
  const issues = sections.reduce((n, x) => n + x.findings.filter((f) => f.severity !== 'info').length, 0);
  return (
    <div>
      <div className={s.colHead}>
        <h3>{title}</h3>
        <StatusBadge tone={scoreTone(report.score)}>
          {Math.round(report.score)}/100, {issues} constats
        </StatusBadge>
      </div>
      <div className={s.secList}>
        {sections.map((sec) => (
          <SectionDisclosure key={sec.id} sec={sec} a={a} />
        ))}
      </div>
    </div>
  );
}

function SectionDisclosure({ sec, a }: { sec: ScoredSection; a: FullAnalysis }) {
  const n = sec.findings.length;
  return (
    <Disclosure
      title={
        <span className="flex items-baseline justify-between gap-3">
          <span>{sec.label}</span>
          <span className={s.secScore} style={{ color: `var(--tone-${scoreTone(sec.score)})` }}>
            {Math.round(sec.score)}
          </span>
        </span>
      }
      summary={n ? `${n} constat${n > 1 ? 's' : ''}` : 'Rien à signaler'}
    >
      {n ? (
        <ul>
          {sec.findings.map((f) => (
            <li key={f.id} className={s.finding}>
              <p className={s.findingTitle}>
                <span className={s.sev} data-tone={SEVERITY_TONE[f.severity]} aria-hidden="true" />
                <span>
                  {f.title}
                  <span className="sr-only"> ({SEVERITY_LABEL[f.severity]})</span>
                </span>
              </p>
              <div className={s.findingBody}>
                <p>
                  <span className={s.label}>Pourquoi : </span>
                  {f.why}
                </p>
                <p>
                  <span className={s.label}>Quoi faire : </span>
                  {f.fix}
                </p>
                {hasAutoFix(a, f) ? (
                  <p className="mt-2">
                    <span className={s.autofix}>Repéré peut le faire pour vous</span>
                  </p>
                ) : null}
              </div>
              <AffectedPages f={f} max={8} />
              {f.evidence && f.affected.some((x) => x.url) ? <p className={s.evidence}>{f.evidence}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.small}>Aucun problème trouvé sur les pages lues.</p>
      )}
    </Disclosure>
  );
}

function AiSection({ ai, brand }: { ai: AiCheckSummary; brand: string }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.2);
  return (
    <section className={s.section} aria-labelledby="ai-h">
      <h2 id="ai-h" className={s.h2}>
        Ce que disent les IA
      </h2>
      <p className={s.h2sub}>
        {ai.demo
          ? ai.note
          : `${ai.questions.length} questions de clients posées à ${ai.providers.map(providerLabel).join(', ')}. Score de recommandation : ${ai.score}/100${
              ai.range ? ` (entre ${ai.range.low} et ${ai.range.high}, marge d’erreur d’une mesure rapide)` : ''
            }.`}
      </p>
      {ai.demo ? (
        <div className="mt-3">
          <StatusBadge tone="warn">Démonstration : aucune IA interrogée</StatusBadge>
        </div>
      ) : null}
      <div ref={ref} className={s.aiGrid}>
        {ai.questions.map((q, i) => {
          const answer =
            q.asked === 0
              ? 'Pas de réponse exploitable.'
              : `${q.mentioned ? `${brand} est cité dans ${q.mentioned} réponse${q.mentioned > 1 ? 's' : ''} sur ${q.asked}.` : `${brand} n’est cité dans aucune des ${q.asked} réponses.`}${
                  q.competitors.length ? ` Cités à votre place : ${q.competitors.slice(0, 3).join(', ')}.` : ''
                }`;
          return (
            <div key={q.id} className={s.q}>
              <p className={s.qText}>{q.text}</p>
              <p className={s.qAnswer}>
                <TypeLater text={answer} play={seen} delay={i * 450} />
              </p>
              <div className={s.qBar} aria-hidden="true">
                {Array.from({ length: Math.min(q.asked, 12) }, (_, k) => (
                  <span key={k} className={s.qDot} data-on={k < q.mentioned ? '' : undefined} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {ai.topCompetitors.length ? (
        <p className={`${s.small} mt-4`}>
          Les plus cités à votre place : <b className="text-ink">{ai.topCompetitors.join(', ')}</b>
          {ai.demo ? ' (noms simulés)' : ''}.
        </p>
      ) : null}
      {!ai.demo ? <p className={`${s.small} mt-2`}>{ai.note}</p> : null}
    </section>
  );
}

function TypeLater({ text, play, delay }: { text: string; play: boolean; delay: number }) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    if (!play) return;
    const id = setTimeout(() => setGo(true), delay);
    return () => clearTimeout(id);
  }, [play, delay]);
  return <Typewriter text={text} play={go} msPerStep={14} chunk={2} />;
}

function Comparison({ a }: { a: FullAnalysis }) {
  const c = a.comparison!;
  const rows: { name: string; now: number | null; before: number | null }[] = [
    { name: 'Google (SEO)', now: a.scores.seo, before: c.scores.seo },
    { name: 'IA (GEO)', now: a.scores.geo, before: c.scores.geo },
    { name: 'Global', now: a.scores.global, before: c.scores.global },
  ];
  const all = [...(a.seo?.sections ?? []), ...(a.geo?.sections ?? [])].flatMap((x) => x.findings);
  const appeared = c.appeared.map((id) => all.find((f) => f.id === id)?.title).filter(Boolean) as string[];
  return (
    <section className={s.section} aria-labelledby="cmp-h">
      <h2 id="cmp-h" className={s.h2}>
        Depuis l’analyse du {dateFr(c.previousAt)}
      </h2>
      <p className={s.h2sub}>
        {c.fixed.length} problème{c.fixed.length > 1 ? 's' : ''} disparu{c.fixed.length > 1 ? 's' : ''}, {c.appeared.length} nouveau
        {c.appeared.length > 1 ? 'x' : ''}.
      </p>
      <div className={s.compare}>
        {rows.map((r) => (
          <div key={r.name} className={s.cmp}>
            <div className={s.cmpName}>{r.name}</div>
            <div className={s.cmpVal}>{r.now ?? '–'}</div>
            {r.now != null && r.before != null ? <Delta value={r.now - r.before} unit=" pts" label={`avant : ${r.before}`} /> : <span className={s.small}>pas de comparaison</span>}
          </div>
        ))}
      </div>
      {appeared.length ? (
        <p className={`${s.small} mt-3`}>
          Nouveaux : <span className="text-ink">{appeared.slice(0, 5).join(' ; ')}</span>
        </p>
      ) : null}
    </section>
  );
}

function Performance({ a }: { a: FullAnalysis }) {
  const ps = a.data?.pagespeed;
  return (
    <section className={s.section} aria-labelledby="perf-h">
      <h2 id="perf-h" className={s.h2}>
        Vitesse sur mobile
      </h2>
      {ps ? (
        <>
          <p className={s.h2sub}>
            Mesure {ps.source} de la page d’accueil, sur mobile{ps.field ? ', avec des données de vrais visiteurs (CrUX)' : ', en laboratoire'}.
          </p>
          <div className={s.perf}>
            {ps.performance != null ? <PerfCell name="Performance" value={`${ps.performance}/100`} tone={scoreTone(ps.performance)} /> : null}
            {ps.lcpMs != null ? <PerfCell name="Affichage principal (LCP)" value={`${(ps.lcpMs / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s`} tone={ps.lcpMs <= 2500 ? 'up' : ps.lcpMs <= 4000 ? 'warn' : 'down'} /> : null}
            {ps.inpMs != null ? <PerfCell name="Réactivité (INP)" value={`${Math.round(ps.inpMs)} ms`} tone={ps.inpMs <= 200 ? 'up' : ps.inpMs <= 500 ? 'warn' : 'down'} /> : null}
            {ps.cls != null ? <PerfCell name="Stabilité (CLS)" value={ps.cls.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} tone={ps.cls <= 0.1 ? 'up' : ps.cls <= 0.25 ? 'warn' : 'down'} /> : null}
          </div>
        </>
      ) : (
        <p className={s.h2sub}>{a.data?.note ?? 'Mesure de vitesse non disponible sur cette analyse. Aucune valeur n’est estimée.'}</p>
      )}
    </section>
  );
}

function PerfCell({ name, value, tone }: { name: string; value: string; tone: string }) {
  return (
    <div className={s.cmp}>
      <div className={s.cmpName}>{name}</div>
      <div className={s.cmpVal} style={{ color: `var(--tone-${tone})` }}>
        {value}
      </div>
    </div>
  );
}

const MOD_LABEL: Record<string, string> = {
  detect: 'Lecture de la page d’accueil',
  crawl: 'Exploration du site',
  seo: 'Audit Google (SEO)',
  geo: 'Audit IA (GEO)',
  ai: 'Questions posées aux IA',
  data: 'Vitesse mobile (PageSpeed)',
};
const STATUS_LABEL: Record<string, string> = { ok: 'fait', failed: 'échec', skipped: 'non lancé', timeout: 'temps dépassé' };

function Method({ a }: { a: FullAnalysis }) {
  return (
    <div className={s.method}>
      <Disclosure title="Comment cette analyse a été faite" summary="Ce que nous avons lu, en combien de temps, et ses limites">
        <ul className={s.modList}>
          {Object.entries(a.modules).map(([k, m]) => (
            <li key={k}>
              <span>{MOD_LABEL[k] ?? k}</span>
              <span className={s.small}>
                {STATUS_LABEL[m.status] ?? m.status}
                {m.status === 'ok' ? `, ${seconds(m.ms)}` : ''}
              </span>
            </li>
          ))}
        </ul>
        <p className={`${s.small} mt-3`}>
          Notre robot RepereBot lit jusqu’à 60 pages en respectant votre robots.txt. Les scores sont arrondis ; ils comparent votre site à des
          bonnes pratiques publiées par Google et par les éditeurs d’IA, sans promettre de position ni de citation.
          {a.crawl?.sitemapUrls ? ` Votre plan de site déclare ${a.crawl.sitemapUrls} adresses.` : ''}
        </p>
        <p className={`${s.small} mt-2`}>
          <Link href="/methode" className="underline underline-offset-2">
            Notre méthode en détail
          </Link>
        </p>
      </Disclosure>
    </div>
  );
}

export default AnalysisReport;
