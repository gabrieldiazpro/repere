'use client';
// Assistant de démarrage /app/bienvenue : site → questions suggérées → première mesure (suivie par /api/jobs/[id]).
// Ensuite : fiche de vérité et suivi du trafic (sur leur écran). Comptes démo : rien n'est envoyé au serveur.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../icons';
import { Counter } from '@/components/motion/Counter';
import { pollJob, startMeasure, toast, type JobState } from './client';
import { normaliserSite, type EtapeId } from './demarrage';

interface Suggestion {
  text: string;
  theme: string;
  intent: string;
  intentLabel: string;
  why?: string;
}

const STEPS: { id: EtapeId; label: string; short: string; question: string }[] = [
  { id: 'site', label: 'Votre site', short: 'Site', question: 'Quel site les IA devraient-elles citer ?' },
  { id: 'questions', label: 'Vos questions', short: 'Questions', question: 'Quelles questions vos clients posent-ils aux IA ?' },
  { id: 'mesure', label: 'Première mesure', short: 'Mesure', question: 'On pose vos questions aux IA ?' },
];

const EXEMPLE_QUESTION = {
  local: 'Quel artisan de confiance appeler près de chez moi ?',
  pme: 'Quel prestataire choisir pour une PME comme la mienne ?',
  ecommerce: 'Quelle marque choisir pour ce produit ?',
} as const;

export function Onboarding({
  businessId,
  businessName,
  website,
  demo,
  initial,
  questions,
  limit,
  audits,
  segment = 'local',
  lastScore = null,
  aside,
}: {
  businessId: string;
  businessName: string;
  website: string;
  demo: boolean;
  initial: EtapeId;
  questions: string[];
  limit: number;
  audits: number;
  segment?: 'local' | 'pme' | 'ecommerce';
  /** Score de la dernière mesure (0–100), pour l'aperçu quand une mesure existe déjà. */
  lastScore?: number | null;
  /** Contenu ajouté sous l'aperçu (liste de démarrage, aide). */
  aside?: React.ReactNode;
}) {
  const router = useRouter();
  const [step, setStep] = useState<EtapeId>(initial);
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd');
  const [site, setSite] = useState(website);
  const [question, setQuestion] = useState<string>(questions[0] ?? '');
  const [measured, setMeasured] = useState(audits > 0);
  const headRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // Focus sur le titre de l'étape sans le glisser sous l'en-tête collant : on remonte au début du panneau.
    headRef.current?.focus({ preventScroll: true });
    const top = panelRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 120) window.scrollBy({ top: top - 120 });
    const u = new URL(window.location.href);
    u.searchParams.set('etape', step);
    window.history.replaceState(null, '', u);
  }, [step]);

  const idx = STEPS.findIndex((s) => s.id === step);
  const go = (id: EtapeId) => {
    setDir(STEPS.findIndex((s) => s.id === id) < idx ? 'back' : 'fwd');
    setStep(id);
  };
  // Avancement : 0 % à la première étape, 100 % une fois la mesure faite (la barre se remplit à chaque étape).
  const fill = measured ? 1 : idx / STEPS.length;

  return (
    <div className="ob grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start lg:gap-5">
      <div ref={panelRef} className="rp-panel ob-card overflow-hidden">
        <div className="ob-head">
          <div className="flex items-baseline justify-between gap-3">
            <p className="ui-caption font-semibold text-[var(--muted)]" aria-live="polite">
              Étape {idx + 1} sur {STEPS.length}
            </p>
            <p className="ui-caption rp-num text-[var(--muted)]">{measured ? 'Terminé' : `${Math.round(fill * 100)} %`}</p>
          </div>
          <div className="ob-track mt-2" role="progressbar" aria-label="Avancement du démarrage" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fill * 100)}>
            <span className="ob-track-fill" style={{ transform: `scaleX(${Math.max(0.02, fill)})` }} data-done={measured ? '' : undefined} />
          </div>
          <ol className="ob-steps mt-3" aria-label="Étapes">
            {STEPS.map((s, i) => {
              const done = i < idx || (s.id === 'mesure' && measured);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => go(s.id)}
                    aria-current={s.id === step ? 'step' : undefined}
                    className="ob-step-btn"
                    data-state={s.id === step ? 'current' : done ? 'done' : 'todo'}
                  >
                    <span className="ob-dot" aria-hidden="true">
                      {done ? (
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path className="ob-check" d="m5 12.5 4.5 4.5L19 7.5" pathLength={1} />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className="truncate sm:hidden">{s.short}</span>
                    <span className="hidden truncate sm:inline">{s.label}</span>
                    {done && <span className="sr-only"> (faite)</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        <div key={step} className="ob-body" data-dir={dir}>
          {step === 'site' && (
            <SiteStep headRef={headRef} businessId={businessId} businessName={businessName} website={website} demo={demo} value={site} onChange={setSite} onNext={() => go('questions')} />
          )}
          {step === 'questions' && (
            <QuestionsStep
              headRef={headRef}
              businessId={businessId}
              demo={demo}
              questions={questions}
              limit={limit}
              segment={segment}
              onPick={(q) => setQuestion(q || questions[0] || '')}
              onBack={() => go('site')}
              onNext={() => go('mesure')}
            />
          )}
          {step === 'mesure' && (
            <MesureStep
              headRef={headRef}
              businessId={businessId}
              demo={demo}
              audits={audits}
              onBack={() => go('questions')}
              onDone={() => {
                setMeasured(true);
                router.refresh();
              }}
            />
          )}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <ResultPreview step={step} businessName={businessName} site={site} question={question || EXEMPLE_QUESTION[segment]} example={!question} measured={measured} score={lastScore} />
        {aside}
      </div>
    </div>
  );
}

/** Aperçu du résultat : ce que la mesure établira, rempli au fil des réponses. Aucun chiffre inventé. */
function ResultPreview({ step, businessName, site, question, example, measured, score }: { step: EtapeId; businessName: string; site: string; question: string; example: boolean; measured: boolean; score: number | null }) {
  const domain = (normaliserSite(site) ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const rows = [
    { k: 'Êtes-vous cité ?', v: measured ? 'Mesuré' : 'À mesurer' },
    { k: 'À quel rang ?', v: measured ? 'Mesuré' : 'À mesurer' },
    { k: 'Les informations sont-elles justes ?', v: measured ? 'Mesuré' : 'À mesurer' },
  ];
  return (
    <section className="rp-panel ob-preview" aria-labelledby="ob-prev-h" data-focus={step}>
      <div className="rp-panel-head">
        <h2 id="ob-prev-h" className="rp-h2">
          Aperçu de votre résultat
        </h2>
        {measured ? <span className="ui-caption font-semibold text-[var(--tone-up)]">Prêt</span> : <span className="ui-caption text-[var(--muted)]">Se remplit au fil des étapes</span>}
      </div>
      <div className="rp-panel-body flex flex-col gap-3">
        <div className="ob-prev-zone" data-zone="questions">
          <p className="ui-caption text-[var(--muted)]">Un client demande à une IA{example ? ' (exemple)' : ''}</p>
          <p className="ob-bubble" key={question}>
            « {question} »
          </p>
        </div>
        <div className="ob-prev-zone" data-zone="site">
          <p className="ui-caption text-[var(--muted)]">L’IA répond, et nous cherchons</p>
          <div className="ob-answer" aria-hidden="true">
            <span className="ob-line w-[92%]" />
            <span className="ob-line w-[70%]" />
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[13px]">
            <span className="ob-chip">{businessName}</span>
            <span className="text-[var(--muted)]">cité avec</span>
            <span className="ob-chip" data-empty={domain ? undefined : ''} key={domain}>
              {domain || 'votre site'}
            </span>
          </p>
        </div>
        <ul className="ob-prev-zone flex flex-col" data-zone="mesure">
          {rows.map((r) => (
            <li key={r.k} className="flex items-center justify-between gap-3 border-t border-[var(--hair)] py-2 text-[13.5px] first:border-t-0">
              <span>{r.k}</span>
              <span className={`ui-caption inline-flex items-center gap-1 font-semibold ${measured ? 'text-[var(--tone-up)]' : 'text-[var(--muted)]'}`}>
                {measured && <Icon name="check" size={13} />}
                {r.v}
              </span>
            </li>
          ))}
        </ul>
        {measured && score != null ? (
          <div className="ob-score flex items-end justify-between gap-3 rounded-[var(--r-md)] bg-[var(--surface-2)] px-3 py-2.5">
            <div>
              <p className="ui-caption text-[var(--muted)]">Score de visibilité, dernière mesure</p>
              <p className="ui-figure-sm rp-num">
                <Counter value={Math.round(score)} duration={800} />
                <span className="ui-figure-unit">/100</span>
              </p>
            </div>
            <Link href="/app" className="ui-btn" data-size="sm">
              Voir mon Lundi
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

type HeadRef = React.RefObject<HTMLHeadingElement | null>;

function SiteStep({ headRef, businessId, businessName, website, demo, value: v, onChange: setV, onNext }: { headRef: HeadRef; businessId: string; businessName: string; website: string; demo: boolean; value: string; onChange: (v: string) => void; onNext: () => void }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = normaliserSite(v);
    if (!url) {
      setErr('Indiquez l’adresse de votre site, par exemple plomberie-martin.fr.');
      return;
    }
    setErr('');
    if (demo || url === website) {
      onNext();
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/account/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setup: { businessId, name: businessName, website: url } }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? 'L’adresse n’a pas pu être enregistrée.');
      toast({ text: 'Site enregistré.', tone: 'success' });
      onNext();
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'L’adresse n’a pas pu être enregistrée.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} noValidate className="max-w-xl">
      <h2 ref={headRef} tabIndex={-1} className="rp-display text-[22px] outline-none lg:text-[26px]">
        {STEPS[0].question}
      </h2>
      <p className="mt-2 text-[15px] text-[var(--muted)]">Nous vérifierons si les IA renvoient vers lui. Pas de site ? Passez cette étape.</p>
      <label htmlFor="ob-site" className="mt-5 block text-[14px] font-semibold">
        Adresse du site
      </label>
      <input
        id="ob-site"
        className="rp-input mt-1"
        inputMode="url"
        autoComplete="url"
        placeholder="votre-site.fr"
        value={v}
        onChange={(e) => setV(e.target.value)}
        aria-invalid={Boolean(err)}
        aria-describedby={err ? 'ob-site-err' : undefined}
      />
      {err && (
        <p id="ob-site-err" className="mt-1 text-[13px] text-[var(--danger-ink)]">
          {err}
        </p>
      )}
      {demo && <p className="mt-2 text-[13px] text-[var(--muted)]">Compte démo : l’adresse n’est pas enregistrée.</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="submit" className="rp-btn rp-btn-primary" disabled={busy}>
          {busy ? 'Enregistrement…' : 'Continuer'}
        </button>
        <button type="button" className="rp-btn rp-btn-ghost" onClick={onNext}>
          Je n’ai pas de site
        </button>
      </div>
    </form>
  );
}

const OWN_EXEMPLE = {
  local: 'Ex. : quel plombier appeler un dimanche à Paris 11 ?',
  pme: 'Ex. : quel logiciel choisir pour une PME de 50 salariés ?',
  ecommerce: 'Ex. : quelle marque de shampoing solide choisir pour cheveux secs ?',
} as const;

function QuestionsStep({ headRef, businessId, demo, questions, limit, segment, onPick, onBack, onNext }: { headRef: HeadRef; businessId: string; demo: boolean; questions: string[]; limit: number; segment: 'local' | 'pme' | 'ecommerce'; onPick: (q: string) => void; onBack: () => void; onNext: () => void }) {
  const [list, setList] = useState<Suggestion[] | null>(null);
  const [error, setError] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [own, setOwn] = useState('');
  const room = Math.max(0, limit - questions.length);

  const load = async () => {
    setError(false);
    try {
      const r = await fetch('/api/prompts/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, limit: 12 }),
      });
      if (!r.ok) throw new Error();
      const j = (await r.json()) as { suggestions?: Suggestion[] };
      const known = new Set(questions.map((q) => q.toLowerCase()));
      const s = (j.suggestions ?? []).filter((x) => !known.has(x.text.toLowerCase()));
      setList(s);
      setPicked(new Set(s.slice(0, Math.min(5, room)).map((x) => x.text)));
    } catch {
      setError(true);
    }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // L'aperçu montre la première question choisie (ou celle saisie).
  const firstPicked = own.trim() || [...picked][0] || '';
  useEffect(() => {
    onPick(firstPicked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstPicked]);

  const toggle = (t: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(t)) n.delete(t);
      else if (n.size < room) n.add(t);
      else toast({ text: `Votre offre suit ${limit} questions. Retirez-en une ou passez à l’offre supérieure.`, href: '/tarifs?depuis=app&fonction=prompts', linkLabel: 'Voir les offres' });
      return n;
    });

  const save = async () => {
    const texts = [...picked];
    if (own.trim()) texts.push(own.trim());
    if (!texts.length) {
      onNext();
      return;
    }
    if (demo) {
      toast({ text: 'Compte démo : vos questions ne sont pas enregistrées.' });
      onNext();
      return;
    }
    setBusy(true);
    let ok = 0;
    let lastErr = '';
    for (const text of texts.slice(0, room || texts.length)) {
      const s = list?.find((x) => x.text === text);
      try {
        const r = await fetch('/api/prompts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessId, text, theme: s?.theme, intent: s?.intent, origin: s ? 'suggestion' : 'client' }),
        });
        if (r.ok) ok++;
        else lastErr = ((await r.json().catch(() => ({}))) as { error?: string }).error ?? '';
      } catch {
        lastErr = 'Pas de réseau.';
      }
    }
    setBusy(false);
    if (ok) toast({ text: `${ok} question${ok > 1 ? 's' : ''} ajoutée${ok > 1 ? 's' : ''} à votre suivi.`, tone: 'success' });
    if (lastErr) toast({ text: lastErr, tone: 'error' });
    if (ok || !lastErr) onNext();
  };

  return (
    <div className="max-w-2xl">
      <h2 ref={headRef} tabIndex={-1} className="rp-display text-[22px] outline-none lg:text-[26px]">
        {STEPS[1].question}
      </h2>
      <p className="mt-2 text-[15px] text-[var(--muted)]">
        Cochez celles qui comptent. Vous en suivez {questions.length} sur {limit} ; tout reste modifiable ensuite.
      </p>
      {error ? (
        <p className="mt-4 text-[14px]">
          Les suggestions n’ont pas pu être chargées.{' '}
          <button type="button" className="rp-link" onClick={() => void load()}>
            Réessayer
          </button>
        </p>
      ) : !list ? (
        <div className="mt-4 flex flex-col gap-2" aria-busy="true" aria-label="Chargement des suggestions">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rp-skel h-12" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="mt-4 text-[14px] text-[var(--muted)]">Pas de nouvelle suggestion : vos questions couvrent déjà l’essentiel. Ajoutez la vôtre ci-dessous si besoin.</p>
      ) : (
        <fieldset className="mt-4">
          <legend className="sr-only">Questions suggérées</legend>
          <ul className="flex flex-col gap-1.5">
            {list.map((s) => (
              <li key={s.text}>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--hair)] px-3 py-2.5 hover:bg-[var(--surface-2)]">
                  <input type="checkbox" className="rp-check mt-0.5" checked={picked.has(s.text)} onChange={() => toggle(s.text)} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium">{s.text}</span>
                    <span className="block text-[12px] text-[var(--muted)]">
                      {s.intentLabel}
                      {s.why ? ` · ${s.why}` : ''} · suggestion
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
      <details className="ob-own mt-4" open={Boolean(own) || undefined}>
        <summary className="rp-link cursor-pointer text-[14px] font-semibold">Ajouter votre propre question</summary>
        <label htmlFor="ob-own" className="sr-only">
          La question que vos clients posent vraiment
        </label>
        <input id="ob-own" className="rp-input mt-2" value={own} onChange={(e) => setOwn(e.target.value)} placeholder={OWN_EXEMPLE[segment]} maxLength={200} />
      </details>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="button" className="rp-btn rp-btn-primary" onClick={() => void save()} disabled={busy}>
          {busy ? 'Ajout…' : picked.size || own.trim() ? `Suivre ${picked.size + (own.trim() ? 1 : 0)} question${picked.size + (own.trim() ? 1 : 0) > 1 ? 's' : ''}` : 'Continuer'}
        </button>
        <button type="button" className="rp-btn rp-btn-ghost" onClick={onBack}>
          Retour
        </button>
      </div>
    </div>
  );
}

function MesureStep({ headRef, businessId, demo, audits, onBack, onDone }: { headRef: HeadRef; businessId: string; demo: boolean; audits: number; onBack: () => void; onDone: () => void }) {
  const [job, setJob] = useState<JobState | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  const launch = async () => {
    setErr('');
    if (demo) {
      setErr('Compte démo : la mesure n’est pas relancée. Créez votre espace pour mesurer votre commerce.');
      return;
    }
    setBusy(true);
    const r = await startMeasure(businessId);
    setBusy(false);
    if ('error' in r) {
      setErr(r.error);
      return;
    }
    setJob({ id: r.jobId, status: 'queued', label: 'En attente' });
    stop.current = pollJob(r.jobId, (s) => {
      setJob(s);
      if (s.status === 'done') onDone();
    });
  };

  const done = job?.status === 'done';
  const dead = job?.status === 'dead';
  return (
    <div className="max-w-xl">
      <h2 ref={headRef} tabIndex={-1} className="rp-display text-[22px] outline-none lg:text-[26px]">
        {audits > 0 && !job ? 'Votre première mesure est faite' : STEPS[2].question}
      </h2>
      <p className="mt-2 text-[15px] text-[var(--muted)]">
        {audits > 0 && !job
          ? 'Le résultat est sur votre Lundi. Relancez une mesure quand vous changez quelque chose.'
          : 'Nous posons vos questions aux IA et lisons chaque réponse. Quelques minutes ; vous pouvez fermer cette page.'}
      </p>
      {job ? (
        <div className="mt-5 rounded-xl border border-[var(--hair)] p-4" role="status" aria-live="polite">
          <div className="flex items-center gap-3">
            <span className={`rp-step-dot ${done ? 'is-done' : 'is-next'}`} aria-hidden="true">
              {done ? <Icon name="check" size={14} /> : dead ? '!' : '…'}
            </span>
            <p className="font-semibold">{done ? 'Mesure terminée' : dead ? 'La mesure a échoué' : job.label ?? 'En cours'}</p>
            {!done && !dead && (
              <span className="ui-live ml-auto">
                <span className="ui-live-bar" />
                Mesure en cours
              </span>
            )}
          </div>
          {!done && !dead && (
            <div className="rp-progress mt-3" aria-hidden="true">
              <span style={{ width: job.status === 'running' ? '60%' : '15%' }} />
            </div>
          )}
          {dead && <p className="mt-2 text-[14px] text-[var(--muted)]">Notre équipe est prévenue. Vous pouvez réessayer demain.</p>}
          {done && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/app" className="rp-btn rp-btn-primary">
                Voir mon Lundi
              </Link>
              <Link href="/app/verite" className="rp-btn">
                Vérifier ma fiche de vérité
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="rp-btn rp-btn-primary" onClick={() => void launch()} disabled={busy}>
            {busy ? 'Lancement…' : audits > 0 ? 'Relancer une mesure' : 'Lancer la mesure'}
          </button>
          {audits > 0 ? (
            <Link href="/app" className="rp-btn">
              Voir mon Lundi
            </Link>
          ) : (
            <button type="button" className="rp-btn rp-btn-ghost" onClick={onBack}>
              Retour
            </button>
          )}
        </div>
      )}
      {err && (
        <p className="mt-3 text-[14px] text-[var(--danger-ink)]" role="alert">
          {err}
          {demo && (
            <>
              {' '}
              <Link href="/inscription" className="font-semibold underline">
                Créer mon espace
              </Link>
            </>
          )}
        </p>
      )}
      <div className="mt-6 border-t border-[var(--hair)] pt-4">
        <p className="text-[14px] font-semibold">Pendant la mesure</p>
        <ul className="mt-2 flex flex-col gap-1.5 text-[14px]">
          <li>
            <Link href="/app/verite" className="rp-link">
              Remplir votre fiche de vérité
            </Link>{' '}
            <span className="text-[var(--muted)]">· 2 min : horaires, prix, zone, pour repérer les erreurs des IA</span>
          </li>
          <li>
            <Link href="/app/trafic" className="rp-link">
              Installer le suivi du trafic
            </Link>{' '}
            <span className="text-[var(--muted)]">· 2 min : une ligne à coller, sans cookie</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
