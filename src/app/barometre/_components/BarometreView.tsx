/**
 * Rendu des baromètres (sans en-tête ni pied de page : testable seul). Données = éditions RÉELLES ; une édition
 * simulée n'arrive ici qu'en aperçu local et porte alors un bandeau « Démonstration ».
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PROVIDER_LABELS } from '@/lib/engine/types';
import { CATEGORY_LABEL } from '@/lib/engine/sources/classify';
import type { BarometreEdition, CompanyStat, EditionSummary } from '@/lib/barometre/types';
import { BOOTSTRAP_B, MIN_COMPLETION } from '@/lib/barometre/aggregate';
import { MIN_RANKED, MIN_VALID_ANSWERS } from '@/lib/barometre/storage';
import { barometrePath, csvPath, pct, periodLabel, providerList } from '@/lib/barometre/public';
import { CATALOG } from '@/lib/barometre/catalog';

const muted = { color: 'var(--muted)' } as const;
const line = { borderColor: 'var(--line)' } as const;
const h2 = 'mt-12 mb-4 font-semibold text-2xl';

export const DISCLAIMER = 'Ce classement reflète les réponses des IA, pas la qualité des entreprises.';
export const RETRAIT_TITLE = 'Demande de retrait ou de rectification';

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const range = (lo: number, hi: number) => `${pct(lo)} à ${pct(hi)}`;

function Box({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'warn' | 'primary' }) {
  const bg = tone === 'warn' ? 'var(--warning-bg)' : tone === 'primary' ? 'var(--primary-bg)' : '#fff';
  return (
    <div className="my-4 rounded-xl border p-5" style={{ ...line, background: bg }}>
      {children}
    </div>
  );
}

export function DemoBanner() {
  return (
    <div role="alert" className="mb-6 rounded-xl border-2 p-4 font-semibold" style={{ borderColor: 'var(--warning)', background: 'var(--warning-bg)', color: 'var(--warning-ink)' }}>
      Démonstration : réponses simulées, noms fictifs. Cette page n&apos;est visible qu&apos;en développement local et n&apos;est jamais publiée.
    </div>
  );
}

/** Barre : taux de citation (plein) et intervalle à 90 % (bande claire). */
function RateBar({ r, max }: { r: CompanyStat; max: number }) {
  const w = (x: number) => `${Math.max(0, Math.min(100, (x / max) * 100))}%`;
  return (
    <div className="relative mt-1 h-2 w-full rounded" style={{ background: 'var(--bg)' }} aria-hidden>
      <div className="absolute h-2 rounded" style={{ left: w(r.rateLow), width: `calc(${w(r.rateHigh)} - ${w(r.rateLow)})`, background: 'var(--primary-bg)' }} />
      <div className="absolute h-2 rounded" style={{ left: 0, width: w(r.rate), background: 'var(--primary)', opacity: 0.85 }} />
    </div>
  );
}

function Change({ r }: { r: CompanyStat }) {
  if (!r.change) return <span style={muted}>—</span>;
  if (r.change.kind === 'new') return <span>Nouveau</span>;
  const d = r.change.deltaPts;
  const s = `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d).toFixed(1).replace('.', ',')} pt`;
  return <span title={r.change.significant ? 'Écart supérieur à la marge d’erreur' : 'Écart dans la marge d’erreur'}>{s}{r.change.significant ? '' : ' (non significatif)'}</span>;
}

export function MethodSummary() {
  return (
    <ul className="list-disc space-y-2 pl-5">
      <li>Chaque mois, nous posons les mêmes questions de clients (8 à 20 par baromètre, par exemple « Quel est le meilleur plombier à Lyon ? ») à plusieurs IA : ChatGPT, Perplexity, Gemini et Claude, plusieurs fois chacune, car leurs réponses varient.</li>
      <li>Nous relevons les entreprises citées, fusionnons les variantes d&apos;un même nom et ne publions un nom que s&apos;il est cité par au moins deux IA, ou dans au moins deux réponses avec son site. Les noms de personnes ne sont jamais publiés.</li>
      <li>Chaque pourcentage est donné avec sa marge d&apos;erreur (intervalle à 90 %, {BOOTSTRAP_B} rééchantillonnages des questions).</li>
      <li>Un baromètre n&apos;est publié qu&apos;une fois réellement mesuré : au moins {MIN_VALID_ANSWERS} réponses valides, {Math.round(MIN_COMPLETION * 100)} % des réponses prévues et {MIN_RANKED} entreprises vérifiées. Aucune donnée n&apos;est estimée ni inventée.</li>
      <li>{DISCLAIMER} Nous ne vendons aucune place dans ces classements.</li>
    </ul>
  );
}

function shareLinks(url: string, title: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  return [
    { label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { label: 'X', href: `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
    { label: 'E-mail', href: `mailto:?subject=${t}&body=${u}` },
  ];
}

export interface BarometreViewProps {
  edition: BarometreEdition;
  demo: boolean;
  history: { period: string; measuredTo: string }[];
  /** URL absolue de la page (partage) */
  url: string;
  contactEmail: string;
}

export function BarometreView({ edition: e, demo, history, url, contactEmail }: BarometreViewProps) {
  const title = `Qui les IA recommandent : ${e.def.title}`;
  const max = Math.max(0.05, ...e.ranking.map((r) => r.rateHigh));
  const mail = `mailto:${contactEmail}?subject=${encodeURIComponent(`Baromètre ${e.slug} : ${RETRAIT_TITLE.toLowerCase()}`)}`;
  return (
    <article>
      {demo && <DemoBanner />}
      <h1 className="font-semibold text-3xl sm:text-4xl leading-tight tracking-tight" style={{ fontFamily: 'var(--font-display, "Bricolage Grotesque", sans-serif)' }}>
        {title}
      </h1>
      <p className="mt-3 text-lg" style={muted}>
        Mesure de {periodLabel(e.period)} : {e.answersValid} réponses de {providerList(e)} à {e.questions.length} questions, posées {e.runs} fois
        chacune, du {fmtDay(e.measuredFrom)} au {fmtDay(e.measuredTo)}.
      </p>
      <Box tone="warn">
        <p className="font-semibold">{DISCLAIMER}</p>
        <p className="mt-1 text-sm" style={muted}>
          Être cité par une IA ne dit rien de la qualité du travail, des prix ou du sérieux d&apos;une entreprise. Les IA se trompent et changent
          d&apos;avis d&apos;un mois à l&apos;autre.
        </p>
      </Box>

      <h2 id="classement" className={h2}>Les entreprises les plus citées</h2>
      <p className="mb-2 text-sm" style={muted}>
        Taux de citation : part des réponses qui citent l&apos;entreprise. Part de voix : part de toutes les citations d&apos;entreprises. Entre
        parenthèses, la marge d&apos;erreur (intervalle à 90 %). « ≈ » : écart non significatif avec la ligne au-dessus.
      </p>
      <div className="my-4 overflow-x-auto rounded-xl border" style={{ ...line, background: '#fff' }}>
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <caption className="sr-only">Classement des entreprises citées par les IA, {periodLabel(e.period)}</caption>
          <thead>
            <tr>
              {['Rang', 'Entreprise', 'Taux de citation', 'Part de voix', 'Par IA', 'Évolution'].map((h) => (
                <th key={h} scope="col" className="border-b p-3 font-semibold" style={line}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {e.ranking.map((r) => (
              <tr key={r.id}>
                <td className="border-b p-3 align-top" style={line}>{r.tiedWithPrevious ? `≈ ${r.rank}` : r.rank}</td>
                <th scope="row" className="border-b p-3 align-top font-semibold" style={line}>
                  {r.name}
                  {r.domain && (
                    <span className="block text-xs font-normal" style={muted}>
                      {demo ? r.domain : <a href={`https://${r.domain}`} rel="nofollow noopener" target="_blank" className="underline">{r.domain}</a>}
                    </span>
                  )}
                </th>
                <td className="border-b p-3 align-top" style={line}>
                  {pct(r.rate)} <span style={muted}>({range(r.rateLow, r.rateHigh)})</span>
                  <RateBar r={r} max={max} />
                </td>
                <td className="border-b p-3 align-top" style={line}>
                  {pct(r.sov)} <span style={muted}>({range(r.sovLow, r.sovHigh)})</span>
                </td>
                <td className="border-b p-3 align-top text-xs" style={line}>
                  {e.providers.map((p) => (
                    <span key={p} className="block">{PROVIDER_LABELS[p]} : {r.byProvider[p]?.cited ?? 0}/{r.byProvider[p]?.answers ?? 0}</span>
                  ))}
                </td>
                <td className="border-b p-3 align-top" style={line}><Change r={r} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm" style={muted}>
        {e.unverifiedCount > 0 && <>{e.unverifiedCount} autre(s) nom(s) cité(s) n&apos;ont pas été publiés faute de vérification (une seule IA, sans site). </>}
        {e.withdrawnCount > 0 && <>{e.withdrawnCount} entreprise(s) retirée(s) à leur demande. </>}
        {e.answersWithRecommendation} réponses sur {e.answersValid} recommandent au moins une entreprise.
      </p>

      {e.evolution && (
        <>
          <h2 id="evolution" className={h2}>Ce qui a changé depuis {periodLabel(e.evolution.previousPeriod)}</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Nouvelles entreprises citées : {e.evolution.entered.length ? e.evolution.entered.join(', ') : 'aucune'}.</li>
            <li>Ne figurent plus au classement : {e.evolution.exited.length ? e.evolution.exited.join(', ') : 'aucune'}.</li>
            <li>Les écarts inférieurs à la marge d&apos;erreur sont signalés « non significatif » : ce sont des variations normales des IA.</li>
          </ul>
        </>
      )}

      <h2 id="sources" className={h2}>Les sources que les IA citent le plus</h2>
      {e.sources.length ? (
        <>
          <p className="mb-2 text-sm" style={muted}>
            Sur {e.answersWithSources} réponses avec sources (Gemini exclu : ses liens ne désignent pas la page d&apos;origine).
          </p>
          <div className="my-4 overflow-x-auto rounded-xl border" style={{ ...line, background: '#fff' }}>
            <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
              <thead>
                <tr>
                  {['Site', 'Type', 'Réponses qui le citent', 'IA'].map((h) => (
                    <th key={h} scope="col" className="border-b p-3 font-semibold" style={line}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {e.sources.slice(0, 15).map((s) => (
                  <tr key={s.domain}>
                    <th scope="row" className="border-b p-3 align-top font-semibold" style={line}>{s.domain}</th>
                    <td className="border-b p-3 align-top" style={line}>{CATEGORY_LABEL[s.category] ?? s.category}</td>
                    <td className="border-b p-3 align-top" style={line}>{s.answers} ({pct(s.answerShare)})</td>
                    <td className="border-b p-3 align-top" style={line}>{s.providers.map((p) => PROVIDER_LABELS[p]).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p style={muted}>Aucune source exploitable dans les réponses de ce mois.</p>
      )}

      <h2 id="methode" className={h2}>Méthode</h2>
      <MethodSummary />
      <details className="mt-4 rounded-xl border p-4" style={line}>
        <summary className="cursor-pointer font-semibold">Les {e.questions.length} questions posées</summary>
        <ol className="mt-3 list-decimal space-y-1 pl-5">
          {e.questions.map((q) => <li key={q.id}>{q.text}</li>)}
        </ol>
      </details>
      <p className="mt-3 text-sm" style={muted}>
        IA et modèles : {e.providers.map((p) => `${PROVIDER_LABELS[p]} (${e.models[p] ?? 'modèle non relevé'})`).join(', ')}. {e.answersPlanned} réponses
        prévues, {e.answersValid} valides, {e.answersError} en erreur. Méthode {e.methodVersion}, calcul du {fmtDay(e.aggregatedAt)} (version {e.version}).{' '}
        <Link href="/methode" className="underline">Méthode de mesure Repéré</Link>.
      </p>

      <h2 id="donnees" className={h2}>Données et partage</h2>
      <p>
        <a href={csvPath(e.slug, demo ? undefined : e.period)} className="font-semibold underline" download>Télécharger les données (CSV)</a>
        <span style={muted}> : une ligne par entreprise publiée, avec marges d&apos;erreur et détail par IA.</span>
      </p>
      {history.length > 1 && (
        <p className="mt-2 text-sm">
          Mois précédents :{' '}
          {history.slice(1).map((h, i) => (
            <span key={h.period}>{i > 0 && ', '}<a href={csvPath(e.slug, h.period)} className="underline">{periodLabel(h.period)}</a></span>
          ))}
        </p>
      )}
      <p className="mt-3 flex flex-wrap gap-3 text-sm">
        Partager :
        {shareLinks(url, title).map((s) => (
          <a key={s.label} href={s.href} rel="noopener nofollow" target="_blank" className="underline">{s.label}</a>
        ))}
      </p>

      <div className="mt-12 rounded-2xl p-6 sm:p-8" style={{ background: 'var(--primary-bg)' }}>
        <p className="mb-3 text-lg font-semibold">Et votre entreprise, que répondent les IA à son sujet ?</p>
        <Link href="/audit" className="inline-flex items-center justify-center rounded-lg px-5 py-3 font-semibold text-white" style={{ background: 'var(--primary)' }}>
          Testez votre entreprise gratuitement
        </Link>
        <p className="mt-3 text-sm" style={muted}>Une mesure datée, avec sa marge d&apos;erreur. Aucune promesse de position.</p>
      </div>

      <h2 id="retrait" className={h2}>{RETRAIT_TITLE}</h2>
      <p>
        Les noms publiés sont ceux écrits par les IA dans leurs réponses, et les sites ceux qu&apos;elles citent publiquement. Vous représentez une
        entreprise citée et souhaitez son retrait, ou la correction d&apos;un nom ou d&apos;un site ? Écrivez-nous à{' '}
        <a href={mail} className="underline">{contactEmail}</a> ou via la <Link href="/contact?sujet=question" className="underline">page contact</Link>{' '}
        en indiquant le baromètre ({e.slug}). Nous traitons la demande sous 30 jours ; le retrait s&apos;applique immédiatement aux pages et aux
        téléchargements, et aux mois suivants.
      </p>
    </article>
  );
}

const SEGMENT_TITLE: Record<string, string> = { local: 'Commerces et artisans', pme: 'PME et services B2B', ecommerce: 'E-commerce' };

export function BarometreIndexView({ items }: { items: EditionSummary[] }) {
  return (
    <div>
      <h1 className="font-semibold text-3xl sm:text-4xl leading-tight tracking-tight" style={{ fontFamily: 'var(--font-display, "Bricolage Grotesque", sans-serif)' }}>
        Baromètres : qui les IA recommandent
      </h1>
      <p className="mt-3 text-lg" style={muted}>
        Chaque mois, les entreprises que ChatGPT, Perplexity, Gemini et Claude citent quand on leur demande un artisan, un logiciel ou une marque.
        Des mesures réelles, avec leur marge d&apos;erreur.
      </p>
      {items.length === 0 ? (
        <>
          <Box tone="primary">
            <p className="font-semibold">Premiers baromètres en préparation.</p>
            <p className="mt-1" style={muted}>
              Aucun baromètre n&apos;est encore publié : nous ne publions qu&apos;après une mesure réelle complète. Voici la méthode que nous appliquerons.
            </p>
          </Box>
          <h2 className={h2}>Méthode</h2>
          <MethodSummary />
          <h2 className={h2}>Sujets prévus</h2>
          <p className="mb-2 text-sm" style={muted}>Publiés seulement une fois mesurés.</p>
          {(['local', 'pme', 'ecommerce'] as const).map((s) => (
            <p key={s} className="mt-2">
              <span className="font-semibold">{SEGMENT_TITLE[s]} : </span>
              {CATALOG.filter((d) => d.segment === s).slice(0, 8).map((d) => d.title).join(', ')}
              {CATALOG.filter((d) => d.segment === s).length > 8 ? '…' : '.'}
            </p>
          ))}
        </>
      ) : (
        <>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {items.map((it) => (
              <li key={it.slug} className="rounded-xl border p-5" style={{ ...line, background: '#fff' }}>
                <p className="text-xs uppercase tracking-wide" style={muted}>{SEGMENT_TITLE[it.segment]} · {periodLabel(it.period)}</p>
                <Link href={barometrePath(it.slug)} className="mt-1 block text-lg font-semibold underline-offset-2 hover:underline">
                  {it.title}
                </Link>
                <ol className="mt-2 list-decimal pl-5 text-sm">
                  {it.top.map((t) => <li key={t.name}>{t.name} ({pct(t.rate)} des réponses)</li>)}
                </ol>
                <p className="mt-2 text-xs" style={muted}>{it.answersValid} réponses analysées.</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm" style={muted}>{DISCLAIMER}</p>
          <h2 className={h2}>Méthode</h2>
          <MethodSummary />
        </>
      )}
    </div>
  );
}
