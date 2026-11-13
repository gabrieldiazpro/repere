'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import s from './analysis.module.css';
import { AnalysisReport } from './AnalysisReport';
import { LiveAnalysis } from './LiveAnalysis';
import { initialLive, reduceLive, startAnalysis, waitLabel, type LiveState, type StartBody } from './stream';

type SiteType = 'local' | 'pme' | 'ecommerce';

export interface AnalysisPrefill {
  site?: string;
  /** nom saisi à la place d'une adresse (formulaire de l'accueil) */
  name?: string;
  siteType?: SiteType;
  city?: string;
}

type Stage = { kind: 'form' } | { kind: 'live' } | { kind: 'done' } | { kind: 'failed'; message: string };

const SITE_RE = /^(https?:\/\/)?([a-z0-9àâçéèêëîïôûùüÿñæœ-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i;

/**
 * /analyse : formulaire (un champ) → écran vivant branché sur le flux réel → rapport, sans changer de page.
 * Quand l'analyse est enregistrée, l'adresse devient le lien partageable signé (/analyse/<id>?t=<jeton>).
 */
export function AnalysisApp({ prefill = {}, children }: { prefill?: AnalysisPrefill; children?: React.ReactNode }) {
  const [stage, setStage] = useState<Stage>({ kind: 'form' });
  const [live, setLive] = useState<LiveState>(initialLive);
  const [elapsed, setElapsed] = useState(0);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState<{ msg: string; fields?: Record<string, string>; tone?: 'down' | 'warn' } | null>(null);
  const lastBody = useRef<StartBody | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const t0 = useRef(0);
  const topRef = useRef<HTMLDivElement>(null);

  // Chronomètre réel pendant l'analyse.
  useEffect(() => {
    if (stage.kind !== 'live') return;
    const id = setInterval(() => setElapsed(performance.now() - t0.current), 250);
    return () => clearInterval(id);
  }, [stage.kind]);

  useEffect(() => () => ctrl.current?.abort(), []);

  const run = useCallback(async (body: StartBody) => {
    ctrl.current?.abort();
    const ac = new AbortController();
    ctrl.current = ac;
    lastBody.current = body;
    t0.current = performance.now();
    setElapsed(0);
    setShareUrl(null);
    setFormError(null);
    let state = initialLive();
    setLive(state);
    setStage({ kind: 'live' });
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: 'start' }));
    const res = await startAnalysis(
      body,
      (line) => {
        if (ac.signal.aborted) return;
        state = reduceLive(state, line);
        setLive(state);
        if (line.type === 'saved') {
          const url = `/analyse/${encodeURIComponent(line.id)}?t=${encodeURIComponent(line.token)}`;
          setShareUrl(url);
          try {
            window.history.replaceState(null, '', url);
          } catch {
            /* navigation non modifiable */
          }
        }
      },
      { signal: ac.signal },
    );
    if (ac.signal.aborted) return;
    if (!res.ok) {
      const tone = res.status === 429 || res.status === 503 ? 'warn' : 'down';
      const msg = res.retryAfterS ? `${res.error} Prochain essai possible ${waitLabel(res.retryAfterS)}.` : res.error;
      setFormError({ msg, fields: res.fields, tone });
      setStage({ kind: 'form' });
      return;
    }
    if (state.analysis) {
      setElapsed(state.analysis.durationMs);
      setStage({ kind: 'done' });
    } else {
      setStage({ kind: 'failed', message: state.error ?? 'L’analyse s’est arrêtée avant la fin. Relancez-la dans un instant.' });
    }
  }, []);

  const cancel = () => {
    ctrl.current?.abort();
    setStage({ kind: 'form' });
  };

  if (stage.kind === 'live')
    return (
      <div ref={topRef} className={s.wrap}>
        <LiveAnalysis
          live={live}
          elapsedMs={elapsed}
          onCancel={cancel}
          onCorrect={({ brand, city }) => lastBody.current && run({ ...lastBody.current, brand: brand || undefined, city: city || undefined, fresh: true })}
        />
      </div>
    );

  if (stage.kind === 'done' && live.analysis)
    return (
      <div ref={topRef} className={s.wrap}>
        {live.cached ? (
          <p className={`${s.alert} mb-6`} data-tone="brand" role="status">
            Ce site a été analysé il y a moins de 10 minutes : voici ce résultat.{' '}
            <button type="button" className={s.linkBtn} onClick={() => lastBody.current && run({ ...lastBody.current, fresh: true })}>
              Relancer une analyse complète
            </button>
          </p>
        ) : null}
        {live.error ? (
          <p className={`${s.alert} mb-6`} data-tone="warn" role="status">
            {live.error}
          </p>
        ) : null}
        <AnalysisReport analysis={live.analysis} shareUrl={shareUrl} onRerun={() => lastBody.current && run({ ...lastBody.current, fresh: true })} />
        <p className={`${s.small} mt-8`}>
          <button type="button" className={s.linkBtn} onClick={() => setStage({ kind: 'form' })}>
            Analyser un autre site
          </button>
        </p>
      </div>
    );

  return (
    <div ref={topRef} className={s.wrap}>
      {stage.kind === 'failed' ? (
        <div className={`${s.alert} mb-8`} data-tone="down" role="alert">
          <strong>L’analyse n’a pas abouti.</strong> {stage.message}
          {lastBody.current ? (
            <div className="mt-3">
              <button type="button" className="ui-btn" onClick={() => lastBody.current && run({ ...lastBody.current, fresh: true })}>
                Relancer l’analyse
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <AnalysisForm prefill={prefill} error={formError} onSubmit={run} last={lastBody.current} />
      {/* Explications rendues côté serveur (SEO) : seulement avant l'analyse. */}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function AnalysisForm({
  prefill,
  error,
  onSubmit,
  last,
}: {
  prefill: AnalysisPrefill;
  error: { msg: string; fields?: Record<string, string>; tone?: 'down' | 'warn' } | null;
  onSubmit: (b: StartBody) => void;
  last: StartBody | null;
}) {
  const [url, setUrl] = useState(last?.url ?? prefill.site ?? '');
  const [pro, setPro] = useState(!!last?.pro);
  const [brand, setBrand] = useState(last?.brand ?? (prefill.site ? '' : (prefill.name ?? '')));
  const [city, setCity] = useState(last?.city ?? prefill.city ?? '');
  const [siteType, setSiteType] = useState<SiteType | ''>(last?.siteType ?? prefill.siteType ?? '');
  const [email, setEmail] = useState(last?.email ?? '');
  const [hp, setHp] = useState('');
  const [local, setLocal] = useState<Record<string, string>>({});
  const urlRef = useRef<HTMLInputElement>(null);
  const proRef = useRef<HTMLInputElement>(null);
  const fields = { ...(error?.fields ?? {}), ...local };
  const nameOnly = !!prefill.name && !prefill.site && !last;

  useEffect(() => {
    // Arrivée depuis l'accueil avec une adresse : il ne reste qu'à cocher la case.
    if (prefill.site && !last) proRef.current?.focus();
  }, [prefill.site, last]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const u = url.trim();
    if (!u) errs.url = 'Indiquez l’adresse de votre site.';
    else if (!SITE_RE.test(u)) errs.url = 'Cette adresse ne ressemble pas à un site (exemple : maboutique.fr).';
    if (!pro) errs.pro = 'Cochez cette case : l’analyse est réservée aux professionnels.';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) errs.email = 'Cette adresse e-mail semble incomplète.';
    setLocal(errs);
    if (errs.url) return urlRef.current?.focus();
    if (errs.pro) return proRef.current?.focus();
    if (errs.email) return;
    onSubmit({
      url: u,
      pro: true,
      ...(brand.trim() ? { brand: brand.trim() } : {}),
      ...(city.trim() ? { city: city.trim() } : {}),
      ...(siteType ? { siteType } : {}),
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(hp ? { hp } : {}),
    });
  };

  return (
    <div className={s.formHero}>
      <div>
        <h1 className={s.h1}>En 60 secondes, la vérité sur votre visibilité Google et IA</h1>
        <p className={s.lede}>
          Entrez l’adresse de votre site : notre robot l’explore pour de vrai, page par page, vérifie plus de 180 points SEO et ce que lisent
          ChatGPT, Gemini et Perplexity, puis vous donne vos 5 priorités.
        </p>
        <form className={s.form} onSubmit={submit} noValidate aria-label="Lancer l’analyse de votre site">
          {error ? (
            <p className={s.alert} data-tone={error.tone ?? 'down'} role="alert">
              {error.msg}
            </p>
          ) : null}
          {nameOnly ? (
            <p className={s.alert} data-tone="brand">
              L’analyse lit votre site : indiquez son adresse ci-dessous. Pas de site ?{' '}
              <Link className="font-semibold underline underline-offset-2" href={`/audit?nom=${encodeURIComponent(prefill.name ?? '')}${prefill.siteType ? `&segment=${prefill.siteType}` : ''}`}>
                Testez votre visibilité dans les IA avec votre nom
              </Link>
              .
            </p>
          ) : null}
          <div>
            <label htmlFor="an-url" className={s.fieldLabel}>
              Adresse de votre site
            </label>
            <div className={s.urlRow}>
              <input
                ref={urlRef}
                id="an-url"
                name="site"
                className={s.input}
                type="text"
                inputMode="url"
                autoComplete="url"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="maboutique.fr"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                aria-invalid={fields.url ? true : undefined}
                aria-describedby={fields.url ? 'an-url-err' : 'an-url-help'}
                required
              />
              <button type="submit" className="ui-btn" data-variant="primary" data-size="lg" style={{ minHeight: 56, borderRadius: 12, fontSize: 16 }}>
                Analyser mon site
              </button>
            </div>
            {fields.url ? (
              <p id="an-url-err" className={s.fieldError}>
                {fields.url}
              </p>
            ) : (
              <p id="an-url-help" className={s.help}>
                Gratuit, sans inscription. La marque et la ville sont détectées sur votre site.
              </p>
            )}
          </div>

          <label className={s.check} data-invalid={fields.pro ? '' : undefined}>
            <input ref={proRef} type="checkbox" checked={pro} onChange={(e) => setPro(e.target.checked)} aria-describedby={fields.pro ? 'an-pro-err' : undefined} required />
            <span>J’agis pour les besoins de mon activité professionnelle</span>
          </label>
          {fields.pro ? (
            <p id="an-pro-err" className={s.fieldError} style={{ marginTop: -8 }}>
              {fields.pro}
            </p>
          ) : null}

          <details className={s.more} open={!!(fields.brand || fields.city || fields.email || nameOnly) || undefined}>
            <summary>Préciser la marque, la ville ou votre e-mail (facultatif)</summary>
            <div className={s.moreGrid}>
              <div>
                <label htmlFor="an-brand" className={s.fieldLabel}>
                  Nom de la marque
                </label>
                <input id="an-brand" className={`${s.input} ${s.inputSm}`} value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={80} autoComplete="organization" placeholder="détecté sur le site" />
                {fields.brand ? <p className={s.fieldError}>{fields.brand}</p> : null}
              </div>
              <div>
                <label htmlFor="an-city" className={s.fieldLabel}>
                  Ville
                </label>
                <input id="an-city" className={`${s.input} ${s.inputSm}`} value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} autoComplete="address-level2" placeholder="détectée sur le site" />
                {fields.city ? <p className={s.fieldError}>{fields.city}</p> : null}
              </div>
              <div>
                <label htmlFor="an-type" className={s.fieldLabel}>
                  Type de site
                </label>
                <select id="an-type" className={`${s.input} ${s.inputSm} ${s.select}`} value={siteType} onChange={(e) => setSiteType(e.target.value as SiteType | '')}>
                  <option value="">Détecter automatiquement</option>
                  <option value="local">Commerce ou artisan local</option>
                  <option value="pme">PME, services, B2B</option>
                  <option value="ecommerce">Boutique en ligne</option>
                </select>
              </div>
              <div>
                <label htmlFor="an-email" className={s.fieldLabel}>
                  Votre e-mail
                </label>
                <input
                  id="an-email"
                  className={`${s.input} ${s.inputSm}`}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  aria-invalid={fields.email ? true : undefined}
                  aria-describedby="an-email-help"
                />
                {fields.email ? (
                  <p className={s.fieldError}>{fields.email}</p>
                ) : (
                  <p id="an-email-help" className={s.help}>
                    Nous vous envoyons le lien du rapport, et vous le retrouvez dans votre espace si vous le créez. Désinscription en un clic, jamais revendu.
                  </p>
                )}
              </div>
            </div>
          </details>
          <div className={s.honey} aria-hidden="true">
            <label>
              Ne pas remplir
              <input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
            </label>
          </div>
        </form>
      </div>

      <aside className={s.reads} aria-labelledby="reads-h">
        <h2 id="reads-h">Ce que l’analyse lit, pendant que vous regardez</h2>
        <ol className={s.readsList}>
          <li>
            <span className={s.readsNum}>1</span>
            <span>
              <b>Votre site, page par page</b>
              Jusqu’à 60 pages, robots.txt et plan du site compris.
            </span>
          </li>
          <li>
            <span className={s.readsNum}>2</span>
            <span>
              <b>Ce que Google attend</b>
              Titres, indexation, liens, images, données structurées, mobile.
            </span>
          </li>
          <li>
            <span className={s.readsNum}>3</span>
            <span>
              <b>Ce que les IA peuvent citer</b>
              Accès de leurs robots, identité de l’entreprise, passages citables, fraîcheur.
            </span>
          </li>
          <li>
            <span className={s.readsNum}>4</span>
            <span>
              <b>Les questions de vos clients</b>
              Posées aux IA : êtes-vous cité, ou vos concurrents ?
            </span>
          </li>
        </ol>
        <p className={s.readsFoot}>Notre robot s’appelle RepereBot. Il respecte votre robots.txt et ne lit que des pages publiques.</p>
      </aside>
    </div>
  );
}

export default AnalysisApp;
