// Rapport complet V3 (Server Component). Spécifications : docs/11-rapport.md (V1), docs/v2/03, 06, 07, mission ENTONNOIR V3.
// Ordre : synthèse en 5 secondes · erreurs des IA · sources (+ URL citées) · pourquoi les concurrents · thème × IA ·
// perception · par IA et questions · méthode · on le fait pour vous · offres. Navigation par ancres collante.
import styles from './report.module.css';
import v4 from './v4.module.css';
import { AiAnswerCards } from './AiAnswerCards';
import { AnchorNav } from './AnchorNav';
import { ProviderTable } from './ProviderTable';
import { CompetitorBars } from './CompetitorBars';
import { QueryMatrix } from './QueryMatrix';
import { ShareButtons } from './ShareButtons';
import { StickyBar } from './StickyBar';
import { GapsSection, OfferCards, PerceptionSection, Section, SourcesSection, TasksSection, TruthSection } from './V2Sections';
import { CitedUrlsBlock, ShareCardLink, VoiceSection } from './V3Sections';
import { VerdictSection } from './Verdict';
import { MotionRoot } from '@/components/motion/MotionRoot';
import { REPORT_ANCHORS, citedUrls, findingsOf, marginOf, signupHref as signupHrefOf, summaryOf, voiceOf } from './v3';
import { auditStats } from '@/lib/digest/stats';
import {
  CONFIDENCE_TEXT,
  PROVIDER_META,
  byProvider,
  competitorRanking,
  formatDate,
  formatDateTime,
  formatShortDate,
  pickShowcase,
  providerList,
  providersUsed,
  queryMatrix,
} from './derive';
import {
  benchmarkOf,
  factCheckOf,
  gapsOf,
  groundedProviders,
  marketOf,
  offersFor,
  perceptionOf,
  previewTasks,
  segmentOf,
  shockLine,
  sourcesOf,
  wordsFor,
  type ReportResult,
} from './adapters';
import type { BrandFacts, ExecTask } from '@/lib/engine/types-v2';
import { DECOUVERTE_PLANS, VAT_NOTICE } from '@/lib/plans';

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'contact@repere-ia.fr';

export function ReportView({
  result,
  unlocked = false,
  tasks: externalTasks = null,
  facts = null,
  cardHref = null,
  payable = true,
}: {
  result: ReportResult;
  unlocked?: boolean;
  tasks?: ExecTask[] | null;
  facts?: BrandFacts | null;
  /** lien public de la carte de score si le propriétaire l'a activée (src/lib/growth/cards.ts) */
  cardHref?: string | null;
  /** paiement Stripe configuré ; sinon les offres renvoient vers /tarifs (aucun bouton mort) */
  payable?: boolean;
}) {
  const r = result;
  const seg = segmentOf(r);
  const w = wordsFor(r);
  const margin = marginOf(r);
  const score = margin.score;
  const providers = providersUsed(r);
  const stats = byProvider(r);
  const ranking = competitorRanking(r, 5);
  const leader = ranking.leader;
  const showcase = pickShowcase(r);
  const matrix = queryMatrix(r);
  const measuredAt = r.measuredAt || r.createdAt;
  // Un seul calcul pour tous les chiffres du rapport (src/lib/digest/stats.ts et src/lib/engine/analytics.ts).
  const st = auditStats(r);
  const nAnswers = st.answers;
  const runs = st.runs;
  const place = seg === 'local'
    ? [r.input.trade, r.input.district ? `${r.input.district}, ${r.input.city}` : r.input.city].join(', ')
    : [w.topic, marketOf(r)].filter(Boolean).join(', ');
  const shareTitle = `${r.input.businessName} : ${score}/100 de visibilité IA`;
  const shareText = `Visibilité IA de ${r.input.businessName} : ${score}/100.`;

  const bench = benchmarkOf(r);
  const shock = shockLine(r);
  const summary = summaryOf(r);
  const sources = sourcesOf(r);
  const urls = citedUrls(r, 5);
  const voice = voiceOf(r);
  const perception = perceptionOf(r);
  const fc = factCheckOf(r);
  const { gaps } = gapsOf(r, sources);
  const tasks = previewTasks(r, sources, externalTasks, facts);
  const offers = offersFor(seg);
  const grounded = groundedProviders(r);
  const groundedLabel = grounded.length ? providerList(grounded) : 'ChatGPT, Perplexity et Claude';
  const appHref = `/app/verite?audit=${encodeURIComponent(r.id)}`;
  const signupHref = signupHrefOf(r);
  const segParam = seg === 'ecommerce' ? 'ecommerce' : seg;
  const discoveryPoints = (DECOUVERTE_PLANS.find((p) => p.segment === (seg === 'ecommerce' ? 'ecommerce' : seg)) ?? DECOUVERTE_PLANS[0]).features.slice(0, 4);
  const anchors = REPORT_ANCHORS.filter((a) => a.id !== 'themes' || voice);
  const youRow = ranking.rows.find((x) => x.isYou);
  const findings = findingsOf(summary, leader, youRow?.mentions ?? 0);
  // Extraits de la synthèse : d'abord les réponses qui citent un concurrent et pas vous (le constat), au plus 2.
  const quotes = [...showcase].sort((a, b) => Number(a.mentioned) - Number(b.mentioned)).slice(0, 2);

  return (
    <div className={`${styles.root} ${styles.autoDark}`}>
      <MotionRoot />
      {r.demo && (
        <>
          <div className={styles.demoBanner} role="note">
            Rapport de démonstration : données simulées, pas une mesure réelle.
          </div>
          <div className={styles.demoWatermark} aria-hidden="true">
            <span>DÉMO</span>
          </div>
        </>
      )}

      <main id="contenu" className={styles.wrap}>
        {/* (a) Synthèse V4 : lisible en 10 secondes */}
        <VerdictSection
          name={r.input.businessName}
          meta={`${place}. Mesuré le ${formatDate(measuredAt)} sur ${providerList(providers)}.`}
          verdict={shock}
          margin={margin}
          findings={findings}
          quotes={quotes}
          rows={ranking.rows}
          answers={nAnswers}
          demo={r.demo}
          signupHref={signupHref}
          share={<ShareCardLink cardHref={cardHref} signupHref={signupHref} demo={r.demo} />}
        />

        <div className={v4.detailHead}>
          <h2>Le détail du rapport</h2>
          <p>Chaque partie se déplie.</p>
        </div>

        <AnchorNav anchors={anchors} demo={r.demo} />

        {/* (b) Vérité */}
        <TruthSection claims={perception.claims} factCheck={fc} appHref={appHref} demo={r.demo} />

        {/* (c) Sources */}
        <SourcesSection view={sources} unlocked={unlocked} seed={r.id} groundedLabel={groundedLabel}>
          <CitedUrlsBlock urls={unlocked ? urls : urls.slice(0, 2)} youName={r.input.businessName} />
          {!unlocked && urls.length > 2 && (
            <p className={styles.caption}>Les {urls.length - 2} autres pages citées sont dans votre compte gratuit.</p>
          )}
        </SourcesSection>

        {/* (d) Pourquoi */}
        <GapsSection gaps={gaps} youLabel={w.you}>
          <CompetitorBars rows={ranking.rows} directories={ranking.directories} leader={leader} youShare={ranking.rows.find((x) => x.isYou)?.share ?? r.shareOfVoice} answers={ranking.answers} />
        </GapsSection>

        {/* (d bis) Thème × IA */}
        {voice && <VoiceSection view={voice} />}

        {/* (e) Perception + réponses brutes (V1) */}
        <PerceptionSection p={perception} fold>
          {showcase.length > 0 ? (
            <AiAnswerCards items={showcase} businessName={r.input.businessName} date={formatShortDate(measuredAt)} />
          ) : null}
        </PerceptionSection>

        {/* (f) Par IA et matrice (V1) */}
        <Section id="par-ia" fold eyebrow="Votre note sur chaque IA" title="Les IA ne répondent pas toutes pareil">
          <ProviderTable result={r} stats={stats} />
        </Section>

        <Section id="questions" fold eyebrow="Les questions que nous avons posées" title="Question par question : où vous apparaissez, où vous n’êtes pas cité">
          <QueryMatrix result={r} rows={matrix} providers={providers} />
        </Section>

        <details className={`${styles.card} ${styles.method}`} id="methode">
          <summary>
            <span className={styles.infoIcon} aria-hidden="true">i</span>
            <span>
              <strong style={{ fontFamily: 'var(--r-display)', fontSize: 18 }}>Méthode et limites</strong>
              <span className={styles.caption} style={{ display: 'block' }}>
                {st.methodLabel}, le {formatDate(measuredAt)}. Score {margin.short}, confiance {r.confidence}.
              </span>
            </span>
          </summary>
          <div className={styles.methodBody}>
            <p>
              Mesuré le {formatDateTime(measuredAt)} : {nAnswers} réponses analysées sur {providerList(providers)} ({st.methodLabel})
              {st.brandAnswers > 0 ? `, plus ${st.brandAnswers} réponses à ${st.brandQuestions} questions sur votre ${seg === 'local' ? 'entreprise' : 'marque'} pour vérifier ce que disent les IA` : ''}. {CONFIDENCE_TEXT[r.confidence]}
            </p>
            <div className={styles.methodGrid}>
              <div className={styles.methodStat}><strong className={styles.num}>{score}/100</strong>score mesuré</div>
              <div className={styles.methodStat}><strong className={styles.num}>{margin.low} – {margin.high}</strong>intervalle à 90 % (± {margin.margin})</div>
              <div className={styles.methodStat}><strong>{r.confidence}</strong>niveau de confiance</div>
              <div className={styles.methodStat}><strong className={styles.num}>{nAnswers}</strong>réponses analysées</div>
              <div className={styles.methodStat}><strong className={styles.num}>{sources.report.totalCitations}</strong>sources citées relevées</div>
            </div>
            <div>
              <h3>Comment ce score est calculé</h3>
              <p>
                Nous avons posé <strong>{st.questions} questions</strong> types {seg === 'local' ? "d'un client potentiel" : "d'un acheteur"} (par exemple « {r.queries[0]?.text ?? w.topic} ») à{' '}
                <strong>{providerList(providers)}</strong>, <strong>{runs} fois chacune</strong>, le {formatDateTime(measuredAt)}. Le score combine la fréquence de citation, la place dans la réponse, la régularité d&apos;une IA à l&apos;autre et votre part des recommandations face aux concurrents. Le classement « {bench.rank}{bench.rank === 1 ? 'ᵉʳ' : 'ᵉ'} sur {bench.of} » compte les citations de chaque acteur nommé dans ces réponses.
              </p>
              <p style={{ marginTop: 8 }}>
                Marge d&apos;erreur : {margin.long} Plus vous suivez de questions, plus cette marge se resserre.
              </p>
            </div>
            <div>
              <h3>Sources et exactitude</h3>
              <p>
                Les sources sont les URL citées par {groundedLabel} via leurs API officielles. <strong>Gemini : pas de sources disponibles via API</strong> ; ses réponses servent à mesurer ce qu&apos;il dit de vous. Les affirmations factuelles sont extraites automatiquement et doivent être vérifiées avec votre fiche de vérité.
              </p>
            </div>
            <div>
              <h3>Ce qu&apos;il ne dit pas</h3>
              <ul>
                <li>Les réponses des IA <strong>varient</strong> d&apos;une fois à l&apos;autre, selon l&apos;utilisateur, l&apos;heure et la version du modèle. Ce score est un <strong>instantané</strong>, pas une vérité.</li>
                <li>Les réponses obtenues par nos outils peuvent différer de l&apos;application grand public (historique, mémoire, localisation précise).</li>
                <li>Le résultat n&apos;est <strong>pas une évaluation</strong> de la qualité, de la fiabilité ou de la réputation de {w.you} ni de ses concurrents.</li>
                <li>Les IA <strong>peuvent se tromper</strong>. Les concurrents mentionnés sont ceux <strong>cités par les IA</strong>, sans que nous les ayons évalués.</li>
                <li>Ce rapport a été <strong>produit avec l&apos;aide de l&apos;intelligence artificielle</strong> et ne constitue pas un conseil juridique, financier ou professionnel. <strong>Aucun résultat n&apos;est garanti.</strong></li>
              </ul>
            </div>
            {r.answers.some((a) => a.error) && (
              <p>Une des IA n&apos;a pas répondu à temps pour certaines questions. Votre score est calculé sur les autres réponses.</p>
            )}
            {r.demo && (
              <p>
                <span className={`${styles.badge} ${styles.badgeDemo}`}>Démo — données simulées</span> Ces données sont des exemples simulés, pas une mesure réelle.
              </p>
            )}
            <p className={styles.caption}>
              Repéré n&apos;est affilié ni à OpenAI, ni à Google, ni à Perplexity, ni à Anthropic. Une erreur ? Un souhait de retrait ?{' '}
              <a href={`mailto:${CONTACT}?subject=${encodeURIComponent(`Suppression rapport ${r.id}`)}`}>Contester ou supprimer cet audit</a> (réponse sous 30 jours au plus) ou écrivez à{' '}
              <a href={`mailto:${CONTACT}?subject=${encodeURIComponent(`Rapport ${r.id}`)}`}>{CONTACT}</a>. <a href="/methode">Toute la méthode →</a>
            </p>
          </div>
        </details>

        {/* (g) Ce qu'on fait pour vous */}
        <TasksSection tasks={tasks} youName={r.input.businessName} />

        {/* (h) Offres du parcours */}
        <section id="offres" className={`${styles.card} ${styles.ctaCard}`} aria-labelledby="offres-t">
          <h2 id="offres-t">
            {leader && score < 70 ? `${leader.name} est recommandé à votre place. On travaille pour que ce soit vous.` : 'Les IA recommandent. On travaille pour que ce soit vous.'}
          </h2>
          <p style={{ marginTop: 8 }}>
            Le référencement IA clé en main : on mesure, on explique, on le fait pour vous, au prix d&apos;un logiciel. Nous garantissons le travail fait et une mesure honnête, jamais une place dans une IA.
          </p>
          <OfferCards
            offers={offers}
            auditId={r.id}
            payable={payable}
            segmentParam={segParam}
            discovery={{ href: signupHref, points: discoveryPoints }}
          />
          <p className={styles.reassure}>
            <span>🔒 Paiement sécurisé</span>
            <span>Facture fournie · {VAT_NOTICE}</span>
            <span>Ce rapport reste gratuit et à vous, que vous choisissiez une offre ou non.</span>
          </p>
          <div className={styles.ctaRow}>
            <a className={`${styles.btn} ${styles.btnOnDark}`} href={`/api/report/${encodeURIComponent(r.id)}/pdf`}>
              Télécharger mon rapport PDF
            </a>
            <ShareCardLink cardHref={cardHref} signupHref={signupHref} demo={r.demo} onDark />
            <ShareButtons title={shareTitle} text={shareText} onDark />
          </div>
        </section>

        <p className={styles.footerNote}>
          Ce rapport indique si des assistants IA citent {r.input.businessName} quand on leur pose des questions types. Il ne juge pas la qualité de votre travail.
          {' '}{PROVIDER_META.gemini.label} : pas de sources disponibles via API.
        </p>
      </main>

      <StickyBar score={score} auditId={r.id} watchId="synthese" title={shareTitle} shareText={shareText} signupHref={signupHref} />
    </div>
  );
}
