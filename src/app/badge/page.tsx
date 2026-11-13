import Link from 'next/link';
import { pageMeta } from '@/lib/seo/meta';
import { h2Class } from '@/lib/seo/shell';
import { PageHero, SitePage } from '@/components/pages/ui';
import { Container } from '@/components/ui/Container';
import { buttonClasses } from '@/components/ui/Button';
import { CopyButton } from '@/components/tools/ui';
import v4 from '@/components/pages/v4/v4.module.css';
import { BADGE_DISCLAIMER, BADGE_MAX_AGE_DAYS } from '@/lib/growth/constants';
import { renderBadgeSvg } from '@/lib/growth/badge';
import { SITE_URL } from '@/lib/seo/site';

export const metadata = pageMeta({
  title: 'Le badge « Visibilité IA mesurée » à afficher sur votre site',
  description: 'Un badge daté, fondé sur une mesure réelle de votre visibilité dans les assistants IA. Il expire au bout de 45 jours sans nouvelle mesure.',
  path: '/badge',
});

const NOW = new Date().toISOString();
const EXAMPLES = [
  { label: 'À jour, sans note', svg: renderBadgeSvg({ state: 'valid', measuredAt: NOW }) },
  { label: 'À jour, avec note (facultative)', svg: renderBadgeSvg({ state: 'valid', measuredAt: NOW, score: 64 }) },
  { label: 'Expiré : plus aucune note', svg: renderBadgeSvg({ state: 'expired' }) },
];

export default function BadgePage() {
  const code = `<a href="${SITE_URL}/p/votre-page" title="Visibilité IA mesurée par Repéré"><img src="${SITE_URL}/badge/VOTRE-IDENTIFIANT.svg" alt="Visibilité IA mesurée par Repéré" width="320" height="72" loading="lazy"></a>`;
  return (
    <SitePage>
      <PageHero
        crumbs={[{ name: 'Accueil', href: '/' }, { name: 'Badge' }]}
        title="Le badge « Visibilité IA mesurée par Repéré »"
        lead="Montrez à vos clients que votre visibilité dans les assistants IA est mesurée, avec la date de la mesure. Le badge atteste d’une mesure, pas d’une recommandation."
        aside={
          <figure data-reveal="" className={v4.site}>
            <div className={v4.siteBar} aria-hidden="true">
              <i />
              <i />
              <i />
              <span>votre-site.fr</span>
            </div>
            <div className={v4.siteBody} aria-hidden="true">
              <span className={v4.siteLine} style={{ width: '62%' }} />
              <span className={v4.siteLine} style={{ width: '88%' }} />
              <span className={v4.siteLine} style={{ width: '74%' }} />
            </div>
            <div className={v4.siteFoot}>
              <span className={v4.siteFootLabel} aria-hidden="true">Pied de page</span>
              <div className={`${v4.pop} ${v4.badgeShadow}`} style={{ ['--d' as string]: '450ms' }} role="img" aria-label="Exemple : badge à jour, avec note" dangerouslySetInnerHTML={{ __html: renderBadgeSvg({ state: 'valid', measuredAt: NOW, score: 64 }) }} />
            </div>
            <figcaption className="px-5 pb-4 text-[0.85rem] text-muted">Illustration du rendu sur un site (ce n’est pas un badge de client).</figcaption>
          </figure>
        }
      />
      <Container size="narrow" className={`${v4.editorial} pb-16 pt-4`}>
      <section aria-labelledby="look-t">
      <h2 id="look-t" className={h2Class}>À quoi il ressemble</h2>
      <div className="rounded-[14px] bg-white p-5 shadow-[0_0_0_1px_var(--color-line)]">
        <p className="mb-4 text-sm" style={{ color: 'var(--muted)' }}>
          Illustrations du rendu (ce ne sont pas des badges de clients).
        </p>
        <ul className="ui-cascade grid gap-5">
          {EXAMPLES.map((ex) => (
            <li key={ex.label} className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div role="img" aria-label={`Exemple : ${ex.label}`} dangerouslySetInnerHTML={{ __html: ex.svg }} />
              <span className="text-[0.95rem] font-semibold">{ex.label}</span>
            </li>
          ))}
        </ul>
      </div>
      </section>
      <h2 className={h2Class}>Les règles</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Il n’est délivré qu’à un compte ayant eu une <strong>mesure réelle</strong> : jamais sur une simulation ni un compte de démonstration.</li>
        <li>Il affiche le mois de la mesure. Au-delà de {BADGE_MAX_AGE_DAYS} jours sans nouvelle mesure, il affiche « Mesure expirée » et plus aucune note.</li>
        <li>La note /100 est facultative : vous choisissez de l’afficher ou non.</li>
        <li>Il ne dit jamais qu’un assistant IA vous recommande. {BADGE_DISCLAIMER}</li>
        <li>Vous pouvez le désactiver à tout moment : l’image cesse alors de répondre.</li>
      </ul>

      <h2 className={h2Class}>Le code à copier</h2>
      <p style={{ color: 'var(--muted)' }}>
        Dans votre espace, l’identifiant et le lien de votre page publique sont déjà remplis. Le lien est un lien ordinaire vers votre page, sans attribut nofollow ; nous ne le présentons pas comme un levier de référencement.
      </p>
      <div className="mt-3 overflow-hidden rounded-[14px] bg-white shadow-[0_0_0_1px_var(--color-line)]">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
          <span className="text-[0.88rem] font-semibold text-muted">HTML</span>
          <CopyButton text={code} label="Copier le code" />
        </div>
        <pre className="relative overflow-x-auto p-4 text-sm">
          <code>{code}</code>
        </pre>
      </div>

      <div className="mt-10">
        <Link href="/audit?from=badge" className={buttonClasses({ size: 'lg', className: 'lift' })}>
          Mesurer ma visibilité IA
        </Link>
      </div>
      </Container>
    </SitePage>
  );
}
