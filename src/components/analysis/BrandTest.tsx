'use client';

/**
 * V8 (TEST-MARQUE) — « Votre marque est-elle citée par les IA ? » : tableau question × IA, en direct pendant
 * l'analyse puis en tête du rapport, et « Pourquoi lui ? » pour chaque question où un concurrent est cité à votre place.
 * Les noms des IA sont écrits en texte (jamais de logos officiels).
 */
import { useState } from 'react';
import type { BrandTest, BrandTestCell, BrandTestSkip, CompetitorWhy } from '@/lib/analysis/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import s from './analysis.module.css';
import { providerLabel as engineLabel } from './format';

const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
const ord = (n: number) => (n === 1 ? '1ʳᵉ' : `${n}ᵉ`);

/** Phrase-réponse (même texte que l'e-mail, lib/analysis/mail.ts). */
export function brandAnswer(t: BrandTest): string {
  const o = t.overall;
  if (!o.asked) return `Aucune réponse exploitable des IA pour ${t.brand} sur cette mesure.`;
  if (!o.cited) return `${t.brand} n’est cité dans aucune des ${o.asked} réponses.`;
  return `${t.brand} est cité dans ${o.cited} réponse${o.cited > 1 ? 's' : ''} sur ${o.asked}.`;
}

function cellWord(c: BrandTestCell): string {
  if (c.status === 'cited') return c.rank ? `Cité, ${ord(c.rank)}` : 'Cité';
  if (c.status === 'not_cited') return 'Non cité';
  if (c.status === 'no_reco') return 'Aucun nom donné';
  return 'Pas de réponse';
}

function Cell({ c, demo }: { c: BrandTestCell; demo: boolean }) {
  const tone = c.status === 'cited' ? 'up' : c.status === 'not_cited' ? 'down' : 'neutral';
  const instead = c.instead.length ? (c.status === 'cited' ? `Avant vous : ${c.instead.join(', ')}` : `À votre place : ${c.instead.join(', ')}`) : '';
  return (
    <details className={s.btCell} data-tone={tone}>
      <summary>
        <span className={s.btEngine}>{c.label}</span>
        <span className={s.btVerdict}>
          <span className={s.btMark} aria-hidden="true">{c.status === 'cited' ? '✓' : c.status === 'not_cited' ? '✕' : '–'}</span>
          {cellWord(c)}
        </span>
        {instead ? <span className={s.btInstead}>{instead}{demo ? ' (exemple simulé)' : ''}</span> : null}
      </summary>
      <div className={s.btMore}>
        {demo ? <p className={s.small}>Exemple simulé : aucune IA n’a été interrogée, cette réponse montre seulement la forme du résultat.</p> : null}
        {c.excerpt ? <blockquote className={s.btQuote}>{c.excerpt}</blockquote> : <p className={s.small}>Aucune phrase à citer.</p>}
        {c.sources.length ? (
          <p className={s.btSources}>
            <span>Sources lues :</span>
            {c.sources.map((x) => (
              <a key={x.url} href={x.url} rel="nofollow noopener noreferrer" target="_blank" title={x.title ?? x.url}>
                {x.domain}
              </a>
            ))}
          </p>
        ) : (
          <p className={s.btSources}>
            <span>Sources : aucune renvoyée par cette IA.</span>
          </p>
        )}
        {c.model ? <p className={s.small}>Modèle interrogé : {c.model}</p> : null}
      </div>
    </details>
  );
}

function Matrix({ t }: { t: BrandTest }) {
  return (
    <ol className={s.btQuestions}>
      {t.questions.map((q) => (
        <li key={q.id} className={s.btQ}>
          <p className={s.btQText}>{q.text}</p>
          <div className={s.btCells}>
            {q.cells.map((c) => (
              <Cell key={c.provider} c={c} demo={t.demo} />
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Providers({ t }: { t: BrandTest }) {
  return (
    <ul className={s.btProviders} aria-label="Citations par IA">
      {t.providers.map((p) => (
        <li key={p.id}>
          <span className={s.btPName}>{p.label}</span>
          <span className={s.btPBar} aria-hidden="true">
            <span style={{ transform: `scaleX(${p.asked ? p.cited / p.asked : 0})` }} />
          </span>
          <span className={s.btPVal}>
            {p.cited}/{p.asked}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Pendant l'analyse : questions et IA annoncées, réponses reçues par IA, puis le tableau dès qu'il est prêt. */
export function BrandTestLive({
  plan,
  test,
  skip,
  byProvider,
  progress,
}: {
  progress?: { done: number; total: number; providers: string[] };
  plan?: { demo: boolean; questions: { id: string; text: string }[]; providers: { id: string; label: string }[] };
  test?: BrandTest;
  skip?: BrandTestSkip;
  byProvider: Record<string, number>;
}) {
  return (
    <section className={s.btLive} aria-labelledby="bt-live-h" aria-live="polite">
      <div className={s.btHead}>
        <h2 id="bt-live-h" className={s.btTitle}>
          Votre marque est-elle citée par les IA ?
        </h2>
        {plan?.demo || test?.demo ? <StatusBadge tone="warn">Démonstration : réponses simulées</StatusBadge> : null}
      </div>
      {skip && !test ? (
        <p className={`${s.alert} mt-3`} data-tone="warn">
          {skip.message}
        </p>
      ) : test ? (
        <>
          <p className={s.btAnswer}>{brandAnswer(test)}</p>
          <Providers t={test} />
          <Matrix t={test} />
        </>
      ) : plan ? (
        <>
          <p className={s.btLede}>
            {plan.questions.length} questions de clients posées en direct à {plan.providers.map((p) => p.label).join(', ')}.
          </p>
          <ul className={s.btPending}>
            {plan.providers.map((p) => {
              const n = byProvider[p.id] ?? 0;
              const total = plan.questions.length;
              return (
                <li key={p.id} data-done={n >= total ? '' : undefined}>
                  <span className={s.btPName}>{p.label}</span>
                  <span className={s.btPBar} aria-hidden="true">
                    <span style={{ transform: `scaleX(${Math.min(1, n / total)})` }} />
                  </span>
                  <span className={s.btPVal}>{n >= total ? 'a répondu' : `${Math.min(n, total)}/${total}`}</span>
                </li>
              );
            })}
          </ul>
          <ol className={s.btPendingQ}>
            {plan.questions.map((q) => (
              <li key={q.id}>{q.text}</li>
            ))}
          </ol>
        </>
      ) : progress?.total ? (
        <p className={s.btLede}>
          {progress.done} réponses reçues sur {progress.total}
          {progress.providers.length ? `, de ${progress.providers.map(engineLabel).join(', ')}` : ''}.
        </p>
      ) : (
        <p className={s.btLede}>Préparation des questions de vos clients…</p>
      )}
    </section>
  );
}

function WhyCard({ w, demo }: { w: CompetitorWhy; demo: boolean }) {
  const read = w.sources.filter((x) => x.them && !x.you);
  return (
    <article className={s.why}>
      <p className={s.whyQ}>{w.question}</p>
      <h3 className={s.whyTitle}>
        Pourquoi {w.competitor}
        {demo ? ' (exemple simulé)' : ''} ?
      </h3>
      <p className={s.small}>Cité par {w.providers.join(', ')}.</p>
      <div className={s.whyGrid}>
        <div>
          <h4>Ce que les IA ont lu</h4>
          {w.sources.length ? (
            <ul className={s.whyList}>
              {w.sources.slice(0, 5).map((x) => (
                <li key={x.url}>
                  <a href={x.url} rel="nofollow noopener noreferrer" target="_blank">
                    {x.domain}
                  </a>{' '}
                  <span className={s.small}>{x.categoryLabel.toLowerCase()}</span>
                  <span className={s.whyTags}>
                    {x.them ? <span data-tone="down">le nomme</span> : null}
                    {x.you ? <span data-tone="up">vous nomme</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.small}>Ces IA n’ont renvoyé aucune source pour cette question (réponse tirée de leur mémoire).</p>
          )}
          {read.length ? (
            <p className={`${s.small} mt-2`}>
              {w.competitor} est nommé sur {read.length} source{read.length > 1 ? 's' : ''} où vous ne l’êtes pas.
            </p>
          ) : null}
        </div>
        <div>
          <h4>Chez lui, pas chez vous</h4>
          {w.gaps.length ? (
            <ul className={s.whyList}>
              {w.gaps.map((g) => (
                <li key={g.id}>
                  {g.label}
                  {g.evidence ? <span className={s.small}> : {g.evidence}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.small}>
              {w.site?.read
                ? 'Rien de ce que nous relevons sur sa page d’accueil ne manque à votre site : l’écart vient plutôt des sources.'
                : w.site?.note ?? 'Son site n’apparaît pas dans les réponses : pas de comparaison de site.'}
            </p>
          )}
          {w.strengths.length ? <p className={`${s.small} mt-2`}>Vous avez en plus : {w.strengths.map((x) => x.label.toLowerCase()).join(', ')}.</p> : null}
        </div>
      </div>
      {w.actions.length ? (
        <>
          <h4 className={s.whyActionsH}>Vos {w.actions.length} premières actions</h4>
          <ol className={s.whyActions}>
            {w.actions.map((a) => (
              <li key={a.title}>
                <div className={s.whyActionTop}>
                  <b>{a.title}</b>
                  {a.by === 'repere' ? <span className={s.autofix}>Repéré la prépare, vous validez</span> : <span className={s.src}>À faire de votre côté</span>}
                </div>
                <p>{a.how}</p>
              </li>
            ))}
          </ol>
        </>
      ) : null}
      <p className={s.whyBasis}>{w.basis}</p>
    </article>
  );
}

/** En tête du rapport. */
export function BrandTestReport({ test: t, skip, signupHref }: { test?: BrandTest; skip?: BrandTestSkip; signupHref?: string }) {
  const [all, setAll] = useState(false);
  if (!t) {
    return skip ? (
      <section className={s.btSection} aria-labelledby="bt-h">
        <h2 id="bt-h" className={s.btTitle}>
          Votre marque est-elle citée par les IA ?
        </h2>
        <p className={`${s.alert} mt-3`} data-tone="warn">
          {skip.message}
        </p>
      </section>
    ) : null;
  }
  const why = t.why ?? [];
  return (
    <section className={s.btSection} aria-labelledby="bt-h">
      <div className={s.btHead}>
        <h2 id="bt-h" className={s.btTitle}>
          Votre marque est-elle citée par les IA ?
        </h2>
        {t.demo ? <StatusBadge tone="warn">Démonstration : réponses simulées</StatusBadge> : null}
      </div>
      <div className={s.btTop}>
        <div>
          <p className={s.btAnswer}>{brandAnswer(t)}</p>
          {t.overall.asked ? (
            <p className={s.btMargin}>
              Taux mesuré {t.overall.rate} %, entre {t.overall.low} et {t.overall.high} % compte tenu de la marge d’erreur.{' '}
              {t.demo ? 'Démonstration : rien n’a été mesuré.' : `Mesure unique du ${dateFr(t.measuredAt)}, à confirmer dans le temps.`}
              {t.reused ? ` Résultat repris du test du ${dateFr(t.reused.at)} : les IA ne sont réinterrogées qu’une fois par 24 h.` : ''}
            </p>
          ) : null}
        </div>
        <Providers t={t} />
      </div>
      <Matrix t={t} />
      <p className={`${s.small} mt-3`}>
        {t.note}
        {t.notConfigured.length ? ` Non interrogées sur ce serveur : ${t.notConfigured.join(', ')}.` : ''} Touchez une réponse pour lire la phrase de l’IA et ses sources.
      </p>

      {why.length ? (
        <div className={s.whyWrap}>
          <h2 className={s.h2}>Pourquoi eux, et par quoi commencer</h2>
          <p className={s.h2sub}>Pour chaque question où un autre est cité à votre place : ce que l’IA a lu, ce qu’il montre et pas vous, vos trois premières actions.</p>
          <div className={s.whyCards}>
            {why.map((w, i) => (
              <div key={w.questionId} className={!all && i >= 2 ? s.printOnly : undefined}>
                <WhyCard w={w} demo={t.demo} />
              </div>
            ))}
          </div>
          {why.length > 2 && !all ? (
            <button type="button" className={`${s.linkBtn} ${s.noPrint}`} onClick={() => setAll(true)}>
              Voir l’explication pour {why.length - 2} autre{why.length - 2 > 1 ? 's' : ''} question{why.length - 2 > 1 ? 's' : ''}
            </button>
          ) : null}
        </div>
      ) : null}
      {signupHref ? (
        <p className={`${s.btCta} ${s.noPrint}`}>
          <a href={signupHref} className="ui-btn" data-variant="primary">
            Suivre ma marque gratuitement
          </a>
          <span className={s.small}>Sans carte bancaire. Ces questions restent suivies chaque mois, pour confirmer cette mesure dans le temps.</span>
        </p>
      ) : null}
    </section>
  );
}
