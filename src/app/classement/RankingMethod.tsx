import { CONTACT_EMAIL } from '@/lib/seo/site';
import { RANKING_MAX_AGE_DAYS, RANKING_MIN_ENTRIES } from '@/lib/growth/constants';
import { h2Class } from '@/lib/seo/shell';

/** Méthode et règles du classement (affichée sur toutes les pages, vides ou remplies). */
export function RankingMethod() {
  return (
    <section aria-labelledby="methode-classement">
      <h2 id="methode-classement" className={h2Class}>
        Méthode et règles
      </h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>
          <strong>Inscription volontaire.</strong> Un commerce n’apparaît qu’après avoir coché la case d’inscription, avec un aperçu de ce qui est publié (nom, métier, ville, taux de citation, date). Il peut se retirer à tout moment, le retrait est immédiat.
        </li>
        <li>
          <strong>Mesure réelle uniquement.</strong> Chaque commerce est mesuré lors de son audit, en interrogeant des assistants IA avec des questions de client construites de la même façon (métier et ville). Aucune simulation, aucune donnée de démonstration.
        </li>
        <li>
          <strong>Classement par taux de citation</strong> : part des réponses exploitables qui citent le commerce. Les égalités partagent le même rang.
        </li>
        <li>
          <strong>Mesures datées.</strong> Seules les mesures de moins de {RANKING_MAX_AGE_DAYS} jours comptent. Les mesures n’ont pas toutes lieu le même jour, la date de chaque mesure est affichée.
        </li>
        <li>
          <strong>Seuil de {RANKING_MIN_ENTRIES} commerces</strong> par métier et par ville avant toute publication : en dessous, la page reste « en préparation » et n’est pas indexée.
        </li>
        <li>
          <strong>Limites.</strong> Les commerces déjà visibles s’inscrivent plus volontiers ; les réponses des IA varient d’une fois à l’autre. Ce classement mesure la citation par les IA, pas la qualité du service ni les avis.
        </li>
        <li>
          <strong>Rectification ou retrait :</strong> <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </li>
      </ul>
    </section>
  );
}
