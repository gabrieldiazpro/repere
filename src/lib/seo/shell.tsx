import type { ReactNode } from 'react';
import Link from 'next/link';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { jsonLdString } from './index';
import { breadcrumbListLd } from './jsonld';

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}

export function PageShell({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return (
    <>
      <Header />
      <main id="contenu" className={`mx-auto w-full px-4 py-10 sm:px-6 ${narrow ? 'max-w-3xl' : 'max-w-5xl'}`} style={{ color: 'var(--ink)' }}>
        {children}
      </main>
      <Footer />
    </>
  );
}

export function Crumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="mb-6 text-sm" style={{ color: 'var(--muted)' }}>
      <ol className="flex flex-wrap gap-x-2 gap-y-1">
        {items.map((it, i) => (
          <li key={it.name} className="flex gap-2">
            {it.href ? (
              <Link href={it.href} className="underline underline-offset-2 hover:no-underline">
                {it.name}
              </Link>
            ) : (
              <span aria-current="page">{it.name}</span>
            )}
            {i < items.length - 1 && <span aria-hidden>/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export const h1Class = 'font-semibold text-3xl sm:text-4xl leading-tight tracking-tight';
export const h1Style = { fontFamily: 'var(--font-display, "Bricolage Grotesque", sans-serif)' } as const;
export const h2Class = 'mt-12 mb-4 font-semibold text-2xl';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border p-5 ${className}`}
      style={{ borderColor: 'var(--line)', background: '#fff' }}
    >
      {children}
    </div>
  );
}

export function CtaLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-lg px-5 py-3 font-semibold text-white"
      style={{ background: 'var(--primary)' }}
    >
      {children}
    </Link>
  );
}

/** Met en évidence les placeholders [À COMPLÉTER] / [À VÉRIFIER] / [...] dans un texte. */
export function Hl({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\[[^\]]+\]$/.test(p) ? (
          <mark
            key={i}
            className="rounded px-1 font-medium"
            style={{ background: 'var(--warning-bg, #FEF3C7)', color: 'var(--warning-ink, #78350F)' }}
          >
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function ValidationNotice() {
  return (
    <aside
      role="note"
      className="mb-8 rounded-xl border-2 p-4 text-sm"
      style={{ borderColor: 'var(--warning, #B45309)', background: 'var(--warning-bg, #FEF3C7)', color: 'var(--warning-ink, #78350F)' }}
    >
      <strong>Modèle à faire valider.</strong> Ce texte est un modèle de travail, pas un avis juridique. Les champs
      surlignés entre crochets (par exemple [À COMPLÉTER]) doivent être remplis, et l&apos;ensemble relu par un avocat
      avant toute vente. Les passages [À VÉRIFIER] reposent sur des sources secondaires.
    </aside>
  );
}

export interface LegalSection {
  title: string;
  paras?: string[];
  list?: string[];
  table?: { head: string[]; rows: string[][] };
  /** paragraphes affichés après la liste ou le tableau */
  after?: string[];
}

export function LegalPage({ title, updated, sections, path }: { title: string; updated: string; sections: LegalSection[]; path?: string }) {
  return (
    <PageShell narrow>
      {path ? (
        <>
          <JsonLd data={breadcrumbListLd(path, [{ name: 'Accueil', path: '/' }, { name: title, path }])} />
          <Crumbs items={[{ name: 'Accueil', href: '/' }, { name: title }]} />
        </>
      ) : null}
      <h1 className={h1Class} style={h1Style}>{title}</h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>Dernière mise à jour : <Hl text={updated} /></p>
      <div className="mt-6" />
      <ValidationNotice />
      {sections.map((s) => (
        <section key={s.title} className="mb-8">
          <h2 className="mb-3 font-semibold text-xl">{s.title}</h2>
          {s.paras?.map((p, i) => (
            <p key={i} className="mb-3 leading-relaxed"><Hl text={p} /></p>
          ))}
          {s.list && (
            <ul className="mb-3 list-disc space-y-1 pl-6 leading-relaxed">
              {s.list.map((l, i) => <li key={i}><Hl text={l} /></li>)}
            </ul>
          )}
          {s.table && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr>{s.table.head.map((h) => <th key={h} className="border-b p-2 font-semibold" style={{ borderColor: 'var(--line)' }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {s.table.rows.map((r, i) => (
                    <tr key={i}>{r.map((c, j) => <td key={j} className="border-b p-2 align-top" style={{ borderColor: 'var(--line)' }}><Hl text={c} /></td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {s.after?.map((p, i) => (
            <p key={`a${i}`} className="mb-3 mt-3 leading-relaxed"><Hl text={p} /></p>
          ))}
        </section>
      ))}
    </PageShell>
  );
}
