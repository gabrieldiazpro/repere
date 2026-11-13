import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo/meta';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageShell, Crumbs, JsonLd, Card, CtaLink, h1Class, h1Style, h2Class } from '@/lib/seo/shell';
import {
  TRADES, ARRONDISSEMENTS, VILLES, getTrade, buildTradeQueries, directoriesFor, buildFaq, breadcrumbLd, faqLd, serviceLd,
  tradePath, pairPath, relatedTrades, tradeLower, withArticle,
} from '@/lib/seo';

export const dynamicParams = true;

export function generateStaticParams() {
  return TRADES.map((t) => ({ metier: t.slug }));
}

type Props = { params: Promise<{ metier: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getTrade((await params).metier);
  if (!t) return { robots: { index: false } };
  return pageMeta({
    path: tradePath(t),
    title: `${t.nom_pluriel} : qui ChatGPT recommande-t-il ?`,
    description: `Que répondent ChatGPT, Gemini et Perplexity quand on cherche ${withArticle(t)} ? Questions types des clients, annuaires et sources clés du métier, audit gratuit.`,
  });
}

export default async function TradePage({ params }: Props) {
  const t = getTrade((await params).metier);
  if (!t) notFound();
  const queries = buildTradeQueries(t);
  const dirs = directoriesFor(t);
  const faq = buildFaq(t, null, null);
  const path = tradePath(t);
  const featured = ARRONDISSEMENTS.filter((a) => ['paris-11e', 'paris-15e', 'paris-1er'].includes(a.slug));

  return (
    <PageShell>
      <JsonLd data={breadcrumbLd([{ name: 'Accueil', path: '/' }, { name: 'Visibilité IA', path: '/visibilite-ia' }, { name: t.nom, path }])} />
      <JsonLd data={faqLd(faq, path)} />
      <JsonLd data={serviceLd(t, null, path)} />
      <Crumbs items={[{ name: 'Accueil', href: '/' }, { name: 'Visibilité IA', href: '/visibilite-ia' }, { name: t.nom }]} />
      <h1 className={h1Class} style={h1Style}>{t.nom} : êtes-vous recommandé par ChatGPT, Gemini et Perplexity ?</h1>
      <p className="mt-4 max-w-3xl text-lg leading-relaxed" style={{ color: 'var(--muted)' }}>
        Les clients demandent de plus en plus à une IA un {tradeLower(t)} près de chez eux. Les réponses citent quelques
        établissements seulement. Voici les questions que nous testons pour ce métier et les sources qui comptent.
      </p>

      <h2 className={h2Class}>Les questions que posent vos clients</h2>
      <ul className="space-y-2">
        {queries.map((q) => (
          <li key={q} className="rounded-lg border px-4 py-3" style={{ borderColor: 'var(--line)', background: '#fff' }}>« {q} »</li>
        ))}
      </ul>

      <h2 className={h2Class}>Les annuaires et sources à soigner</h2>
      <p className="mb-3 text-sm" style={{ color: 'var(--muted)' }}>
        Sources que les IA ont des chances de citer pour ce métier. Liste établie par nos soins, à confirmer par nos mesures au fil des audits.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {dirs.map((d) => (
          <Card key={d.name}><p className="font-semibold">{d.name}</p><p className="text-sm" style={{ color: 'var(--muted)' }}>{d.note}</p></Card>
        ))}
      </div>

      <h2 className={h2Class}>Choisissez votre ville</h2>
      <p className="mb-3">Pages par ville pour les {t.nom_pluriel.toLowerCase()} :</p>
      <ul className="flex flex-wrap gap-2">
        {[...featured, ...VILLES.slice(0, 6)].map((c) => (
          <li key={c.slug}>
            <Link href={pairPath(t, c)} className="inline-block rounded-full border px-3 py-1 text-sm underline-offset-2 hover:underline" style={{ borderColor: 'var(--line)' }}>
              {c.nom}
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-12 rounded-2xl p-6 sm:p-8" style={{ background: 'var(--primary-bg)' }}>
        <p className="mb-3 text-lg font-semibold">Testez votre établissement en 2 minutes.</p>
        <CtaLink href={`/audit?metier=${t.slug}`}>Audit gratuit</CtaLink>
      </div>

      <h2 className={h2Class}>Questions fréquentes</h2>
      <div className="space-y-4">
        {faq.map((f) => (
          <details key={f.q} className="group rounded-lg border p-4" style={{ borderColor: 'var(--line)', background: '#fff' }}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
              <span>{f.q}</span>
              <span aria-hidden="true" className="shrink-0 text-xl leading-none transition-transform group-open:rotate-45" style={{ color: 'var(--primary)' }}>+</span>
            </summary>
            <p className="mt-2 leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>

      <h2 className={h2Class}>Voir aussi</h2>
      <ul className="list-disc space-y-1 pl-6">
        {relatedTrades(t).map((r) => (
          <li key={r.slug}><Link href={tradePath(r)} className="underline" style={{ color: 'var(--primary)' }}>Visibilité IA : {r.nom_pluriel.toLowerCase()}</Link></li>
        ))}
        <li><Link href="/methode" className="underline" style={{ color: 'var(--primary)' }}>Comment nous mesurons la visibilité IA</Link></li>
        <li><Link href="/local" className="underline" style={{ color: 'var(--primary)' }}>Notre offre pour les artisans et commerces</Link></li>
        <li><Link href="/guides/avis-clients-ia" className="underline" style={{ color: 'var(--primary)' }}>Avis clients et IA : ce qui est autorisé</Link></li>
        <li><Link href="/tarifs?segment=local" className="underline" style={{ color: 'var(--primary)' }}>Tarifs pour les commerces locaux</Link></li>
      </ul>
    </PageShell>
  );
}
