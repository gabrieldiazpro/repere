import Link from 'next/link';
import { Card, h2Class } from '@/lib/seo/shell';
import { CITABILITY_RULES, CITABILITY_TOTAL } from './rules';

const DEMAND_ROWS = [
  ['Intention', 'recommandation, proximité : +2 ; avis, urgence, prix, où acheter : +1 ; comparatif, alternative, service précis : 0 ; question sur une marque nommée : −1'],
  ['Généricité', '3 mots porteurs de sens ou moins : +2 ; 4 à 6 mots : +1 ; 7 mots ou plus : 0'],
  ['Ville', 'grande ville (plus de 150 000 habitants) : 0 ; ville moyenne ou petite : −1'],
  ['Quartier', 'quartier, arrondissement ou code postal cité : −1'],
  ['Nom propre', 'la question cite le commerce ou un concurrent : −1'],
];

const READINESS_ROWS = [
  ['Robots d’IA', 'Pour chacun des robots suivis, votre robots.txt l’autorise-t-il, le bloque-t-il, ou ne dit-il rien ? Ligne concernée à l’appui.'],
  ['Rendu sans JavaScript', 'Le texte de la page est-il dans le HTML initial, que les robots d’IA lisent sans exécuter de JavaScript ?'],
  ['Données structurées', 'Un JSON-LD est-il présent, valide, et complet pour son type ?'],
  ['Bases techniques', 'Code de réponse, HTTPS, indexabilité, balises title, description et H1, adresse canonique, langue, sitemap, poids de la page, temps de réponse brut, Open Graph.'],
];

export function MethodV3Sections() {
  return (
    <>
      <h2 id="questions-personnalisees" className={h2Class}>Vos propres questions</h2>
      <p className="leading-relaxed">
        Le test gratuit utilise nos requêtes types. Avec un compte, vous suivez <strong>vos</strong> questions : celles que vos clients posent vraiment. Vous pouvez remplacer
        les questions types ou les compléter, leur donner un thème et des étiquettes (service, produit, ville, concurrent), importer une liste depuis un fichier CSV ou un texte collé,
        ou partir de nos suggestions, construites à partir de l&apos;adresse de votre site, de votre secteur et de vos concurrents. Deux questions quasi identiques (même intention,
        mots porteurs de sens en commun à plus de 80 %) sont fusionnées pour ne pas compter deux fois la même chose.
      </p>
      <p className="mt-3 leading-relaxed">
        Le nombre de questions suivies dépend de l&apos;offre : 5 en Découverte, puis de 20 à 100 selon le parcours et l&apos;offre (voir <Link href="/tarifs" className="underline">les tarifs</Link>).
        La liste est figée entre deux mesures : on ne change pas la règle du jeu en cours de route. Quand vous la modifiez, la date du changement est conservée, pour ne pas comparer
        des mesures qui ne portent pas sur les mêmes questions. Le score est calculé sur les questions de recommandation ; les questions qui nomment votre marque servent à la perception et à la vérification des faits.
      </p>

      <h2 id="ia-suivies" className={h2Class}>Les IA suivies</h2>
      <p className="leading-relaxed">
        ChatGPT, Perplexity, Gemini et Claude, et, en option, <strong>Mistral (Le Chat)</strong>. Le nombre d&apos;IA dépend de l&apos;offre : 3 en Découverte, 3 ou 4 en Essentiel, 4 ou 5 en Accompagné.
        Mistral est interrogé par son interface de conversation avec recherche web ; il n&apos;est suivi que sur les offres qui l&apos;incluent, car chaque appel avec recherche web a un coût.
        Il alimente le pilier Sources, car l&apos;API renvoie les adresses des pages utilisées. Les adresses sont celles que l&apos;API fournit, pas une reconstitution.
      </p>

      <h2 id="marge-erreur" className={h2Class}>La marge d’erreur, indicateur par indicateur</h2>
      <p className="leading-relaxed">
        Le score, le taux de mention et la part de voix sont affichés <strong>avec une marge</strong> (par exemple « 54 ± 7 »). Elle est calculée par rééchantillonnage des questions
        (méthode du bootstrap : 500 tirages avec remise des questions suivies) et correspond à l&apos;intervalle où l&apos;indicateur se situe 9 fois sur 10. On rééchantillonne les
        <em> questions</em> et non les réponses, parce que les réponses à une même question ne sont pas indépendantes. Plus vous suivez de questions et plus vous les répétez, plus la marge se resserre.
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
        <li><strong>Une évolution plus petite que la marge n’est pas annoncée comme une évolution.</strong> Elle est présentée comme « stable ».</li>
        <li>Sur la mesure avant/après d’une action, la marge est celle d’une différence de deux proportions, à 95 %, avec un lissage pour ne jamais afficher une marge nulle à 0 % ou 100 %.</li>
        <li>L’indice de confiance (faible, moyenne, bonne) combine le nombre de réponses valides, la largeur de la fourchette et l’accord entre les IA. Il est « faible » dès qu’une réponse est simulée ou qu’une seule IA a répondu.</li>
      </ul>

      <h2 id="part-de-voix" className={h2Class}>Part de voix par thème et par IA</h2>
      <p className="leading-relaxed">
        Chaque question porte un thème. Pour chaque couple thème × IA, nous comptons vos citations et celles de chaque concurrent, et nous en tirons votre part de voix et le classement des
        dix entreprises les plus citées. Le dénominateur (nombre de réponses) est toujours affiché : une case construite sur peu de réponses est signalée comme indicative. Les pourcentages
        ne sont jamais moyennés entre eux : nous additionnons numérateurs et dénominateurs.
      </p>

      <h2 id="pages-citees" className={h2Class}>Les pages citées, une par une</h2>
      <p className="leading-relaxed">
        En plus des domaines, nous agrégeons les adresses de pages citées, avec le nombre de réponses, les questions et les IA concernées. Les paramètres de suivi sont retirés avant le
        comptage. Quand deux mesures se suivent, les pages apparues ou disparues sont conservées dans l&apos;historique, ce qui alimente la fonction « Expliquer ce changement ».
      </p>

      <h2 id="expliquer" className={h2Class}>Expliquer un changement</h2>
      <p className="leading-relaxed">
        Entre deux mesures, nous listons ce qui a bougé : questions gagnées ou perdues, IA, sources apparues ou disparues, concurrents qui montent ou descendent. Chaque variation est comparée à la marge
        d&apos;erreur des deux mesures : si elle reste dans le bruit, nous le disons. Ce sont des constats, pas des preuves de cause : une source disparue peut coïncider avec une baisse sans l&apos;expliquer.
      </p>

      <h2 id="indice-demande" className={h2Class}>L’indice de demande : une estimation, pas un volume</h2>
      <p className="leading-relaxed">
        Aucune source publique fiable ne donne le nombre de fois où une question est posée aux IA. <strong>Nous n’affichons donc jamais de volume chiffré.</strong> Chaque question reçoit un
        indice « faible », « moyen » ou « fort », toujours étiqueté <em>estimation</em>, calculé par une règle fixe à partir de la forme de la question. Même question, même indice : il n’y a ni appel
        réseau ni IA dans le calcul. Il sert à choisir et trier des questions, pas à prévoir du trafic.
      </p>
      <p className="mt-3 relative overflow-x-auto rounded-lg border p-4 font-mono text-sm sm:text-base" style={{ background: '#fff', borderColor: 'var(--line)' }}>
        points = intention + généricité − ville − quartier − nom propre
      </p>
      <div className="mt-3 relative overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead><tr>{['Signal', 'Points'].map((h) => <th key={h} className="border-b p-2" style={{ borderColor: 'var(--line)' }}>{h}</th>)}</tr></thead>
          <tbody>
            {DEMAND_ROWS.map(([s, p]) => (
              <tr key={s}><td className="border-b p-2 font-semibold" style={{ borderColor: 'var(--line)' }}>{s}</td><td className="border-b p-2" style={{ borderColor: 'var(--line)' }}>{p}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 leading-relaxed">
        Niveau « fort » à partir de 3 points, « moyen » à 1 ou 2, « faible » à 0 ou moins. Les signaux retenus sont affichés avec l&apos;indice, pour que vous voyiez pourquoi. Une question « faible » peut être
        très rentable : une demande précise vient souvent d&apos;un client prêt à acheter. La règle ne change qu&apos;avec une nouvelle version de cette page.
      </p>

      <h2 id="citabilite" className={h2Class}>L’audit d’une page : 20 règles publiées</h2>
      <p className="leading-relaxed">
        Le score de citabilité note une page sur 100 selon {CITABILITY_RULES.length} règles de rédaction, sans IA : chaque règle rapporte tous ses points si elle est respectée, la moitié si elle l’est
        partiellement, aucun sinon. Le total des points est de {CITABILITY_TOTAL}. <strong>C’est une liste de bonnes pratiques, pas une mesure de ce que fait ChatGPT</strong> : une page peut cocher toutes les cases
        sans être citée. Seul l’audit des réponses réelles le mesure. Le guide <Link href="/guides/page-que-les-ia-citent" className="underline">Écrire une page que les IA citent</Link> les regroupe en 9 principes.
      </p>
      <div className="mt-3 relative overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
          <thead><tr>{['Règle', 'Points', 'Ce que nous vérifions'].map((h) => <th key={h} className="border-b p-2" style={{ borderColor: 'var(--line)' }}>{h}</th>)}</tr></thead>
          <tbody>
            {CITABILITY_RULES.map((r) => (
              <tr key={r.id}>
                <td className="border-b p-2 font-semibold" style={{ borderColor: 'var(--line)' }}>{r.label}</td>
                <td className="border-b p-2" style={{ borderColor: 'var(--line)' }}>{r.points}</td>
                <td className="border-b p-2" style={{ borderColor: 'var(--line)' }}>{r.test}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mt-6 mb-2 font-semibold text-lg">L’audit « prêt pour les IA » d’un site</h3>
      <p className="mb-3 leading-relaxed">
        Il note un site sur 100 et plafonne le score quand un défaut est bloquant (par exemple un robot de recherche d’IA interdit dans le robots.txt). Il lit votre site comme le fait un robot : sans JavaScript.
      </p>
      <div className="relative overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <tbody>
            {READINESS_ROWS.map(([s, p]) => (
              <tr key={s}><td className="border-b p-2 font-semibold" style={{ borderColor: 'var(--line)' }}>{s}</td><td className="border-b p-2" style={{ borderColor: 'var(--line)' }}>{p}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 leading-relaxed">
        Le fichier llms.txt est proposé mais ne compte pas dans la note : aucune étude ne montre à ce jour d’effet sur les citations. Nos outils de lecture se présentent comme{' '}
        <Link href="/methode/robot" className="underline">RepereBot</Link> et respectent votre robots.txt.
      </p>

      <h2 id="quartiers" className={h2Class}>La carte par quartier : une simulation</h2>
      <p className="leading-relaxed">
        Pour un commerce local, la carte de visibilité par quartier pose la même question en remplaçant chaque fois le quartier (« plombier près de la Croix-Rousse », « plombier dans le 7e »…) et
        regarde si vous êtes cité. <strong>C’est une simulation, étiquetée comme telle</strong> : les IA ne connaissent pas votre position réelle via l’API, et le quartier injecté dans la phrase
        n’est pas celui d’un vrai utilisateur géolocalisé. Elle indique où vous êtes cité quand on nomme un quartier, pas combien de clients s’y trouvent. Chaque case affiche son nombre de réponses.
      </p>

      <h2 id="avant-apres" className={h2Class}>La mesure avant / après une action</h2>
      <p className="leading-relaxed">
        Quand une tâche est marquée « faite », nous figeons l’état « avant » (taux de mention sur les questions liées à la tâche : celles qui visent la source concernée, à défaut celles où vous n’êtes pas cité,
        6 au plus). Nous relançons ensuite ces seules questions 14 jours puis 30 jours plus tard. Le verdict est « hausse » ou « baisse » seulement si l’écart dépasse la marge d’erreur ; sinon « stable » ; avec moins de 6 réponses
        d’un côté, « insuffisant ». <strong>C’est une corrélation, pas une preuve</strong> : d’autres changements ont pu avoir lieu entre-temps, et les IA varient d’une réponse à l’autre.
      </p>

      <h2 id="donnees-sortantes" className={h2Class}>Partage, exports et notifications</h2>
      <ul className="list-disc space-y-2 pl-6 leading-relaxed">
        <li><strong>Lien de partage public</strong> : un rapport ou un tableau de bord en lecture seule, par un lien à jeton aléatoire, avec expiration (90 jours par défaut), mot de passe facultatif, révocation à tout moment. La vue publique ne contient jamais d’e-mail, de tâche ni de fiche de vérité.</li>
        <li><strong>Exports CSV</strong> : questions, réponses brutes, sources, pages citées, concurrents, tâches, trafic, historique des scores. Ils ne contiennent aucune donnée de contact.</li>
        <li><strong>Slack et webhook</strong> : messages à la fin d’une mesure, à une nouvelle alerte, à une tâche faite ; le webhook générique est signé (HMAC-SHA256) pour que vous puissiez vérifier son origine.</li>
      </ul>

      <h2 id="ai-overviews" className={h2Class}>Ce que nous ne mesurons pas</h2>
      <p className="leading-relaxed">
        Les <strong>aperçus IA de Google (AI Overviews) et le mode IA de Google (AI Mode) ne sont pas suivis</strong> : Google ne propose pas d’interface fiable pour les interroger, et nous préférons
        ne rien afficher plutôt qu’un chiffre approximatif. Votre présence dans l’index de Google (Googlebot) reste un prérequis, et l’audit « prêt pour les IA » la vérifie. Les concurrents qui les suivent
        le font avec leurs propres méthodes ; voir <Link href="/comparatif" className="underline">le comparatif</Link>.
      </p>
      <Card className="mt-4">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Une question sur la méthode, une erreur à nous signaler ? Écrivez-nous depuis <Link href="/a-propos" className="underline">À propos</Link> : chaque correction est datée dans l’historique ci-dessous.
        </p>
      </Card>
    </>
  );
}
