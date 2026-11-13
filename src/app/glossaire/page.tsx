import { pageMeta } from '@/lib/seo/meta';
import Link from 'next/link';
import { PageShell, Crumbs, JsonLd, h1Class, h1Style } from '@/lib/seo/shell';
import { Byline, RelatedLinks, AuditCta, EDITORIAL_UPDATED } from '@/lib/seo/editorial';
import { breadcrumbListLd, definedTermSetLd, graph, webPageLd, type TermInput } from '@/lib/seo/jsonld';

const PATH = '/glossaire';
const TITLE = 'Glossaire du référencement IA (GEO) : 36 définitions';
const DESCRIPTION =
  "GEO, AEO, LLM, ancrage, citation, part de voix, marge d'erreur, citabilité, indice de demande, AI Overviews, AI Mode, fiche de vérité, hallucination, OAI-SearchBot, JSON-LD… 36 termes du référencement IA définis en une ou deux phrases.";

const SEO_TITLE = "Glossaire du référencement IA : 36 définitions";

export const metadata = pageMeta({
  path: PATH,
  title: SEO_TITLE,
  ogTitle: TITLE,
  description: DESCRIPTION,
  type: 'website',
});

interface Term extends TermInput {
  group: 'Notions' | 'Mesure' | 'Google et OpenAI' | 'Technique';
  see?: { href: string; label: string };
}

const TERMS: Term[] = [
  // Notions
  {
    slug: 'geo', group: 'Notions', name: 'GEO (Generative Engine Optimization)', alternateName: ['Generative Engine Optimization', 'optimisation pour les moteurs génératifs'],
    definition: "Le GEO est l'ensemble des actions qui augmentent la probabilité qu'un assistant d'IA générative cite ou recommande une entreprise, une marque ou un produit dans ses réponses. Le terme a été défini par un article de recherche accepté à la conférence KDD 2024.",
    see: { href: '/geo', label: "Qu'est-ce que le GEO ?" },
  },
  {
    slug: 'referencement-ia', group: 'Notions', name: 'Référencement IA', alternateName: ['visibilité IA', 'SEO IA'],
    definition: "Le référencement IA est l'expression française courante pour le GEO : travailler pour être cité par ChatGPT, Gemini, Perplexity, Copilot ou Google AI Overviews. Il complète le référencement naturel sur Google, il ne le remplace pas.",
    see: { href: '/geo', label: 'Définition complète' },
  },
  {
    slug: 'aeo', group: 'Notions', name: 'AEO (Answer Engine Optimization)', alternateName: ["optimisation pour les moteurs de réponse"],
    definition: "L'AEO est l'optimisation d'un contenu pour qu'il soit repris comme réponse directe par un moteur : extrait optimisé de Google, assistant vocal ou assistant d'IA. Le terme est plus ancien et plus large que GEO, qui vise spécifiquement les IA génératives.",
  },
  {
    slug: 'llm', group: 'Notions', name: 'LLM (grand modèle de langage)', alternateName: ['Large Language Model', 'grand modèle de langage'],
    definition: "Un LLM est un modèle d'IA entraîné sur de très grands volumes de textes pour prédire et produire du langage. GPT (ChatGPT), Gemini, Claude ou Mistral sont des LLM.",
  },
  {
    slug: 'ia-generative', group: 'Notions', name: 'IA générative',
    definition: "Une IA générative produit un contenu nouveau (texte, image, son) à partir d'une demande. Selon le Baromètre du numérique 2026, 48 % des Français de 12 ans et plus en utilisaient une en 2025.",
  },
  {
    slug: 'moteur-de-reponse', group: 'Notions', name: 'Moteur de réponse', alternateName: ['answer engine', 'assistant IA'],
    definition: "Un moteur de réponse rédige une réponse à une question au lieu de renvoyer une liste de liens. ChatGPT avec recherche, Perplexity, Gemini et Google AI Mode en sont des exemples.",
  },
  {
    slug: 'ancrage', group: 'Notions', name: 'Ancrage (grounding)', alternateName: ['grounding', 'ancrage web'],
    definition: "L'ancrage consiste, pour une IA, à appuyer sa réponse sur des documents consultés au moment de la question, en général via une recherche web, plutôt que sur sa seule mémoire. C'est ce qui permet à une IA de citer des sources récentes.",
  },
  {
    slug: 'rag', group: 'Notions', name: 'RAG (génération augmentée par récupération)', alternateName: ['Retrieval-Augmented Generation'],
    definition: "Le RAG est la technique qui consiste à récupérer des documents pertinents puis à les donner au modèle pour qu'il rédige sa réponse à partir d'eux. L'ancrage web des assistants en est une forme.",
  },
  {
    slug: 'date-de-coupure', group: 'Notions', name: 'Date de coupure des connaissances', alternateName: ['knowledge cutoff'],
    definition: "La date de coupure est la date après laquelle un modèle n'a plus de données d'entraînement. Sans recherche web, une IA ignore tout ce qui a changé depuis, par exemple vos nouveaux horaires ou votre nouvelle offre.",
  },
  // Mesure
  {
    slug: 'citation', group: 'Mesure', name: 'Citation', alternateName: ['source citée'],
    definition: "Une citation est un lien ou une référence à une page source qu'une IA affiche à l'appui de sa réponse. Être cité comme source et être recommandé dans le texte de la réponse sont deux choses différentes.",
  },
  {
    slug: 'mention', group: 'Mesure', name: 'Mention',
    definition: "Une mention est l'apparition du nom d'une entreprise, d'une marque ou d'un produit dans le texte d'une réponse d'IA. C'est l'unité de base de la mesure de visibilité IA.",
  },
  {
    slug: 'taux-de-mention', group: 'Mesure', name: 'Taux de mention', alternateName: ['mention rate'],
    definition: "Le taux de mention est la part des réponses analysées qui mentionnent l'entreprise, sur un ensemble de questions posées plusieurs fois à plusieurs IA. Il s'exprime en pourcentage et doit toujours être accompagné du nombre de réponses analysées.",
    see: { href: '/methode', label: 'Notre méthode' },
  },
  {
    slug: 'part-de-voix', group: 'Mesure', name: 'Part de voix', alternateName: ['share of voice', 'SoV'],
    definition: "La part de voix est la proportion des mentions d'une entreprise parmi toutes les mentions de son marché (elle et ses concurrents) dans les réponses des IA. Elle dit qui domine les recommandations sur un ensemble de questions.",
  },
  {
    slug: 'rang', group: 'Mesure', name: 'Rang dans la réponse',
    definition: "Le rang est la position à laquelle une entreprise apparaît dans une réponse qui en recommande plusieurs. Être cité en premier n'a pas le même poids qu'être cité en cinquième.",
  },
  {
    slug: 'prompt', group: 'Mesure', name: 'Prompt (requête)', alternateName: ['requête', 'question'],
    definition: "Un prompt est la question ou l'instruction envoyée à une IA. En référencement IA, on suit un ensemble de prompts qui reproduisent les vraies questions de vos clients.",
  },
  {
    slug: 'non-determinisme', group: 'Mesure', name: 'Non-déterminisme',
    definition: "Le non-déterminisme désigne le fait qu'une IA peut donner deux réponses différentes à la même question. C'est pourquoi une mesure sérieuse pose chaque question plusieurs fois et affiche une marge d'erreur.",
  },
  {
    slug: 'trafic-ia', group: 'Mesure', name: 'Trafic IA',
    definition: "Le trafic IA est l'ensemble des visites qui arrivent sur un site depuis un assistant d'IA, repérées par leur provenance (par exemple chatgpt.com ou perplexity.ai). Une partie n'est pas identifiable, notamment celle de Google AI Mode, comptée avec la recherche classique.",
    see: { href: '/guides/trafic-chatgpt-ga4', label: 'Mesurer le trafic ChatGPT dans GA4' },
  },
  {
    slug: 'marge-d-erreur', group: 'Mesure', name: "Marge d'erreur", alternateName: ['intervalle de confiance', 'fourchette'],
    definition: "La marge d'erreur est l'écart autour d'un indicateur (par exemple « 54 ± 7 ») dans lequel la valeur se situe vraisemblablement. Chez Repéré, elle est calculée en rééchantillonnant les questions suivies et correspond à un intervalle à 90 %. Une évolution plus petite que la marge n'est pas annoncée comme une évolution.",
    see: { href: '/methode#marge-erreur', label: 'Comment nous calculons la marge' },
  },
  {
    slug: 'citabilite', group: 'Mesure', name: 'Citabilité', alternateName: ['score de citabilité'],
    definition: "La citabilité d'une page est son aptitude à fournir des passages qu'un assistant peut reprendre tels quels : réponse en tête, faits chiffrés et sourcés, date, auteur, structure claire. Notre score la note sur 100 avec 20 règles publiées. C'est une liste de bonnes pratiques, pas une mesure de ce que fait une IA.",
    see: { href: '/methode#citabilite', label: 'Les 20 règles' },
  },
  {
    slug: 'part-de-voix-par-theme', group: 'Mesure', name: 'Part de voix par thème', alternateName: ['voix par thème et par IA'],
    definition: "C'est la part de recommandations que vous obtenez sur un thème de questions (par exemple « urgence » ou « prix »), calculée séparément pour chaque IA. Elle montre où vous êtes fort ou absent. Le nombre de réponses sur lequel elle repose est toujours affiché, car une case construite sur peu de réponses reste indicative.",
    see: { href: '/methode#part-de-voix', label: 'Méthode de calcul' },
  },
  {
    slug: 'indice-de-demande', group: 'Mesure', name: 'Indice de demande', alternateName: ['estimation de la demande'],
    definition: "L'indice de demande classe une question en « faible », « moyen » ou « fort » d'après sa forme (intention, généricité, ville, quartier, nom propre). C'est une estimation étiquetée comme telle : aucune source publique fiable ne donne le nombre de fois où une question est posée aux IA, et Repéré n'affiche donc jamais de volume.",
    see: { href: '/methode#indice-demande', label: 'La règle de calcul' },
  },
  {
    slug: 'mesure-avant-apres', group: 'Mesure', name: 'Mesure avant/après', alternateName: ['impact d\'une action'],
    definition: "La mesure avant/après compare le taux de mention sur les questions liées à une action, juste avant et 14 puis 30 jours après. Le verdict tient compte de la marge d'erreur et ne parle de hausse ou de baisse que si l'écart la dépasse. C'est une corrélation, jamais la preuve que l'action a produit l'effet.",
    see: { href: '/methode#avant-apres', label: 'Comment nous la mesurons' },
  },
  {
    slug: 'user-agent', group: 'Technique', name: 'User agent', alternateName: ['agent utilisateur'],
    definition: "Le user agent est le nom qu'un robot ou un navigateur déclare à chaque requête. Le robots.txt s'en sert pour appliquer des règles par robot (GPTBot, OAI-SearchBot, RepereBot…). Il peut être usurpé : seule une comparaison avec les adresses IP publiées par l'éditeur confirme l'origine d'une visite.",
    see: { href: '/methode/robot', label: 'RepereBot, notre robot' },
  },
  // Google et OpenAI
  {
    slug: 'ai-overviews', group: 'Google et OpenAI', name: 'AI Overviews (aperçus IA)', alternateName: ['aperçus IA', 'résumés IA de Google'],
    definition: "Les AI Overviews sont les résumés générés par l'IA de Google affichés en haut de certains résultats de recherche, avec des liens vers des sources. Ils sont disponibles en France depuis le 22 juillet 2026.",
  },
  {
    slug: 'ai-mode', group: 'Google et OpenAI', name: 'AI Mode (mode IA de Google)', alternateName: ['mode IA'],
    definition: "AI Mode est le mode de recherche conversationnel de Google, où la réponse entière est rédigée par l'IA à partir de plusieurs recherches. Ses clics sont comptés avec la recherche classique dans Search Console, sans filtre dédié.",
  },
  {
    slug: 'query-fan-out', group: 'Google et OpenAI', name: 'Query fan-out', alternateName: ['éclatement de requête'],
    definition: "Le query fan-out est la technique par laquelle une IA décompose une question en plusieurs recherches sur des sous-thèmes, puis combine les résultats. Google indique qu'AI Overviews et AI Mode peuvent l'utiliser.",
  },
  {
    slug: 'recherche-chatgpt', group: 'Google et OpenAI', name: 'Recherche ChatGPT (ChatGPT search)', alternateName: ['ChatGPT search'],
    definition: "La recherche ChatGPT est la fonction qui permet à ChatGPT de consulter le web au moment de la question et d'afficher ses sources. Selon OpenAI, elle peut transmettre des requêtes à des fournisseurs de recherche tiers comme Bing.",
  },
  {
    slug: 'oai-searchbot', group: 'Google et OpenAI', name: 'OAI-SearchBot',
    definition: "OAI-SearchBot est le robot d'OpenAI qui explore le web pour la recherche de ChatGPT. Selon OpenAI, un site qui le bloque dans son robots.txt n'est pas affiché dans les réponses de recherche de ChatGPT.",
  },
  {
    slug: 'gptbot', group: 'Google et OpenAI', name: 'GPTBot',
    definition: "GPTBot est le robot d'OpenAI qui collecte des pages pouvant servir à entraîner ses modèles. Le bloquer n'empêche pas d'apparaître dans la recherche de ChatGPT, qui dépend d'OAI-SearchBot.",
  },
  {
    slug: 'chatgpt-user', group: 'Google et OpenAI', name: 'ChatGPT-User',
    definition: "ChatGPT-User est l'agent qui visite une page quand un utilisateur de ChatGPT pose une question qui y renvoie. Ce n'est pas un robot d'exploration automatique, et OpenAI précise que robots.txt peut ne pas s'y appliquer.",
  },
  {
    slug: 'google-extended', group: 'Google et OpenAI', name: 'Google-Extended',
    definition: "Google-Extended est un jeton de robots.txt qui permet de refuser l'usage de ses pages pour entraîner et ancrer les modèles Gemini. Il n'a pas d'effet sur la présence dans la recherche Google, AI Overviews compris.",
  },
  // Technique
  {
    slug: 'fiche-de-verite', group: 'Technique', name: 'Fiche de vérité', alternateName: ['référentiel de faits'],
    definition: "La fiche de vérité est la liste de référence des informations exactes d'une entreprise (nom, adresse, téléphone, horaires, prix, services) validée par le dirigeant. Elle sert à détecter les erreurs des IA et à corriger les sources qui les propagent.",
    see: { href: '/guides/ia-disent-des-choses-fausses', label: 'Corriger les erreurs des IA' },
  },
  {
    slug: 'hallucination', group: 'Technique', name: 'Hallucination',
    definition: "Une hallucination est une information fausse présentée avec assurance par une IA, par exemple un mauvais numéro de téléphone ou un service que l'entreprise ne propose pas. Selon Insites, ChatGPT n'avait toutes les informations exactes que pour 56 % de 10 000 commerces américains étudiés.",
  },
  {
    slug: 'robots-txt', group: 'Technique', name: 'robots.txt',
    definition: "Le robots.txt est un fichier placé à la racine d'un site qui indique aux robots ce qu'ils peuvent explorer. C'est là qu'on autorise ou bloque OAI-SearchBot, GPTBot, PerplexityBot ou Google-Extended.",
  },
  {
    slug: 'llms-txt', group: 'Technique', name: 'llms.txt',
    definition: "Le llms.txt est une proposition de fichier qui résume un site pour les modèles de langage. En juin 2025, Google a déclaré qu'aucun système d'IA ne l'utilisait ; il ne fait donc pas citer une entreprise à lui seul.",
  },
  {
    slug: 'json-ld', group: 'Technique', name: 'JSON-LD (données structurées schema.org)', alternateName: ['schema.org', 'données structurées'],
    definition: "Le JSON-LD est le format recommandé par Google pour décrire les informations d'une page (organisation, commerce, produit, FAQ) avec le vocabulaire schema.org. Il rend ces informations lisibles par les machines, sans être une condition pour apparaître dans les réponses des IA.",
  },
];

const GROUPS = ['Notions', 'Mesure', 'Google et OpenAI', 'Technique'] as const;

export default function GlossairePage() {
  const crumbs = [
    { name: 'Accueil', path: '/' },
    { name: 'Glossaire', path: PATH },
  ];
  return (
    <PageShell narrow>
      <JsonLd
        data={graph([
          webPageLd(PATH, { name: TITLE, description: DESCRIPTION, dateModified: EDITORIAL_UPDATED }, { withContext: false }),
          definedTermSetLd(PATH, 'Glossaire du référencement IA (Repéré)', TERMS, { withContext: false }),
          breadcrumbListLd(PATH, crumbs, { withContext: false }),
        ])}
      />
      <Crumbs items={[{ name: 'Accueil', href: '/' }, { name: 'Glossaire' }]} />
      <h1 className={h1Class} style={h1Style}>
        Glossaire du référencement IA
      </h1>
      <Byline />
      <p className="mt-6 text-lg leading-relaxed">
        Ce glossaire définit les {TERMS.length} termes les plus utilisés du GEO, ou référencement IA, en une ou deux phrases chacun. Chaque
        terme a son ancre : vous pouvez citer directement une définition. Pour une vue d&apos;ensemble, commencez par{' '}
        <Link href="/geo" className="underline" style={{ color: 'var(--primary)' }}>
          qu&apos;est-ce que le GEO
        </Link>
        .
      </p>

      <nav aria-label="Index des termes" className="mt-8 rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--line)', background: '#fff' }}>
        {GROUPS.map((g) => (
          <div key={g} className="mb-2 last:mb-0">
            <span className="font-semibold">{g} : </span>
            {TERMS.filter((t) => t.group === g).map((t, i, arr) => (
              <span key={t.slug}>
                <a href={`#${t.slug}`} className="underline underline-offset-2">
                  {t.name.split(' (')[0]}
                </a>
                {i < arr.length - 1 ? ' · ' : ''}
              </span>
            ))}
          </div>
        ))}
      </nav>

      {GROUPS.map((g) => (
        <section key={g} aria-labelledby={`groupe-${g}`}>
          <h2 id={`groupe-${g}`} className="mt-12 mb-4 font-semibold text-2xl">
            {g}
          </h2>
          <dl className="space-y-4">
            {TERMS.filter((t) => t.group === g).map((t) => (
              <div key={t.slug} id={t.slug} className="scroll-mt-20 rounded-xl border p-4" style={{ borderColor: 'var(--line)', background: '#fff' }}>
                <dt className="font-semibold text-lg">
                  <a href={`#${t.slug}`} className="hover:underline">
                    {t.name}
                  </a>
                </dt>
                <dd className="mt-1 leading-relaxed">
                  {t.definition}
                  {t.see && (
                    <>
                      {' '}
                      <Link href={t.see.href} className="whitespace-nowrap underline" style={{ color: 'var(--primary)' }}>
                        {t.see.label}
                      </Link>
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <p className="mt-8 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
        Les définitions qui mentionnent des chiffres ou des règles d&apos;OpenAI et de Google renvoient aux sources primaires listées sur la page{' '}
        <Link href="/geo#sources" className="underline">
          Qu&apos;est-ce que le GEO
        </Link>{' '}
        (documentation OpenAI et Google Search Central, Baromètre du numérique 2026, étude Insites). Un terme manque ? Écrivez-nous depuis la page{' '}
        <Link href="/a-propos" className="underline">
          À propos
        </Link>
        .
      </p>
      <AuditCta />
      <RelatedLinks current={PATH} />
    </PageShell>
  );
}
