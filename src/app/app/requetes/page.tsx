import { permanentRedirect } from 'next/navigation';

// Écran V1 « Requêtes » : remplacé en V3 par les questions suivies.
export default function Page() {
  permanentRedirect('/app/questions');
}
