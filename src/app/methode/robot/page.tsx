import Link from 'next/link';
import { JsonLd, Card, h2Class } from '@/lib/seo/shell';
import { EditorialFrame } from '@/components/pages/v4/Editorial';
import { pageMeta } from '@/lib/seo/meta';
import { Byline, RelatedLinks } from '@/lib/seo/editorial';
import { PAGE_UPDATED, CONTACT_EMAIL } from '@/lib/seo/site';
import { articleLd, breadcrumbListLd, graph, webPageLd } from '@/lib/seo/jsonld';

const PATH = '/methode/robot';
const TITLE = 'RepereBot : le robot de Repéré (user agent, ce qu’il lit, comment le bloquer)';
const DESCRIPTION =
  'RepereBot est le robot de Repéré. Il ne lit que des pages demandées par un utilisateur, respecte votre robots.txt, n’exécute aucun JavaScript et ne conserve pas le contenu des pages. Voici comment l’identifier et le bloquer.';
const UPDATED = PAGE_UPDATED['/methode'];

export const metadata = pageMeta({ path: PATH, title: 'RepereBot, le robot de Repéré', ogTitle: TITLE, description: DESCRIPTION, type: 'article', publishedTime: '2026-11-09', modifiedTime: UPDATED });

const TOC = [
  { id: 'identifier', label: 'Comment l’identifier' },
  { id: 'passage', label: 'Quand il passe, et ce qu’il lit' },
  { id: 'conservation', label: 'Ce que nous conservons' },
  { id: 'bloquer', label: 'Comment le bloquer' },
  { id: 'signalement', label: 'Une question, un signalement' },
];

export default function RobotPage() {
  return (
    <EditorialFrame
      head={
      <JsonLd
        data={graph([
          webPageLd(PATH, { name: TITLE, description: DESCRIPTION, dateModified: UPDATED }, { withContext: false }),
          articleLd({ path: PATH, type: 'TechArticle', headline: TITLE, description: DESCRIPTION, datePublished: '2026-11-09', dateModified: UPDATED, withContext: false }),
          breadcrumbListLd(PATH, [{ name: 'Accueil', path: '/' }, { name: 'Méthode', path: '/methode' }, { name: 'RepereBot', path: PATH }], { withContext: false }),
        ])}
      />
      }
      crumbs={[{ name: 'Accueil', href: '/' }, { name: 'Méthode', href: '/methode' }, { name: 'RepereBot' }]}
      title="RepereBot, le robot de Repéré"
      meta={<Byline published="2026-11-09" updated={UPDATED} />}
      intro={<p>Si vous avez vu <code>RepereBot</code> dans vos journaux, c’est qu’un utilisateur de Repéré a demandé la lecture d’une page de votre site, ou qu’une page de votre site a été citée dans une
        réponse d’IA que nous analysons. <strong>RepereBot ne parcourt pas le web</strong> : il ne suit pas les liens de page en page pour constituer un index, et il ne sert pas à entraîner un modèle.</p>}
      toc={TOC}
    >
      <>
      <h2 id="identifier" className={h2Class}>Comment l’identifier</h2>
      <Card>
        <p className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>User agent</p>
        <p className="mt-1 relative overflow-x-auto font-mono text-sm sm:text-base">RepereBot/1.0 (+https://repere-ia.fr/methode/robot)</p>
      </Card>
      <p className="mt-3 leading-relaxed">
        Le jeton à utiliser dans votre robots.txt est <code>RepereBot</code>. Nous ne publions pas de liste d’adresses IP : elles changent avec l’hébergeur. Les requêtes se font sur les ports 80 et 443 seulement.
        Si vous voyez ce nom depuis une adresse que vous jugez suspecte, écrivez-nous : n’importe qui peut recopier un user agent.
      </p>

      <h2 id="passage" className={h2Class}>Quand il passe, et ce qu’il lit</h2>
      <ul className="list-disc space-y-2 pl-6 leading-relaxed">
        <li><strong>Les outils gratuits et l’audit de site</strong> : quand quelqu’un saisit une adresse (la sienne ou celle d’un concurrent) dans nos <Link href="/methode#citabilite" className="underline">audits de page et de site</Link>, RepereBot lit cette page, votre <code>robots.txt</code>, parfois votre <code>sitemap.xml</code> et votre <code>llms.txt</code>.</li>
        <li><strong>La vérification des sources citées</strong> : pour quelques pages prioritaires citées par une IA, une seule requête légère vérifie si une entreprise y est mentionnée. Nous ne requêtons jamais les grandes plateformes qui réservent l’accès automatisé à leur API (réseaux sociaux, Reddit, Tripadvisor, Amazon, Google…).</li>
        <li><strong>Le HTML initial seulement</strong> : aucun JavaScript n’est exécuté, comme le font la plupart des robots d’IA. Les images, vidéos et scripts ne sont pas téléchargés.</li>
        <li><strong>Des limites strictes</strong> : 8 secondes au plus par requête, 2 Mo au plus par page (après décompression), 5 redirections au plus, et un cache de 10 minutes pour ne pas relire la même page à répétition.</li>
        <li><strong>Un robot prudent</strong> : il refuse les adresses privées ou locales, et il ne contourne ni connexion, ni mot de passe, ni accès restreint.</li>
      </ul>

      <h2 id="conservation" className={h2Class}>Ce que nous conservons</h2>
      <p className="leading-relaxed">
        Le résultat de l’audit (les contrôles, leurs verdicts, des extraits courts pour illustrer une règle) et, pour la vérification des sources, le seul verdict « présent », « absent » ou « inconnu ». Nous ne conservons pas
        une copie des pages lues et nous ne les utilisons pas pour entraîner de modèle. Voir la <Link href="/confidentialite" className="underline">politique de confidentialité</Link>.
      </p>

      <h2 id="bloquer" className={h2Class}>Comment le bloquer</h2>
      <p className="leading-relaxed">RepereBot respecte votre <code>robots.txt</code> : il cherche d’abord un groupe <code>RepereBot</code>, sinon le groupe <code>*</code>. Pour lui interdire tout votre site :</p>
      <pre className="mt-3 relative overflow-x-auto rounded-lg border p-4 font-mono text-sm" style={{ background: '#fff', borderColor: 'var(--line)' }}>{`User-agent: RepereBot
Disallow: /`}</pre>
      <p className="mt-3 leading-relaxed">Pour lui interdire seulement un dossier :</p>
      <pre className="mt-3 relative overflow-x-auto rounded-lg border p-4 font-mono text-sm" style={{ background: '#fff', borderColor: 'var(--line)' }}>{`User-agent: RepereBot
Disallow: /espace-prive/`}</pre>
      <p className="mt-3 leading-relaxed">
        Quand il est bloqué, l’outil affiche le message « Le robots.txt du site interdit l’accès à notre robot (RepereBot) : nous respectons ce choix » et ne lit pas la page. La prise en compte est immédiate : le robots.txt est relu à chaque audit
        (hors cache de 10 minutes).
      </p>
      <p className="mt-3 leading-relaxed">
        <strong>Bloquer RepereBot n’a aucun effet sur votre visibilité dans ChatGPT, Perplexity, Gemini ou Google</strong> : ces IA utilisent leurs propres robots. Pour les choisir, lisez le guide{' '}
        <Link href="/guides/robots-ia-robots-txt" className="underline">Robots d’IA : lesquels autoriser dans votre robots.txt</Link>.
      </p>

      <h2 id="signalement" className={h2Class}>Une question, un signalement</h2>
      <p className="leading-relaxed">
        Un comportement inattendu (trop de requêtes, une page lue malgré un blocage) ? Écrivez à <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a> en indiquant l’heure, l’adresse lue et la ligne de journal :
        nous vérifions et répondons. Le fonctionnement général de nos mesures est décrit sur la page <Link href="/methode" className="underline">Méthode</Link>.
      </p>
      <RelatedLinks current={PATH} />
      </>
    </EditorialFrame>
  );
}
