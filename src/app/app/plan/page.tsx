import { redirect } from 'next/navigation';

// Écran V1 remplacé : redirection vers le Centre d'actions (V3).
export default function Page() {
  redirect('/app/actions');
}
