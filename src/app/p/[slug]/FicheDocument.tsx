import { credentialLine, exceptionLine, frDate, priceLabel, type PublicFicheContext } from '@/lib/execution/fiche';
import { jsonLdString } from '@/lib/execution/jsonld';
import { googleReviewUrl } from '@/lib/execution/reviews';
import { cleanUrl, splitList } from '@/lib/execution/util';
import { abs } from '@/lib/seo/site';
import './fiche.css';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pf-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Seal({ p }: { p: PublicFicheContext }) {
  const v = p.view;
  if (v.confirmedAt)
    return (
      <p className="pf-seal">
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
          <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M6 10.4l2.6 2.5L14 7.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>
          Dernière vérification par l’entreprise le <time dateTime={v.confirmedAt.slice(0, 10)}>{frDate(v.confirmedAt)}</time>
        </span>
      </p>
    );
  return <p className="pf-seal pf-seal-pending">Informations fournies par l’entreprise{v.updatedAt ? `, mises à jour le ${frDate(v.updatedAt)}` : ''}. Pas encore confirmées.</p>;
}

/** Corps de la fiche officielle (page publique et aperçu dans /app/fiche). */
export function FicheDocument({ p, preview = false }: { p: PublicFicheContext; preview?: boolean }) {
  const { ctx, view } = p;
  const t = view.text;
  const brand = /^#[0-9a-f]{6}$/i.test(ctx.settings.brandColor ?? '') ? (ctx.settings.brandColor as string) : '#3730A3';
  const site = cleanUrl(t.site);
  // Compte démo : le site affiché est fictif, aucune recommandation ne lui est transmise.
  const rel = p.demo ? 'noopener nofollow' : 'noopener';
  const reviewUrl = p.demo ? null : (ctx.settings.reviewUrl ?? googleReviewUrl(ctx.settings.placeId));
  const priced = view.services.some((s) => typeof s.priceFrom === 'number');
  const conditions = (['prix', 'delais', 'livraison', 'retours', 'garanties'] as const).filter((k) => t[k]);
  const about = (['creation', 'dirigeant', 'equipe', 'clients', 'avis'] as const).filter((k) => t[k]);
  const ABOUT_LABEL = { creation: 'Création', dirigeant: 'Dirigeant', equipe: 'Équipe', clients: 'Clients', avis: 'Avis clients' } as const;
  const COND_LABEL = { prix: 'Tarifs', delais: 'Délais', livraison: 'Livraison', retours: 'Retours', garanties: 'Garanties' } as const;

  return (
    <div className={`pf${preview ? ' pf-preview' : ''}`} style={{ ['--pf-brand' as string]: brand }}>
      {!preview && p.jsonld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(p.jsonld) }} />}
      {p.demo && (
        <p className="pf-demo" role="note">
          Exemple de démonstration : cette entreprise est fictive. Cette page n’est pas indexée et ne publie aucune donnée structurée.
        </p>
      )}
      <header className="pf-head">
        <div className="pf-wrap">
          {ctx.settings.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ctx.settings.logoUrl} alt={`Logo ${p.name}`} className="pf-logo" width={48} height={48} />
          )}
          <p className="pf-kind">{p.kind}</p>
          <h1>{p.name}</h1>
          <p className="pf-activity">{p.activity}</p>
          <Seal p={p} />
          {site && (
            <p className="pf-site">
              Site officiel :{' '}
              <a href={site} rel={rel}>
                {site.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            </p>
          )}
        </div>
      </header>

      <main id={preview ? undefined : 'contenu'} className="pf-wrap pf-main">
        {(t.adresse || t.zone || t.telephone || t.email || t.horaires || view.exceptions.length > 0) && (
          <section aria-labelledby="pf-contact">
            <h2 id="pf-contact">Coordonnées{t.horaires ? ' et horaires' : ''}</h2>
            <dl>
              {t.adresse && <Row label="Adresse">{t.adresse}</Row>}
              {t.zone && <Row label="Zone">{t.zone}</Row>}
              {t.telephone && (
                <Row label="Téléphone">
                  <a href={`tel:${t.telephone.replace(/[^\d+]/g, '')}`}>{t.telephone}</a>
                </Row>
              )}
              {t.email && (
                <Row label="E-mail">
                  <a href={`mailto:${t.email}`}>{t.email}</a>
                </Row>
              )}
              {t.horaires && <Row label="Horaires">{t.horaires}</Row>}
              {view.exceptions.length > 0 && (
                <Row label="Exceptions">
                  <ul className="pf-plain">
                    {view.exceptions.map((e) => (
                      <li key={`${e.from}-${e.label ?? ''}`}>{exceptionLine(e)}</li>
                    ))}
                  </ul>
                </Row>
              )}
              {t.statut && <Row label="Statut">{t.statut}</Row>}
            </dl>
          </section>
        )}

        {view.services.length > 0 && (
          <section aria-labelledby="pf-services">
            <h2 id="pf-services">{ctx.segment === 'ecommerce' ? 'Produits' : 'Services'}{priced ? ' et prix' : ''}</h2>
            <ul className="pf-services">
              {view.services.map((s) => (
                <li key={s.name}>
                  <span>{s.name}</span>
                  {priceLabel(s) && <span className="pf-price">{priceLabel(s)}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
        {t.produits && (
          <section aria-labelledby="pf-produits">
            <h2 id="pf-produits">Gammes</h2>
            <p>{t.produits}</p>
          </section>
        )}

        {conditions.length > 0 && (
          <section aria-labelledby="pf-conditions">
            <h2 id="pf-conditions">Conditions</h2>
            <dl>
              {conditions.map((k) => (
                <Row key={k} label={COND_LABEL[k]}>
                  {t[k]}
                </Row>
              ))}
            </dl>
          </section>
        )}

        {view.certifications.length > 0 && (
          <section aria-labelledby="pf-labels">
            <h2 id="pf-labels">Labels et certifications</h2>
            <ul className="pf-plain pf-labels">
              {view.certifications.map((c) => (
                <li key={credentialLine(c)}>
                  {credentialLine(c)}
                  {c.verifyUrl && (
                    <>
                      {' '}
                      <a href={c.verifyUrl} rel="noopener nofollow">
                        Vérifier auprès de l’organisme
                      </a>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {(t.paiement || t.langues) && (
          <section aria-labelledby="pf-pratique">
            <h2 id="pf-pratique">Paiement et langues</h2>
            <dl>
              {t.paiement && <Row label="Paiement">{splitList(t.paiement).join(', ')}</Row>}
              {t.langues && <Row label="Langues parlées">{splitList(t.langues).join(', ')}</Row>}
            </dl>
          </section>
        )}

        {(t.histoire || t.difference || about.length > 0 || t.ingredients) && (
          <section aria-labelledby="pf-about">
            <h2 id="pf-about">À propos</h2>
            {t.histoire && <p>{t.histoire}</p>}
            {t.difference && <p>{t.difference}</p>}
            {t.ingredients && <p>{t.ingredients}</p>}
            {about.length > 0 && (
              <dl>
                {about.map((k) => (
                  <Row key={k} label={ABOUT_LABEL[k]}>
                    {t[k]}
                  </Row>
                ))}
              </dl>
            )}
          </section>
        )}

        {p.faq.length > 0 && (
          <section aria-labelledby="pf-faq">
            <h2 id="pf-faq">Questions fréquentes</h2>
            {p.faq.map((i) => (
              <div key={i.q} className="pf-q">
                <h3>{i.q}</h3>
                <p>{i.a}</p>
              </div>
            ))}
          </section>
        )}

        {(view.sameAs.length > 0 || reviewUrl) && (
          <section aria-labelledby="pf-liens">
            <h2 id="pf-liens">Liens officiels</h2>
            <ul className="pf-plain">
              {view.sameAs.map((u) => (
                <li key={u}>
                  <a href={u} rel={rel}>
                    {u.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '')}
                  </a>
                </li>
              ))}
              {reviewUrl && (
                <li>
                  <a href={reviewUrl} rel="noopener nofollow">
                    Donner votre avis sur Google
                  </a>
                </li>
              )}
            </ul>
          </section>
        )}
      </main>

      <footer className="pf-foot">
        <div className="pf-wrap">
          <p>
            Page publiée par {p.name} avec <a href={abs('/fonctionnalites/fiche-officielle')}>Repéré</a>. Les informations sont saisies et confirmées par l’entreprise, qui en est responsable.
          </p>
          <p>
            Pour les assistants IA : <a href={`${p.pageUrl}.md`}>version Markdown</a> · <a href={`${p.pageUrl}/llms.txt`}>llms.txt</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
