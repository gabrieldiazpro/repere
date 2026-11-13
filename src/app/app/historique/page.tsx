import { permanentRedirect } from 'next/navigation';

// Écran V1 « Historique » : remplacé en V3 par la comparaison des réponses entre deux dates
// (l'historique par question est dans /app/questions/[id]).
export default function Page() {
  permanentRedirect('/app/reponses?comparer=1&periode=tout');
}
