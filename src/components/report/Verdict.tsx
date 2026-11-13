// Synthèse V4 du rapport : « lisible en 10 secondes » (Server Component, texte complet dans le HTML serveur).
// Ordre : verdict en une phrase · score animé et sa marge · 3 constats · ce que disent les IA · qui est cité à votre
// place · LE bouton suivant (créer l'espace gratuit). Le reste du rapport est dessous, en sections dépliables.
import styles from './report.module.css';
import v4 from './v4.module.css';
import { ScoreGauge } from '@/components/site/ScoreGauge';
import { Counter } from '@/components/motion/Counter';
import { Highlighted } from './Highlighted';
import { PROVIDER_META, bandFor, segmentText, type CompetitorRow, type Showcase } from './derive';
import { shortQuote, type Finding, type MarginView } from './v3';

const ICON: Record<Finding['tone'], React.ReactNode> = {
  bad: <path d="m8 8 8 8m0-8-8 8" />,
  warn: <path d="M12 7v6m0 4h.01" />,
  good: <path d="m7 12.5 3.2 3L17 9" />,
};
const TONE_TXT: Record<Finding['tone'], string> = { bad: 'Problème', warn: 'À surveiller', good: 'Point fort' };

export function VerdictSection({
  name,
  meta,
  verdict,
  margin,
  findings,
  quotes,
  rows,
  answers,
  demo,
  signupHref,
  share,
}: {
  name: string;
  meta: string;
  verdict: string;
  margin: MarginView;
  findings: Finding[];
  quotes: Showcase[];
  rows: CompetitorRow[];
  answers: number;
  demo: boolean;
  signupHref: string;
  share: React.ReactNode;
}) {
  const band = bandFor(margin.score);
  const others = rows.filter((r) => !r.isYou).slice(0, 3);
  const you = rows.find((r) => r.isYou);
  const bars = you ? [...others, you] : others;
  const base = Math.max(answers, ...bars.map((b) => b.mentions), 1);
  return (
    <section id="synthese" className={`${styles.card} ${v4.verdict}`} aria-labelledby="synthese-t">
      <header className={v4.head}>
        <h1 id="synthese-t">Visibilité IA de {name}</h1>
        <p className={v4.meta}>{meta}</p>
        {demo && <span className={`${styles.badge} ${styles.badgeDemo}`}>Données de démonstration</span>}
      </header>

      <p className={v4.sentence} data-tone={margin.score < 40 ? 'bad' : margin.score < 70 ? 'warn' : 'good'}>
        <span className={v4.corners} aria-hidden="true" />
        {verdict}
      </p>

      <div className={v4.top}>
        <div className={v4.score}>
          <ScoreGauge score={margin.score} size={190} range={{ low: margin.low, high: margin.high }} showLabel={false} />
          <p className={v4.band} data-tone={margin.score < 40 ? 'bad' : margin.score < 70 ? 'warn' : 'good'}>{band.label}</p>
          <p className={v4.margin}>
            {margin.margin > 0 ? (
              <>
                Marge <strong className={styles.num}>± {margin.margin}</strong> : entre {margin.low} et {margin.high}
              </>
            ) : (
              'Marge non calculable : peu de réponses'
            )}
          </p>
        </div>

        <ol className={v4.findings} aria-label="Les 3 constats les plus importants">
          {findings.map((f, i) => (
            <li key={i} className={v4.finding} data-tone={f.tone} style={{ ['--k' as string]: i }}>
              <span className={v4.fIcon} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  {ICON[f.tone]}
                </svg>
              </span>
              <span className={styles.srOnly}>{TONE_TXT[f.tone]} : </span>
              <span className={v4.fBody}>
                {f.label && <span className={v4.fLabel}>{f.label}</span>}
                <strong className={f.label ? v4.fTitle : v4.fBig}>
                  {i === 0 && !f.label ? <FirstBig text={f.big} /> : f.big}
                </strong>
                <span className={v4.fText}>{f.text}</span>
              </span>
              <a className={v4.fLink} href={f.href}>
                Détail<span className={styles.srOnly}> : {f.label ?? f.big}</span>
              </a>
            </li>
          ))}
        </ol>
      </div>

      {(quotes.length > 0 || bars.length > 1) && (
        <div className={v4.proof}>
          {quotes.length > 0 && (
            <div className={v4.quotes}>
              <h2 className={v4.h}>Ce que répondent les IA</h2>
              {quotes.map((q, i) => {
                const meta = PROVIDER_META[q.provider];
                const text = shortQuote(q.excerpt.replace(/^…\s*/, ''));
                return (
                  <figure key={i} className={v4.quote} style={{ ['--k' as string]: i }}>
                    <figcaption className={v4.qHead}>
                      <span className={v4.pChip} aria-hidden="true">{meta.short}</span>
                      <span>
                        <strong>{meta.label}</strong>, à « {q.query} »
                      </span>
                    </figcaption>
                    <blockquote className={v4.qText}>
                      <Highlighted segments={segmentText(text, q.competitors, name)} />
                    </blockquote>
                    <p className={v4.qVerdict} data-tone={q.mentioned ? 'good' : 'bad'}>
                      {q.mentioned ? `${name} est cité.` : `${name} n’est pas cité.`}
                      {q.demo ? ' Exemple simulé.' : ''}
                    </p>
                  </figure>
                );
              })}
              <a className={v4.more} href="#perception">Lire les réponses complètes</a>
            </div>
          )}

          {bars.length > 1 && (
            <div className={v4.rivals} data-reveal="">
              <h2 className={v4.h}>Qui est cité à votre place</h2>
              <p className={v4.rivalsSub}>Nombre de réponses, sur {answers}, qui citent chaque acteur.</p>
              <ul className={v4.bars}>
                {bars.map((b, i) => {
                  const w = Math.max(2, Math.round((b.mentions / base) * 100));
                  return (
                    <li key={b.name} className={b.isYou ? v4.barYou : v4.bar} style={{ ['--k' as string]: i }}>
                      <span className={v4.barName}>
                        {b.isYou ? <>Vous <small>({b.name})</small></> : b.name}
                      </span>
                      <span className={v4.barTrack} aria-hidden="true">
                        <span className={v4.barFill} style={{ width: `${w}%` }} />
                      </span>
                      <span className={`${v4.barNum} ${styles.num}`}>
                        <Counter value={b.mentions} />
                      </span>
                    </li>
                  );
                })}
              </ul>
              <a className={v4.more} href="#pourquoi">Pourquoi ils passent devant</a>
            </div>
          )}
        </div>
      )}

      <div className={v4.next}>
        <div className={v4.nextText}>
          <strong>Suivez ce score chaque mois, gratuitement</strong>
          <span>Votre espace garde ce rapport, mesure l’évolution et vous dit quoi faire ensuite. Sans carte bancaire.</span>
        </div>
        <a className={`${styles.btn} ${styles.btnPrimary} ${v4.nextBtn}`} href={signupHref}>
          Créer mon espace gratuit
        </a>
        {share && <div className={v4.nextShare}>{share}</div>}
      </div>
    </section>
  );
}

/** « 1 sur 46 » : le premier nombre monte jusqu'à sa valeur (compteur), le reste est fixe. */
function FirstBig({ text }: { text: string }) {
  const m = /^(\d+)(.*)$/.exec(text);
  if (!m) return <>{text}</>;
  return (
    <>
      <Counter value={Number(m[1])} />
      {m[2]}
    </>
  );
}
