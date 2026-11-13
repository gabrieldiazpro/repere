// Sections V3 du rapport (Server Components) : synthèse en 5 secondes, URL citées, matrice thème × IA, partage.
import styles from './report.module.css';
import v3 from './v3.module.css';
import { ScoreGauge } from '@/components/site/ScoreGauge';
import { Counter } from '@/components/motion/Counter';
import { PROVIDER_META, bandFor } from './derive';
import { Section } from './V2Sections';
import { shortUrl, safeHref, type CitedUrl, type Summary, type VoiceView } from './v3';

/* ---------- Synthèse ---------- */

export function SummarySection({
  name,
  meta,
  summary,
  shock,
  demo,
  signupHref,
  share,
}: {
  name: string;
  meta: string;
  summary: Summary;
  shock: string;
  demo: boolean;
  signupHref: string;
  share: React.ReactNode;
}) {
  const { margin, rank, of, rankLabel, cited, answers, action } = summary;
  const band = bandFor(margin.score);
  const mentionPct = answers ? Math.round((cited / answers) * 100) : 0;
  return (
    <section id="synthese" className={`${styles.card} ${v3.summary}`} aria-labelledby="synthese-t">
      <header className={v3.sumHead}>
        <h1 id="synthese-t">Visibilité IA de {name}</h1>
        <p className={v3.sumMeta}>{meta}</p>
        {demo && <span className={`${styles.badge} ${styles.badgeDemo}`}>Données de démonstration</span>}
      </header>

      <div className={v3.sumGrid}>
        <div className={v3.sumScore}>
          <ScoreGauge score={margin.score} size={200} range={{ low: margin.low, high: margin.high }} showLabel={false} />
          <p className={v3.sumMargin}>
            <strong className={styles.num}>{margin.short}</strong>
            <span>{band.label}</span>
          </p>
          <p className={v3.sumMarginHelp}>{margin.long}</p>
        </div>

        <div className={v3.sumFacts}>
          <p className={v3.sumShock}>{shock}</p>
          <dl className={v3.sumKpis}>
            {of > 1 && (
              <div>
                <dt>Votre rang</dt>
                <dd>
                  <span className={styles.num}>{rank}</span>
                  <small>{rank === 1 ? 'ᵉʳ' : 'ᵉ'} sur {of}</small>
                </dd>
                <span className={v3.kpiSub}>{rankLabel}</span>
              </div>
            )}
            <div>
              <dt>Réponses qui vous citent</dt>
              <dd>
                <Counter value={mentionPct} suffix=" %" />
              </dd>
              <span className={v3.kpiSub}>
                {cited} sur {answers}
                {summary.margin.mention && summary.margin.mention.margin > 0 ? `, ± ${summary.margin.mention.margin} points` : ''}
              </span>
            </div>
          </dl>
          <div className={v3.sumAction}>
            <span className={v3.sumActionLabel}>À faire en premier</span>
            <strong>{action.title}</strong>
            <p>{action.why}</p>
            <a className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`} href={action.href}>
              Voir le détail
            </a>
          </div>
        </div>
      </div>

      <div className={v3.sumCtas}>
        <a className={`${styles.btn} ${styles.btnPrimary}`} href={signupHref}>
          Créer mon compte gratuit
        </a>
        {share}
        <span className={v3.sumCtaNote}>Suivi mensuel gratuit de ce score, sans carte bancaire.</span>
      </div>
    </section>
  );
}

/* ---------- Partage de la carte de score ---------- */

/**
 * « Partager ma carte de score » : lien vers /carte/[auditId] quand le propriétaire a activé la carte
 * (src/lib/growth/cards.ts), sinon passage par le compte gratuit qui permet de l'activer. Jamais pour une démo.
 */
export function ShareCardLink({ cardHref, signupHref, demo, onDark = false }: { cardHref: string | null; signupHref: string; demo: boolean; onDark?: boolean }) {
  if (demo) return null;
  const cls = `${styles.btn} ${onDark ? styles.btnOnDark : styles.btnSecondary}`;
  if (cardHref) {
    return (
      <a className={cls} href={cardHref}>
        Partager ma carte de score
      </a>
    );
  }
  return (
    <a className={cls} href={`${signupHref}&suite=carte`} title="La carte se publie depuis votre compte gratuit">
      Partager ma carte de score
    </a>
  );
}

/* ---------- URL citées ---------- */

export function CitedUrlsBlock({ urls, youName }: { urls: CitedUrl[]; youName: string }) {
  if (!urls.length) return null;
  return (
    <div className={v3.urls}>
      <h3>Les {urls.length} pages les plus citées par les IA</h3>
      <p className={styles.caption}>Les adresses exactes que les IA donnent en source dans leurs réponses sur votre sujet.</p>
      <ol>
        {urls.map((u) => {
          const href = safeHref(u.url);
          return (
            <li key={u.url}>
              <span className={v3.urlMain}>
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                    {u.title ?? shortUrl(u.url)}
                  </a>
                ) : (
                  <span>{u.title ?? shortUrl(u.url)}</span>
                )}
                {u.title && <span className={v3.urlPath}>{shortUrl(u.url)}</span>}
              </span>
              <span className={v3.urlMeta}>
                <span className={styles.num}>
                  {u.citations} citation{u.citations > 1 ? 's' : ''}
                </span>
                {u.providers.length > 0 && <span>{u.providers.map((p) => PROVIDER_META[p].label).join(', ')}</span>}
                {u.clientPresent ? (
                  <span className={`${styles.badge} ${styles.badgeSuccess}`}>{youName} y figure</span>
                ) : u.competitors.length > 0 ? (
                  <span className={`${styles.badge} ${styles.badgeWarning}`}>
                    {u.competitors.slice(0, 2).join(', ')} y figure{u.competitors.length > 1 ? 'nt' : ''}, pas vous
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ---------- Matrice thème × IA ---------- */

function heat(rate: number): string {
  if (rate >= 60) return v3.heatHigh;
  if (rate >= 30) return v3.heatMid;
  if (rate > 0) return v3.heatLow;
  return v3.heatNone;
}

export function VoiceSection({ view }: { view: VoiceView }) {
  return (
    <Section
      id="themes"
      fold
      eyebrow="Par thème et par IA"
      title="Sur quels sujets chaque IA vous cite"
      sub="Part des réponses qui vous citent, pour chaque thème de questions et chaque IA. En dessous : l’acteur le plus cité à votre place."
    >
      <div className={v3.matrixWrap} role="region" aria-label="Matrice thème par IA" tabIndex={0}>
        <table className={v3.matrix}>
          <caption className={v3.srOnly}>Taux de citation par thème et par IA</caption>
          <thead>
            <tr>
              <th scope="col">Thème</th>
              {view.providers.map((p) => (
                <th key={p} scope="col">{PROVIDER_META[p].label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.themes.map((t, i) => (
              <tr key={t.id}>
                <th scope="row">{t.label}</th>
                {view.providers.map((p, j) => {
                  const c = view.cells[i]?.[j] ?? null;
                  if (!c) return <td key={p} className={v3.heatNa}>non mesuré</td>;
                  return (
                    <td key={p} className={heat(c.rate)}>
                      <span className={v3.cellRate}>{c.rate} %</span>
                      <span className={v3.cellSub}>
                        {c.cited}/{c.answers}
                        {c.rate < 50 && c.leader ? ` · ${c.leader}` : ''}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.caption} style={{ marginTop: 10 }}>
        Chaque case compte peu de réponses : lisez-la comme une tendance, pas comme une mesure précise.
      </p>
    </Section>
  );
}
