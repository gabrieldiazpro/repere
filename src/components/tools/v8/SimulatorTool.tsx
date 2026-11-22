'use client';
/**
 * Simulateur « Ce que la visibilité IA représente pour ma boutique » : saisie des chiffres du marchand, fourchette
 * basse / médiane / haute, avant / après étiqueté « simulation », hypothèses sourcées et modifiables. Calcul dans le
 * navigateur (./simulateur.ts), rien n'est envoyé.
 */
import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import { buttonClasses } from '@/components/ui/Button';
import { AuditBridge, ExampleNote, Scope } from '../ui';
import {
  EXAMPLE_INPUT,
  HYPOTHESES,
  SCENARIOS,
  SCENARIO_LABEL,
  SIM_PLATFORMS,
  defaultHypValues,
  euros,
  parseNumber,
  simulate,
  type HypId,
  type HypValues,
  type Scenario,
  type SimInput,
  type SimPlatform,
} from './simulateur';

const link = 'font-semibold text-primary underline underline-offset-2 hover:no-underline';
const display = { fontFamily: 'var(--font-display)' } as const;
/** « Scénario bas / médian / haut » (accord avec « scénario »). */
const SC_NAME: Record<Scenario, string> = { basse: 'bas', mediane: 'médian', haute: 'haut' };

type Form = { visits: string; conversion: string; basket: string; googleShare: string; aiShareNow: string; platform: SimPlatform };
const EMPTY: Form = { visits: '', conversion: '', basket: '', googleShare: '', aiShareNow: '', platform: 'shopify' };
const fr = (n: number) => String(n).replace('.', ',');
const toForm = (i: SimInput): Form => ({ visits: fr(i.visits), conversion: fr(i.conversion), basket: fr(i.basket), googleShare: fr(i.googleShare), aiShareNow: i.aiShareNow === null ? '' : fr(i.aiShareNow), platform: i.platform });
const fmtDate = (iso: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));

function NumField({ id, label, value, onChange, suffix, hint, error, optional = false }: { id: string; label: string; value: string; onChange: (v: string) => void; suffix: string; hint?: string; error?: string; optional?: boolean }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-ink">
        {label}
        {optional && <span className="font-normal text-muted"> (facultatif)</span>}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          inputMode="decimal"
          className="rt-field min-w-0 flex-1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-h`}
          autoComplete="off"
          maxLength={14}
        />
        <span className="w-14 shrink-0 text-sm text-muted">{suffix}</span>
      </div>
      <p id={`${id}-h`} className={`mt-1 text-xs ${error ? 'font-semibold text-danger-ink' : 'text-muted'}`}>
        {error ?? hint}
      </p>
    </div>
  );
}

/** Barre horizontale de l'avant / après (médiane), avec la fourchette basse–haute en trait fin. */
function BeforeAfter({ r, max }: { r: ReturnType<typeof simulate>; max: number }) {
  const rows = [
    { key: 'avant' as const, title: 'Avant', sub: 'Les aperçus IA de Google ne citent pas votre boutique, les assistants ne la recommandent pas', tone: 'bg-muted/50' },
    { key: 'apres' as const, title: 'Après', sub: 'Votre boutique est citée par les aperçus IA et recommandée par les assistants', tone: 'bg-primary' },
  ];
  const w = (x: number) => `${Math.max(2, Math.min(100, (x / max) * 100))}%`;
  return (
    <figure className="rounded-2xl border border-line bg-white p-4 sm:p-6" aria-label="Avant et après, simulation">
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-base font-semibold text-ink">Ventes mensuelles venues de Google et des IA</span>
        <span className="rounded-full bg-warning-bg px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-warning-ink">Simulation</span>
      </figcaption>
      <div className="mt-5 space-y-6">
        {rows.map((row) => {
          const lo = Math.min(...SCENARIOS.map((s) => r.scenarios[s][row.key]));
          const hi = Math.max(...SCENARIOS.map((s) => r.scenarios[s][row.key]));
          const med = r.scenarios.mediane[row.key];
          return (
            <div key={row.key} data-row={row.key}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <p className="font-semibold text-ink">
                  {row.title} <span className="text-sm font-normal text-muted">· {row.sub}</span>
                </p>
                <p className="text-2xl font-semibold tabular-nums text-ink" style={display}>
                  {euros(med)}
                  <span className="text-sm font-normal text-muted"> / mois</span>
                </p>
              </div>
              <div className="relative mt-2 h-4 overflow-hidden rounded-full bg-canvas ring-1 ring-line" aria-hidden>
                <div className={`absolute inset-y-0 left-0 rounded-full ${row.tone}`} style={{ width: w(med) }} />
                <div className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-ink/60" style={{ left: w(lo), width: `calc(${w(hi)} - ${w(lo)})` }} />
              </div>
              <p className="mt-1 text-xs text-muted">
                Fourchette : {euros(lo)} à {euros(hi)} par mois (scénarios bas et haut).
                {row.key === 'apres' && (
                  <span className="mt-1.5 block w-fit rounded-full bg-success-bg px-2.5 py-0.5 text-sm font-semibold text-success-ink">
                    {r.scenarios.mediane.gain >= 0 ? '+' : '−'}
                    {euros(Math.abs(r.scenarios.mediane.gain))} / mois par rapport à « avant » (médiane)
                  </span>
                )}
              </p>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

function Hypotheses({ hv, setHv }: { hv: HypValues; setHv: (h: HypValues) => void }) {
  const id = useId();
  const changed = JSON.stringify(hv) !== JSON.stringify(defaultHypValues());
  const set = (h: HypId, s: Scenario, raw: string) => {
    const n = parseNumber(raw);
    setHv({ ...hv, [h]: { ...hv[h], [s]: n === null ? 0 : n } });
  };
  return (
    <section className="mt-8" aria-labelledby={`${id}-t`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`${id}-t`} className="text-xl font-semibold text-ink" style={display}>
          Les hypothèses, une par une
        </h2>
        {changed && (
          <button type="button" className={link} onClick={() => setHv(defaultHypValues())}>
            Revenir aux valeurs des études
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">Toutes modifiables, en pourcentage. Chaque valeur indique sa source ; cliquez sur « Sources » pour la date et le détail.</p>
      <ol className="mt-4 space-y-4">
        {HYPOTHESES.map((h, i) => (
          <li key={h.id} className="rounded-xl border border-line bg-white p-4" data-hyp={h.id}>
            <p className="font-semibold text-ink">
              {i + 1}. {h.label}
            </p>
            <p className="text-sm text-muted">{h.help}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {SCENARIOS.map((s) => (
                <div key={s} className="min-w-0">
                  <label htmlFor={`${id}-${h.id}-${s}`} className="block text-xs font-semibold uppercase tracking-wide text-muted">
                    Scénario {SC_NAME[s]}
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      id={`${id}-${h.id}-${s}`}
                      inputMode="decimal"
                      className="rt-field min-w-0 flex-1"
                      defaultValue={fr(hv[h.id][s])}
                      key={`${h.id}-${s}-${changed ? 'm' : 'd'}`}
                      onChange={(e) => set(h.id, s, e.target.value)}
                      aria-describedby={`${id}-${h.id}-${s}-o`}
                      maxLength={8}
                    />
                    <span className="text-sm text-muted">%</span>
                  </div>
                  <p id={`${id}-${h.id}-${s}-o`} className="mt-1 text-xs text-muted">
                    {h.origin[s]}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-sm">
              <strong className="font-semibold text-ink">Ce que les études ne disent pas : </strong>
              {h.gap}
            </p>
            <details className="rt-details mt-2">
              <summary className="cursor-pointer text-sm font-semibold text-primary">Sources ({h.sources.length})</summary>
              <ul className="mt-2 space-y-2 text-sm">
                {h.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} rel="noopener" className={link}>
                      {s.label}
                    </a>
                    <span className="block text-muted">
                      Publié le {fmtDate(s.date)}. {s.fact}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function SimulatorTool() {
  const id = useId();
  const [f, setF] = useState<Form>(EMPTY);
  const [hv, setHv] = useState<HypValues>(defaultHypValues);
  const [isExample, setIsExample] = useState(false);
  const input: SimInput = {
    visits: parseNumber(f.visits) ?? NaN,
    conversion: parseNumber(f.conversion) ?? NaN,
    basket: parseNumber(f.basket) ?? NaN,
    googleShare: parseNumber(f.googleShare) ?? NaN,
    aiShareNow: parseNumber(f.aiShareNow),
    platform: f.platform,
  };
  const r = useMemo(() => simulate(input, hv), [f, hv]); // eslint-disable-line react-hooks/exhaustive-deps
  const started = Boolean(f.visits || f.conversion || f.basket || f.googleShare);
  const show = (k: keyof Form) => (started && f[k] !== '' ? r.errors[k as keyof SimInput] : undefined);
  const set = (k: keyof Form) => (v: string) => (setF((o) => ({ ...o, [k]: v })), setIsExample(false));
  const plat = SIM_PLATFORMS.find((p) => p.id === f.platform)!;
  const max = r.ok ? Math.max(...SCENARIOS.flatMap((s) => [r.scenarios[s].avant, r.scenarios[s].apres]), 1) : 1;
  const gainsSorted = r.ok ? [...SCENARIOS].map((s) => ({ s, ...r.scenarios[s] })) : [];

  return (
    <>
      <Scope>
        <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(e) => e.preventDefault()} aria-label="Vos chiffres">
          <NumField id={`${id}-v`} label="Visites par mois" value={f.visits} onChange={set('visits')} suffix="visites" hint="Sessions sur votre boutique (Google Analytics, tableau de bord)." error={show('visits')} />
          <NumField id={`${id}-c`} label="Taux de conversion" value={f.conversion} onChange={set('conversion')} suffix="%" hint="Commandes ÷ visites. Souvent entre 1 et 3 %." error={show('conversion')} />
          <NumField id={`${id}-b`} label="Panier moyen" value={f.basket} onChange={set('basket')} suffix="€ TTC" hint="Montant moyen d’une commande." error={show('basket')} />
          <NumField id={`${id}-g`} label="Part du trafic venu de Google" value={f.googleShare} onChange={set('googleShare')} suffix="%" hint="Recherche naturelle, hors annonces payantes." error={show('googleShare')} />
          <NumField id={`${id}-a`} label="Part venue des IA aujourd’hui" value={f.aiShareNow} onChange={set('aiShareNow')} suffix="%" optional hint="chatgpt.com, perplexity.ai… dans Analytics. Vide = 0." error={show('aiShareNow')} />
          <div className="min-w-0">
            <label htmlFor={`${id}-p`} className="mb-1 block text-sm font-semibold text-ink">
              Plateforme de la boutique
            </label>
            <select id={`${id}-p`} className="rt-field w-full" value={f.platform} onChange={(e) => set('platform')(e.target.value)}>
              {SIM_PLATFORMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </form>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <button type="button" className={link} onClick={() => (setF(toForm(EXAMPLE_INPUT)), setIsExample(true))}>
            Essayer avec un exemple
          </button>
          <span>Calculé dans votre navigateur : rien n’est envoyé.</span>
        </p>

        {r.ok && (
          <div className="mt-6 rt-fade" aria-live="polite" data-testid="sim-result">
            {isExample && <ExampleNote what="boutique imaginaire de 20 000 visites par mois, 1,5 % de conversion, 65 € de panier, 40 % du trafic venu de Google." />}
            <p className="mb-3 rounded-lg border border-warning/40 bg-warning-bg px-3 py-2 text-sm font-semibold text-warning-ink" role="note">
              Estimation, pas une promesse : calculée à partir de vos chiffres et d’études publiques, surtout américaines.
            </p>
            {r.verdict && (
              <div className="mb-5 rounded-xl bg-primary-bg p-4 text-ink" role="note" data-tone={r.verdict.tone}>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Résultat de la simulation</p>
                <p className="mt-1 text-lg font-semibold leading-snug" style={display}>
                  {r.verdict.title.replace(/^Simulation : ./, (m) => m.slice(-1).toUpperCase())}
                </p>
                <p className="mt-1 text-[0.95rem] text-muted">{r.verdict.text}</p>
              </div>
            )}
            <BeforeAfter r={r} max={max} />

            <ul className="mt-5 grid gap-3 sm:grid-cols-3" aria-label="Gain mensuel par scénario">
              {gainsSorted.map((g) => (
                <li key={g.s} className={`rounded-xl border p-4 ${g.s === 'mediane' ? 'border-primary bg-primary-bg' : 'border-line bg-white'}`}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Scénario {SC_NAME[g.s]}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-ink" style={display}>
                    {g.gain >= 0 ? '+' : '−'}
                    {euros(Math.abs(g.gain))}
                    <span className="text-sm font-normal text-muted"> / mois</span>
                  </p>
                  <p className="text-sm text-muted">soit {euros(g.gain * 12)} sur un an, à trafic constant</p>
                </li>
              ))}
            </ul>

            <div className="mt-5 overflow-x-auto rounded-xl border border-line bg-white">
              <table className="w-full min-w-[30rem] text-sm">
                <caption className="sr-only">Détail de la simulation par scénario</caption>
                <thead>
                  <tr className="border-b border-line text-left text-muted">
                    <th scope="col" className="px-3 py-2 font-semibold">Par mois</th>
                    {SCENARIOS.map((s) => (
                      <th key={s} scope="col" className="px-3 py-2 text-right font-semibold">
                        {SCENARIO_LABEL[s]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line tabular-nums">
                  {[
                    { label: 'Ventes Google exposées aux aperçus IA (non cité)', v: (s: Scenario) => euros(r.scenarios[s].exposed) },
                    { label: 'Ventes Google, avant → après', v: (s: Scenario) => `${euros(r.scenarios[s].googleAvant)} → ${euros(r.scenarios[s].googleApres)}` },
                    { label: 'Ventes venues des assistants IA, avant → après', v: (s: Scenario) => `${euros(r.scenarios[s].aiAvant)} → ${euros(r.scenarios[s].aiApres)}` },
                    { label: 'Visites venues des assistants IA (après)', v: (s: Scenario) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(r.scenarios[s].aiVisits) },
                  ].map((row) => (
                    <tr key={row.label}>
                      <th scope="row" className="px-3 py-2 text-left font-normal text-ink">
                        {row.label}
                      </th>
                      {SCENARIOS.map((s) => (
                        <td key={s} className="px-3 py-2 text-right">
                          {row.v(s)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted">Vos ventes actuelles : {euros(r.revenue)} par mois, dont {euros(r.googleRevenue)} venues de Google (référence de la simulation).</p>
            {r.notes.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
                {r.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}

            <aside className="mt-6 rounded-2xl border border-line bg-white p-4 sm:p-5" aria-label="Passer de la simulation à la mesure">
              <p className="text-lg font-semibold text-ink" style={display}>
                Passez de la simulation à la mesure
              </p>
              <p className="mt-1 text-[0.95rem] text-muted">
                L’analyse gratuite vérifie si les IA citent déjà votre boutique et ce qui les en empêche.{' '}
                {plat.agent
                  ? `Avec l’offre e-commerce, l’agent Repéré se connecte à ${plat.agent} et prépare les corrections (titres, descriptions, textes d’images) : rien n’est publié sans votre accord, tout est réversible.`
                  : 'Avec l’offre e-commerce, l’agent Repéré prépare les corrections sous forme de fichiers et d’instructions à appliquer : rien n’est publié sans votre accord.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/analyse" className={buttonClasses({ variant: 'primary' })}>
                  Analyser ma boutique
                </Link>
                <Link href="/e-commerce" className={buttonClasses({ variant: 'secondary' })}>
                  Voir l’offre e-commerce
                </Link>
              </div>
            </aside>
          </div>
        )}

        <Hypotheses hv={hv} setHv={setHv} />
      </Scope>
      <AuditBridge done={r.ok} url={null} to="analyse" text="La simulation part d’études publiques. L’analyse regarde votre vraie boutique : ce que Google et les IA lisent de vos pages produit." />
    </>
  );
}
