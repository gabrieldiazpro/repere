// Sections V2 du rapport (Server Components). Données : ./adapters.ts.
import styles from './report.module.css';
import v from './v2.module.css';
import v3 from './v3.module.css';
import { FoldToggle } from './Fold';
import { CopyButton } from './CopyButton';
import { CheckoutButton } from './CheckoutButton';
import { PROVIDER_META } from './derive';
import {
  AUTOMATION_LABEL,
  CATEGORY_LABEL,
  FIELD_LABEL,
  GEMINI_NOTE,
  groupClaims,
  blurWidth,
  type PerceptionView,
  type SegmentOffer,
  type SourceCard,
  type SourcesView,
  type TaskPreview,
} from './adapters';
import type { BrandClaim, CompetitorGap, FactCheckReport } from '@/lib/engine/types-v2';
import { fr } from '@/components/ui/typo';

export const FREE_SOURCES_VISIBLE = 3;

const EFFORT_TXT: Record<'S' | 'M' | 'L', string> = { S: 'Effort faible (≈ 30 min)', M: 'Effort moyen (≈ ½ journée)', L: 'Effort élevé (plusieurs semaines)' };
const stars = (n: number) => '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n);

export function Section({ id, eyebrow, title, sub, fold = false, children }: { id: string; eyebrow?: string; title: string; sub?: string; fold?: boolean; children: React.ReactNode }) {
  // Toutes les sections sont repliables sur mobile ; `fold` = repliée par défaut sur mobile (sections secondaires).
  return (
    <section id={id} className={`${styles.card} ${v3.foldable}`} aria-labelledby={`${id}-t`}>
      <header className={`${styles.sectionHead} ${v3.foldHead}`}>
        <div className={v3.foldTitle}>
          {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
          <h2 id={`${id}-t`}>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        <FoldToggle sectionId={id} bodyId={`${id}-body`} folded={fold} title={title} />
      </header>
      <div id={`${id}-body`} className={v3.foldBody}>
        {children}
      </div>
    </section>
  );
}

/* ---------- (b) Vérité ---------- */

export function TruthSection({ claims, factCheck, appHref, demo }: { claims: BrandClaim[]; factCheck: FactCheckReport | null; appHref: string; demo: boolean }) {
  const errors = factCheck?.items.filter((i) => i.verdict === 'faux' || i.verdict === 'incomplet') ?? [];
  const groups = groupClaims(claims, 6);
  return (
    <Section
      id="verite"
      eyebrow="Exactitude"
      title="Les IA disent-elles des choses fausses sur vous ?"
      sub={
        factCheck
          ? `Nous avons comparé ce que disent les IA avec votre fiche de vérité, le ${new Date(factCheck.checkedAt).toLocaleDateString('fr-FR')}. Détection sur échantillon.`
          : 'Voici les affirmations factuelles que les IA font à votre sujet. Vous seul pouvez dire si elles sont justes.'
      }
    >
      {factCheck && (
        <p className={styles.hook}>
          {factCheck.errors > 0 ? (
            <>
              <strong>{factCheck.errors} information{factCheck.errors > 1 ? 's' : ''} fausse{factCheck.errors > 1 ? 's' : ''}</strong> repérée{factCheck.errors > 1 ? 's' : ''} dans les réponses des IA{demo ? ' (exemple de démonstration)' : ''}.
            </>
          ) : (
            <>Aucune erreur repérée sur les {factCheck.items.length} faits vérifiés.</>
          )}
        </p>
      )}
      {errors.length > 0 && (
        <div className={v.claims}>
          {errors.map((e, i) => (
            <div key={`e${i}`} className={`${v.claim} ${v.claimError}`}>
              <div className={v.claimTop}>
                <span className={v.claimField}>{FIELD_LABEL[e.field]}</span>
                <span className={`${styles.badge} ${styles.badgeDanger}`}>{e.verdict === 'faux' ? 'Faux' : 'Incomplet'}</span>
                <span className={styles.caption}>selon {PROVIDER_META[e.provider].label} · gravité {e.severity}</span>
              </div>
              <span className={v.claimValue}>L&apos;IA dit : {e.stated}</span>
              <span className={v.expected}>La bonne information : {e.expected}</span>
              {e.quote && <q className={v.claimQuote}>{e.quote}</q>}
            </div>
          ))}
        </div>
      )}
      {!factCheck && groups.length > 0 && (
        <div className={v.claims}>
          {groups.map((c, i) => (
            <div key={`c${i}`} className={v.claim}>
              <div className={v.claimTop}>
                <span className={v.claimField}>{FIELD_LABEL[c.field]}</span>
                <span className={`${styles.badge} ${styles.badgeMuted}`}>À vérifier</span>
                <span className={styles.caption}>selon {c.providers.map((p) => PROVIDER_META[p].label).join(', ')}</span>
              </div>
              <span className={v.claimValue}>{c.value}</span>
              {c.quote && c.quote !== c.value && <q className={v.claimQuote}>{c.quote}</q>}
            </div>
          ))}
        </div>
      )}
      {!factCheck && groups.length === 0 && (
        <p className={styles.hook}>Les IA ne donnent presque aucun fait précis sur vous (adresse, prix, horaires). C&apos;est souvent le signe qu&apos;elles manquent de sources fiables à votre sujet.</p>
      )}
      <div className={v.truthCta}>
        <strong>{factCheck ? 'Corrigez ces erreurs à la source' : 'Vérifiez en 2 minutes'}</strong>
        <p>
          Remplissez votre fiche de vérité (adresse, téléphone, horaires, prix, services) dans votre espace. Nous comparons ensuite chaque réponse des IA avec elle et vous signalons toute erreur, avec la source probable et la correction à faire. Nous ne pouvons pas promettre qu&apos;une IA se corrigera, ni dans quel délai.
        </p>
        <a className={`${styles.btn} ${styles.btnPrimary}`} href={appHref} style={{ justifySelf: 'start' }}>
          Remplir ma fiche de vérité
        </a>
      </div>
    </Section>
  );
}

/* ---------- (c) Sources ---------- */

function Presence({ p }: { p: SourceCard['presence'] }) {
  if (p === 'present') return <span className={`${v.pres} ${v.presYes}`}><span aria-hidden="true">✓</span> Vous y êtes</span>;
  if (p === 'absent') return <span className={`${v.pres} ${v.presNo}`}><span aria-hidden="true">✗</span> Absent</span>;
  return <span className={`${v.pres} ${v.presUnk}`}><span aria-hidden="true">?</span> À vérifier</span>;
}

function SourceItem({ c, i, locked, seed }: { c: SourceCard; i: number; locked: boolean; seed: string }) {
  const cls = `${v.src} ${c.reference ? v.srcRef : ''} ${locked ? v.srcLocked : ''}`;
  return (
    <li className={cls}>
      <div className={v.srcHead}>
        <span className={v.srcNum} aria-hidden="true">{i + 1}</span>
        <span className={v.srcName}>
          <strong>{c.label}</strong>
          <span>
            {CATEGORY_LABEL[c.category]}
            {c.reference ? ' · recommandée pour votre secteur' : c.totalAnswers ? ` · citée ${c.citedAnswers} fois` : ''}
          </span>
        </span>
        <Presence p={c.presence} />
      </div>
      {locked ? (
        <div className={v.srcBody} aria-hidden="true">
          {[0, 1, 2].map((k) => (
            <div key={k} style={{ height: 12, width: `${blurWidth(seed + c.domain, k)}%`, background: 'var(--r-line)', borderRadius: 6, marginTop: 6 }} />
          ))}
        </div>
      ) : (
        <div className={v.srcBody} style={{ display: 'grid', gap: 8 }}>
          <span className={v.srcAction}>{c.action}</span>
          <p className={v.srcWhy}>{c.why}</p>
          {c.competitorsPresent.length > 0 && (
            <div className={styles.chips} style={{ marginTop: 0 }}>
              <span className={styles.caption}>Concurrents présents :</span>
              {c.competitorsPresent.slice(0, 4).map((n) => (
                <span key={n} className={`${styles.badge} ${styles.badgeWarning}`}>{n}</span>
              ))}
            </div>
          )}
          <ol className={v.srcHow}>
            {c.howTo.slice(0, 3).map((h, k) => <li key={k}>{h}</li>)}
          </ol>
          <div className={v.srcMeta}>
            <span>Impact {stars(c.impact)}</span>
            <span>·</span>
            <span>{EFFORT_TXT[c.effort]}</span>
            {c.providers.length > 0 && (
              <>
                <span>·</span>
                <span>Lue par {c.providers.map((p) => PROVIDER_META[p].label).join(', ')}</span>
              </>
            )}
          </div>
        </div>
      )}
      {locked && <span className={v.srcLockMsg}>🔒 Détail dans l&apos;offre complète</span>}
    </li>
  );
}

export function SourcesSection({ view, unlocked, seed, groundedLabel, children }: { view: SourcesView; unlocked: boolean; seed: string; groundedLabel: string; children?: React.ReactNode }) {
  const cards = view.cards;
  const absentWithComp = cards.filter((c) => c.presence !== 'present' && c.competitorsPresent.length > 0).length;
  return (
    <Section
      id="sources"
      eyebrow="Ce que lisent les IA"
      title={`Les ${cards.length} sources où il faut être`}
      sub={
        view.groundedAnswers
          ? `Les sites que ${groundedLabel} citent quand ils répondent sur votre sujet (${view.report.totalCitations} citations relevées dans ${view.groundedAnswers} réponses avec sources ; Gemini n’en fournit pas), classés par opportunité pour vous.`
          : 'Les sites de référence de votre secteur, classés par opportunité.'
      }
    >
      {absentWithComp > 0 && (
        <p className={styles.hook}>
          Sur {absentWithComp} de ces sources, au moins un concurrent est présent <strong>et pas vous</strong>.
        </p>
      )}
      <ol className={v.srcList}>
        {cards.map((c, i) => (
          <SourceItem key={c.domain} c={c} i={i} locked={!unlocked && i >= FREE_SOURCES_VISIBLE} seed={seed} />
        ))}
      </ol>
      {!unlocked && cards.length > FREE_SOURCES_VISIBLE && (
        <div className={v.unlock}>
          <p>
            <strong>{cards.length - FREE_SOURCES_VISIBLE} autres sources</strong> sont analysées : pourquoi elles comptent, qui y est, et comment y entrer pas à pas.
          </p>
          <a className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`} href="#offres">Voir toutes les sources</a>
        </div>
      )}
      {children}
      <p className={v.honest}>
        <span className={styles.infoIcon} aria-hidden="true">i</span>
        <span>
          <b>{GEMINI_NOTE}</b> Sources relevées via les API officielles ; elles varient fortement d&apos;un mois à l&apos;autre : c&apos;est un indicateur, pas une garantie. Présence « À vérifier » : nous ne l&apos;avons pas trouvée dans les réponses, confirmez-la dans votre espace.
          {view.clientCitedAnswers > 0 ? ` Votre site est cité comme source dans ${view.clientCitedAnswers} réponse${view.clientCitedAnswers > 1 ? 's' : ''}.` : ''}
        </span>
      </p>
    </Section>
  );
}

/* ---------- (d) Pourquoi ---------- */

export function GapsSection({ gaps, children, youLabel }: { gaps: CompetitorGap[]; children: React.ReactNode; youLabel: string }) {
  return (
    <Section
      id="pourquoi"
      eyebrow="Concurrents"
      title="Pourquoi vos concurrents passent devant"
      sub={`Les faits relevés dans les réponses et les sources des IA. Ce n'est pas un jugement sur la qualité de ${youLabel} ni des leurs.`}
    >
      {children}
      {gaps.length > 0 && (
        <div className={v.gaps}>
          {gaps.map((g) => (
            <article key={g.competitor} className={v.gap}>
              <div className={v.gapHead}>
                <strong>{g.competitor}</strong>
                <span className={`${styles.badge} ${styles.badgeWarning}`}>{Math.round((g.share <= 1 ? g.share * 100 : g.share))} % des citations</span>
              </div>
              <ul>
                {g.reasons.slice(0, 4).map((x, i) => <li key={i}>{x}</li>)}
              </ul>
              {g.presentOn.length > 0 && (
                <div className={v.gapOn}>
                  <span className={styles.caption}>Présent sur :</span>
                  {g.presentOn.slice(0, 5).map((d) => (
                    <span key={d} className={`${styles.badge} ${styles.badgeMuted}`}>{d}</span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </Section>
  );
}

/* ---------- (e) Perception ---------- */

export function PerceptionSection({ p, children, fold = false }: { p: PerceptionView; children?: React.ReactNode; fold?: boolean }) {
  // Arrondi au plus fort reste : les trois pourcentages font toujours 100 (pas 101).
  const raw = [p.sentiment.positif, p.sentiment.neutre, p.sentiment.negatif].map((x) => x * 100);
  const base = raw.map(Math.floor);
  let left = 100 - base.reduce((a, b) => a + b, 0);
  raw.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r).forEach(({ i }) => {
    if (left > 0 && raw.reduce((a, b) => a + b, 0) > 0) {
      base[i]++;
      left--;
    }
  });
  const rounded = { positif: base[0], neutre: base[1], negatif: base[2] };
  const has = p.quotes.length > 0;
  return (
    <Section
      id="perception"
      fold={fold}
      eyebrow="Réputation dans les IA"
      title="Ce que les IA disent de vous"
      sub={has ? `Les phrases où les IA parlent de vous, telles quelles (${p.mentionsAnalysed} passage${p.mentionsAnalysed > 1 ? 's' : ''} analysé${p.mentionsAnalysed > 1 ? 's' : ''}).` : 'Les IA ne parlent pas encore de vous : voici ce qu’elles répondent à vos clients.'}
    >
      {has && (
        <>
          <div className={v.sentBar} role="img" aria-label={`Ton : ${rounded.positif} % positif, ${rounded.neutre} % neutre, ${rounded.negatif} % négatif`}>
            <span className={v.sentPos} style={{ width: `${rounded.positif}%` }} />
            <span className={v.sentNeu} style={{ width: `${rounded.neutre}%` }} />
            <span className={v.sentNeg} style={{ width: `${rounded.negatif}%` }} />
          </div>
          <div className={v.sentLegend}>
            <span><i className={v.sentPos} />Positif {rounded.positif} %</span>
            <span><i className={v.sentNeu} />Neutre {rounded.neutre} %</span>
            <span><i className={v.sentNeg} />Négatif {rounded.negatif} %</span>
          </div>
          {p.themes.length > 0 && (
            <div className={styles.chips}>
              <span className={styles.caption}>Thèmes associés :</span>
              {p.themes.map((t) => <span key={t} className={`${styles.badge} ${styles.badgePrimary}`}>{t}</span>)}
            </div>
          )}
          <div className={v.quotes}>
            {p.quotes.slice(0, 4).map((q, i) => (
              <figure key={i} className={v.quote}>
                <blockquote>« {q.text} »</blockquote>
                <figcaption>
                  <span className={`${styles.badge} ${q.sentiment === 'positif' ? styles.badgeSuccess : q.sentiment === 'negatif' ? styles.badgeDanger : styles.badgeMuted}`}>{q.sentiment === 'negatif' ? 'négatif' : q.sentiment}</span>
                  <span>{PROVIDER_META[q.provider].label}</span>
                  {q.query && <span>· « {q.query.length > 70 ? `${q.query.slice(0, 68)}…` : q.query} »</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      )}
      {children && (
        <>
          <div className={v.sub}>
            <h3>Leurs réponses à vos clients</h3>
            <p>Nous leur avons posé les questions que posent vos clients. Voici leurs réponses, telles quelles.</p>
          </div>
          {children}
        </>
      )}
    </Section>
  );
}

/* ---------- (g) Tâches ---------- */

export function TasksSection({ tasks, youName }: { tasks: TaskPreview[]; youName: string }) {
  return (
    <Section
      id="pour-vous"
      eyebrow="On le fait pour vous"
      title="Ce qu’on fait pour vous"
      sub={`Aperçu de 3 tâches préparées pour ${youName}, avec le livrable réel. Rien n'est publié sans votre validation.`}
    >
      <div className={v.tasks}>
        {tasks.map((t, i) => (
          <article key={t.id} className={v.task}>
            <div className={v.taskHead}>
              <strong>{i + 1}. {fr(t.title)}</strong>
              <span className={`${styles.badge} ${t.automation === 'auto' ? styles.badgeSuccess : t.automation === 'semi' ? styles.badgePrimary : styles.badgeMuted}`}>
                {AUTOMATION_LABEL[t.automation]} · {t.minutes} min de votre temps
              </span>
            </div>
            <p className={v.taskWhy}>{t.why}</p>
            <div className={v.deliv}>
              {t.deliverable.label && <span className={v.delivLabel}>{t.deliverable.label}</span>}
              {t.deliverable.type === 'link' ? (
                <a href={t.deliverable.content}>{t.deliverable.content}</a>
              ) : (
                <pre className={t.deliverable.type === 'jsonld' || t.deliverable.type === 'html' ? v.delivBox : v.delivText}>{t.deliverable.content}</pre>
              )}
              {t.deliverable.type !== 'link' && <CopyButton text={t.deliverable.content} />}
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}

/* ---------- (h) Offres ---------- */

export function OfferCards({ offers, auditId, discovery, payable = true, segmentParam }: { offers: SegmentOffer[]; auditId: string; discovery?: { href: string; points: string[] }; payable?: boolean; segmentParam: string }) {
  // Ordre : Découverte (gratuite) d'abord, puis Essentiel, Accompagné, audit approfondi.
  const rank = (o: SegmentOffer) => (/_essentiel_/.test(o.planId) ? 0 : /_accompagne_/.test(o.planId) ? 1 : 2);
  const sorted = [...offers].sort((a, b) => rank(a) - rank(b));
  return (
    <div className={`${styles.offers} ${v3.offers4}`}>
      {discovery && (
        <div className={`${styles.offer} ${v3.offerFree}`}>
          <span className={styles.offerTag}>Pour commencer</span>
          <h3>Découverte</h3>
          <span className={styles.offerPrice}>
            0 € <small>sans limite de durée</small>
          </span>
          <p>Suivez ce score chaque mois, gratuitement, et retrouvez ce rapport dans votre espace.</p>
          <ul className={v.offerPoints}>
            {discovery.points.map((x) => <li key={x}>{x}</li>)}
          </ul>
          <a className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBlock}`} href={discovery.href}>
            Créer mon compte gratuit
          </a>
        </div>
      )}
      {sorted.map((o) => (
        <div key={o.planId} className={`${styles.offer} ${o.featured ? styles.offerFeatured : ''}`}>
          {o.featured && <span className={styles.offerTag}>On le fait pour vous</span>}
          <h3>{o.name}</h3>
          <span className={styles.offerPrice}>
            {o.price} <small>{o.unit}</small>
          </span>
          <p>{o.pitch}</p>
          <ul className={v.offerPoints}>
            {o.points.map((x) => <li key={x}>{x}</li>)}
          </ul>
          {payable ? (
            <CheckoutButton planId={o.planId} auditId={auditId} variant={o.featured ? 'primary' : 'secondary'} block fallbackHref={`/tarifs?segment=${segmentParam}`}>
              {o.cta}
            </CheckoutButton>
          ) : (
            <a className={`${styles.btn} ${o.featured ? styles.btnPrimary : styles.btnSecondary} ${styles.btnBlock}`} href={`/tarifs?segment=${segmentParam}#${o.planId}`}>
              Voir le détail de l’offre {o.name}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
