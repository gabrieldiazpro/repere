import type { ReactNode } from 'react';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';

/** Mise en page commune de /connexion, /inscription et /bienvenue. */
export function AuthShell({ title, intro, children, aside }: { title: string; intro?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <>
      <Header />
      <main id="contenu" className="bg-canvas">
        <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-12 sm:py-16">
          <div>
            <h1 className="font-display text-3xl font-bold text-ink">{title}</h1>
            {intro && <div className="mt-2 text-muted">{intro}</div>}
          </div>
          {children}
          {aside && <div className="flex flex-col gap-2 text-sm text-muted">{aside}</div>}
        </div>
      </main>
      <Footer />
    </>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'danger' | 'success'; children: ReactNode }) {
  const cls = {
    info: 'bg-primary-bg text-primary-deep',
    warning: 'bg-warning-bg text-warning-ink',
    danger: 'bg-danger-bg text-danger-ink',
    success: 'bg-success-bg text-success-ink',
  }[tone];
  return <div role={tone === 'danger' ? 'alert' : 'status'} className={`rounded-xl p-4 text-sm ${cls}`}>{children}</div>;
}
