import { redirect } from 'next/navigation';

/** Entrée du parcours local : la fiche Google d'abord (première source lue par les IA). */
export default function LocalIndex() {
  redirect('/app/local/fiche-google');
}
