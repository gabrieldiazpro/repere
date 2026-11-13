import { pageMeta } from '@/lib/seo/meta';
import { ENTITY_READY, HOUSE_PAGE_PATH, LEGAL, ONE_LINER } from '@/lib/seo/site';
import { houseOrgExtras, housePageLive, mergeOrg } from '@/lib/seo/house';
import Link from 'next/link';
import { PageShell, Crumbs, JsonLd, Hl, h1Class, h1Style } from '@/lib/seo/shell';
import { Byline, QaSection, RelatedLinks, AuditCta, EDITORIAL_UPDATED } from '@/lib/seo/editorial';
import { breadcrumbListLd, founderLd, graph, organizationLd, webPageLd, websiteLd, FOUNDER, ORG_ID } from '@/lib/seo/jsonld';

const PATH = '/a-propos';
const TITLE = 'À propos de Repéré : le référencement IA des entreprises françaises';
const DESCRIPTION =
  "Qui est Repéré, service français de référencement IA (GEO) : mission, méthode, fondateur, coordonnées et engagements (aucune promesse de position, réponses des IA conservées, conformité RGPD).";
const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'contact@repere-ia.fr';

const SEO_TITLE = "À propos de Repéré, référencement IA français";

export const metadata = pageMeta({
  path: PATH,
  title: SEO_TITLE,
  ogTitle: TITLE,
  description: DESCRIPTION,
  type: 'website',
  noindex: !ENTITY_READY, // [À COMPLÉTER] restants : noindex tant que src/lib/seo/site.ts n'est pas rempli
});

const ENGAGEMENTS: { title: string; text: string }[] = [
  {
    title: 'Aucune promesse de position',
    text: "Nous ne promettons jamais d'être premier, cité ou recommandé par une IA. Les réponses des IA varient d'une fois à l'autre et changent sans préavis. Nous garantissons ce qui dépend de nous : le travail fait chaque mois et une mesure honnête de son effet.",
  },
  {
    title: 'Les réponses des IA conservées comme preuve',
    text: "Pour chaque mesure, nous conservons la question posée, l'IA et le modèle interrogés, la date et le texte de la réponse. Chaque score peut ainsi être vérifié réponse par réponse, et chaque résultat indique le nombre de réponses analysées et sa marge d'erreur.",
  },
  {
    title: 'Rien publié sans votre accord',
    text: "Avec l'offre Accompagné, chaque fiche, page, réponse à un avis ou démarche vers un site tiers vous est soumise avant publication. Vous validez ou refusez en un clic.",
  },
  {
    title: 'Pas de faux avis, pas de contenus trompeurs',
    text: "Nous ne rédigeons ni n'achetons d'avis. Nous aidons à demander des avis à vos vrais clients et à répondre à ceux que vous recevez, dans le respect du droit de la consommation et des règles des plateformes.",
  },
  {
    title: 'Conformité et données',
    text: "Données hébergées dans l'Union européenne, jamais revendues, supprimables à la demande, conformément au RGPD. Notre mesure du trafic venu des IA fonctionne sans cookie ni identifiant. Les statistiques publiées sont agrégées et anonymes : aucun nom d'entreprise auditée n'est publié.",
  },
  {
    title: 'Indépendance',
    text: "Repéré n'a aucun lien avec OpenAI, Google, Microsoft, Perplexity ou Anthropic, et ne perçoit aucune commission des outils ou agences mentionnés sur ce site.",
  },
];

export default async function AProposPage() {
  const [extras, houseLive] = await Promise.all([houseOrgExtras(), housePageLive()]);
  const crumbs = [
    { name: 'Accueil', path: '/' },
    { name: 'À propos', path: PATH },
  ];
  const aboutPage = {
    ...webPageLd(PATH, { name: TITLE, description: DESCRIPTION, type: 'AboutPage', dateModified: EDITORIAL_UPDATED }, { withContext: false }),
    about: { '@id': ORG_ID },
    mainEntity: { '@id': ORG_ID },
  };
  return (
    <PageShell narrow>
      <JsonLd
        data={graph([
          mergeOrg(organizationLd({ withContext: false }), extras),
          websiteLd({ withContext: false }),
          aboutPage,
          founderLd(),
          breadcrumbListLd(PATH, crumbs, { withContext: false }),
        ])}
      />
      <Crumbs items={[{ name: 'Accueil', href: '/' }, { name: 'À propos' }]} />
      <h1 className={h1Class} style={h1Style}>
        À propos de Repéré
      </h1>
      <Byline />

      <div className="mt-6 rounded-xl border-l-4 p-5 text-lg leading-relaxed" style={{ borderColor: 'var(--primary)', background: '#fff' }}>
        <p>{ONE_LINER}</p>
      </div>

      <QaSection
        id="mission"
        q="Quelle est la mission de Repéré ?"
        answer="Notre mission est de permettre aux TPE, PME et e-commerces français d'être correctement présentés et recommandés par les assistants d'IA, sans avoir besoin d'une équipe marketing ni d'un budget d'agence."
      >
        <p className="mb-3 leading-relaxed">
          De plus en plus de clients demandent à une IA quel artisan, quel prestataire ou quel produit choisir. Ces IA ne citent que quelques noms, ne
          préviennent personne et se trompent parfois. Les outils existants s&apos;adressent surtout à des équipes marketing ; les agences, à des
          entreprises qui ont du budget. Repéré se place entre les deux, en français.
        </p>
        <p className="leading-relaxed">
          Pour comprendre le sujet, lisez{' '}
          <Link href="/geo" className="underline" style={{ color: 'var(--primary)' }}>
            qu&apos;est-ce que le GEO
          </Link>{' '}
          ou notre{' '}
          <Link href="/comparatif" className="underline" style={{ color: 'var(--primary)' }}>
            comparatif avec les outils et les agences
          </Link>
          .
        </p>
      </QaSection>

      <QaSection
        id="methode"
        q="Comment travaille Repéré ?"
        answer="Repéré suit quatre étapes : mesurer ce que répondent les IA sur vos vraies questions clients, comprendre quelles sources elles lisent, agir sur ces sources et sur votre site, puis prouver l'effet chaque mois."
      >
        <ol className="mb-3 list-decimal space-y-2 pl-6 leading-relaxed">
          <li>
            <strong>Mesurer.</strong> Nous posons à ChatGPT, Gemini et Perplexity les questions de vos clients, plusieurs fois, et nous relevons qui est
            cité, à quel rang, avec une fourchette.
          </li>
          <li>
            <strong>Comprendre.</strong> Nous relevons les pages que les IA citent (annuaires, comparatifs, avis, presse, forums) et votre présence sur
            chacune, face à vos concurrents.
          </li>
          <li>
            <strong>Agir.</strong> Avec l&apos;offre Essentiel, chaque action arrive prête à copier ; avec l&apos;offre Accompagné, nous la réalisons
            après votre validation.
          </li>
          <li>
            <strong>Prouver.</strong> Chaque mois : citations, part de voix et visites venues des IA, avant et après.
          </li>
        </ol>
        <p className="leading-relaxed">
          La formule du score, ses limites et l&apos;historique des versions sont publiés sur la page{' '}
          <Link href="/methode" className="underline" style={{ color: 'var(--primary)' }}>
            Méthode
          </Link>
          . Les résultats agrégés alimenteront le{' '}
          <Link href="/etudes/barometre-visibilite-ia" className="underline" style={{ color: 'var(--primary)' }}>
            Baromètre Repéré de la visibilité IA
          </Link>
          .
        </p>
      </QaSection>

      <QaSection
        id="fondateur"
        q="Qui a fondé Repéré ?"
        answer={FOUNDER.name ? `Repéré a été fondé par ${FOUNDER.name}.` : 'Repéré a été fondé par [À COMPLÉTER : nom du fondateur].'}
      >
        <div className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row" style={{ borderColor: 'var(--line)', background: '#fff' }}>
          {FOUNDER.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={FOUNDER.image} alt={`Portrait de ${FOUNDER.name}`} width={96} height={96} className="h-24 w-24 rounded-full object-cover" />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full text-center text-xs" style={{ background: 'var(--primary-bg)' }}>
              <Hl text="[À COMPLÉTER : photo]" />
            </div>
          )}
          <div className="leading-relaxed">
            <p className="font-semibold">
              <Hl text={FOUNDER.name || '[À COMPLÉTER : nom]'} />, {FOUNDER.jobTitle}
            </p>
            <p className="mt-1">
              <Hl text={FOUNDER.bio || '[À COMPLÉTER : parcours en 2 ou 3 phrases, expérience vérifiable en référencement, marketing ou commerce local]'} />
            </p>
            <p className="mt-1">
              {FOUNDER.linkedin ? (
                <a href={FOUNDER.linkedin} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--primary)' }}>
                  Profil LinkedIn
                </a>
              ) : (
                <Hl text="[À COMPLÉTER : lien LinkedIn]" />
              )}
            </p>
          </div>
        </div>
      </QaSection>

      <QaSection
        id="engagements"
        q="Quels sont les engagements de Repéré ?"
        answer="Repéré s'engage à ne jamais promettre de position dans une IA, à conserver les réponses des IA comme preuve de chaque mesure, à ne rien publier sans votre accord et à respecter le RGPD et le droit de la consommation."
      >
        <ul className="space-y-3">
          {ENGAGEMENTS.map((e) => (
            <li key={e.title} className="rounded-xl border p-4" style={{ borderColor: 'var(--line)', background: '#fff' }}>
              <h3 className="font-semibold">{e.title}</h3>
              <p className="mt-1 leading-relaxed">{e.text}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
          Détails : <Link href="/confidentialite" className="underline">politique de confidentialité</Link>,{' '}
          <Link href="/cgv" className="underline">CGV</Link>.
        </p>
      </QaSection>

      <QaSection id="contact" q="Comment contacter Repéré ?" answer={`Écrivez-nous à ${CONTACT} : nous répondons sous 48 heures ouvrées, en français.`}>
        <ul className="list-disc space-y-1 pl-6 leading-relaxed">
          <li>
            E-mail :{' '}
            <a href={`mailto:${CONTACT}`} className="underline" style={{ color: 'var(--primary)' }}>
              {CONTACT}
            </a>
          </li>
          <li>
            <Hl text={`Raison sociale et SIREN : ${LEGAL.siren ? `${LEGAL.name || 'Repéré'}, SIREN ${LEGAL.siren}` : '[À COMPLÉTER]'}`} />
          </li>
          <li>
            <Hl text={`Adresse : ${LEGAL.street && LEGAL.city ? [LEGAL.street, [LEGAL.postalCode, LEGAL.city].filter(Boolean).join(' ')].join(', ') : '[À COMPLÉTER]'}`} />
          </li>
          {houseLive ? (
            <li>
              Fiche officielle, vérifiée par nos soins :{' '}
              <Link href={HOUSE_PAGE_PATH} className="underline" style={{ color: 'var(--primary)' }}>
                Repéré, informations et questions fréquentes
              </Link>
            </li>
          ) : null}
          <li>
            Informations légales complètes : <Link href="/mentions-legales" className="underline">mentions légales</Link>
          </li>
        </ul>
        <p className="mt-3 leading-relaxed">
          Vous avez repéré une erreur dans un de nos contenus ? Écrivez-nous : nous vérifions et corrigeons, en indiquant la date de mise à jour.
        </p>
      </QaSection>

      <AuditCta />
      <RelatedLinks current={PATH} />
    </PageShell>
  );
}
