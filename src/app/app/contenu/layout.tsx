// Agent de contenu (V8) : données chargées une fois pour toutes les sections, état partagé côté navigateur.
import '@/components/app/agent/agent.css';
import '@/components/app/contenu/contenu.css';
import { loadContent } from '@/components/app/contenu/server';
import { ContentProvider } from '@/components/app/contenu/state';

export default async function ContenuLayout({ children }: { children: React.ReactNode }) {
  const d = await loadContent();
  return <ContentProvider initial={d}>{children}</ContentProvider>;
}
