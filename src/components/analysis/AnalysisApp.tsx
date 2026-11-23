'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import s from './analysis.module.css';
import { AnalysisReport } from './AnalysisReport';
import { LiveAnalysis } from './LiveAnalysis';
import { PRO_DECLARATION_TEXT, consumeProIntent } from './proIntent';
import { initialLive, reduceLive, startAnalysis, waitLabel, type LiveState, type StartBody } from './stream';

type SiteType = 'local' | 'pme' | 'ecommerce';

export interface AnalysisPrefill {
  site?: string;
  /** nom saisi à la place d'une adresse (formulaire de l'accueil) */
  name?: string;
  siteType?: SiteType;
  city?: string;
  /** case « usage professionnel » cochée sur l'accueil (?pro=1) : démarrage direct si l'onglet le confirme */
  pro?: boolean;
}

type Stage = { kind: 'form' } | { kind: 'live' } | { kind: 'done' } | { kind: 'failed'; message: string };

const SITE_RE = /^(https?:\/\/)?([a-z0-9àâçéèêëîïôûùüÿñæœ-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i;

/**
 * /analyse : formulaire (un champ) → écran vivant branché sur le flux réel → rapport, sans changer de page.
 * Quand l'analyse est enregistrée, l'adresse devient le lien partageable signé (/analyse/<id>?t=<jeton>).
 */
export interface EnginesInfo {
  /** aucune IA configurée : réponses simulées */
  demo: boolean;
  engines: { id: string; label: string }[];
}

export function AnalysisApp({ prefill = {}, engines, children }: { prefill?: AnalysisPrefill; engines?: EnginesInfo; children?: React.ReactNode }) {
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

  // Arrivée depuis l'accueil, case cochée là-bas : le test démarre tout de suite (pas de second clic).
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current) return;
    autoStarted.current = true;
    const site = prefill.site?.trim();
    if (!prefill.pro || !site) return;
    try {
      // ?pro=1 retiré de l'adresse : un rechargement ou un lien copié ne vaut pas déclaration.
      const u = new URL(window.location.href);
      if (u.searchParams.has('pro')) {
        u.searchParams.delete('pro');
        window.history.replaceState(null, '', `${u.pathname}${u.search}${u.hash}`);
      }
    } catch {
      /* sans effet */
    }
    if (!SITE_RE.test(site) || !consumeProIntent(site)) return;
    void run({ url: site, pro: true, proSource: 'accueil', ...(prefill.siteType ? { siteType: prefill.siteType } : {}), ...(prefill.city ? { city: prefill.city } : {}) });
  }, [prefill.pro, prefill.site, prefill.siteType, prefill.city, run]);

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
            Ce site a été analysé il y a moins de 10 minutes : voici ce résultat (les IA ne sont pas réinterrogées).{' '}
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
      <AnalysisForm prefill={prefill} error={formError} onSubmit={run} last={lastBody.current} engines={engines} />
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
  engines,
}: {
  engines?: EnginesInfo;
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
      proSource: 'analyse',
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
        <h1 className={s.h1}>Test de marque gratuit : votre marque est-elle citée par les IA ?</h1>
        <p className={s.lede}>
          Entrez votre site : nous posons en direct de vraies questions de clients aux IA, et vous voyez qui elles citent, à quelle place, qui
          passe devant vous et pourquoi. Puis votre site est analysé page par page (SEO et GEO), avec vos premières actions.
        </p>
        {engines?.engines.length ? (
          <p className={s.engines}>
            <span>{engines.demo ? 'Démonstration, réponses simulées de' : 'Interrogées en direct :'}</span>
            {engines.engines.map((e) => (
              <b key={e.id}>{e.label}</b>
            ))}
          </p>
        ) : null}
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
                Tester ma marque
              </button>
            </div>
            {fields.url ? (
              <p id="an-url-err" className={s.fieldError}>
                {fields.url}
              </p>
            ) : (
              <p id="an-url-help" className={s.help}>
                Gratuit, sans inscription ni carte bancaire, environ une minute. Marque, ville et métier sont détectés sur votre site, et corrigeables.
              </p>
            )}
          </div>

          <label className={s.check} data-invalid={fields.pro ? '' : undefined}>
            <input ref={proRef} type="checkbox" checked={pro} onChange={(e) => setPro(e.target.checked)} aria-describedby={fields.pro ? 'an-pro-err' : undefined} required />
            <span>{PRO_DECLARATION_TEXT}</span>
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
        <h2 id="reads-h">Ce qui se passe pendant la minute d’analyse</h2>
        <ol className={s.readsList}>
          <li>
            <span className={s.readsNum}>1</span>
            <span>
              <b>Les questions de vos clients, posées aux IA</b>
              3 à 5 questions, une réponse par IA : cité ou non, à quelle place, qui à votre place, la phrase exacte.
            </span>
          </li>
          <li>
            <span className={s.readsNum}>2</span>
            <span>
              <b>Pourquoi eux plutôt que vous</b>
              Les sources que l’IA a lues et ce que le site cité montre que le vôtre ne montre pas.
            </span>
          </li>
          <li>
            <span className={s.readsNum}>3</span>
            <span>
              <b>Votre site, page par page</b>
              Jusqu’à 60 pages : ce que Google attend et ce que les IA peuvent citer.
            </span>
          </li>
          <li>
            <span className={s.readsNum}>4</span>
            <span>
              <b>Vos premières actions</b>
              Avec celles que Repéré peut préparer pour vous, à valider avant toute publication.
            </span>
          </li>
        </ol>
        <p className={s.readsFoot}>
          Une seule mesure ne dit pas tout : nous affichons la marge d’erreur, et le suivi la confirme dans le temps. Notre robot, RepereBot,
          respecte votre robots.txt et ne lit que des pages publiques.
        </p>
      </aside>
    </div>
  );
}

export default AnalysisApp;
