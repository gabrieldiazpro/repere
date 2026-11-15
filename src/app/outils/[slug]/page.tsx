import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ToolPage, toolMeta } from '@/components/tools/ToolPage';
import { TOOLS, getTool, type ToolSlug } from '@/components/tools/registry';
import {
  CITABILITY_SAMPLE_HTML,
  JSONLD_EXAMPLE_FIELDS,
  exampleCitability,
  exampleCompare,
  exampleLlms,
  exampleProduct,
  exampleReadiness,
  exampleReviewLink,
  exampleRobots,
} from '@/components/tools/examples';
import { ReviewLinkTool } from '@/components/tools/ReviewLinkTool';
import { RobotsTool } from '@/components/tools/RobotsTool';
import { ReadinessTool } from '@/components/tools/ReadinessTool';
import { CitabilityTool } from '@/components/tools/CitabilityTool';
import { JsonLdTool } from '@/components/tools/JsonLdTool';
import { RenderTool } from '@/components/tools/RenderTool';
import { CompareTool } from '@/components/tools/CompareTool';
import { LlmsTool } from '@/components/tools/LlmsTool';
import { ProductTool } from '@/components/tools/ProductTool';
import { MetaTool, SerpTool } from '@/components/tools/v6/SerpTools';
import { HeadersTool, HreflangTool, IndexTool, RedirectTool, SitemapTool } from '@/components/tools/v6/TechTools';
import { LinksTool, OgTool } from '@/components/tools/v6/PageTools';
import { ReadabilityTool, RobotsGenTool } from '@/components/tools/v6/LocalTools';
import {
  READABILITY_EXAMPLE,
  SERP_EXAMPLE,
  exampleHeaders,
  exampleHreflang,
  exampleIndex,
  exampleLinks,
  exampleMeta,
  exampleOg,
  exampleRedirects,
  exampleSitemap,
} from '@/components/tools/v6/examples';
import { V6_UPDATED } from '@/components/tools/v6/registry';

export const dynamicParams = false;

export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

const isSlug = (s: string): s is ToolSlug => TOOLS.some((t) => t.slug === s);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return isSlug(slug) ? toolMeta(getTool(slug)) : {};
}

/** Outil interactif (client) avec son état « exemple » calculé ici, au rendu statique, par les vraies fonctions d'analyse. */
function ToolFor({ slug }: { slug: ToolSlug }) {
  switch (slug) {
    case 'lien-avis-google':
      return <ReviewLinkTool example={exampleReviewLink()} />;
    case 'robots-ia':
      return <RobotsTool example={exampleRobots()} />;
    case 'pret-pour-les-ia':
      return <ReadinessTool example={exampleReadiness()} />;
    case 'citabilite':
      return <CitabilityTool example={exampleCitability()} sampleHtml={CITABILITY_SAMPLE_HTML} />;
    case 'json-ld':
      return <JsonLdTool exampleFields={JSONLD_EXAMPLE_FIELDS} />;
    case 'rendu-sans-javascript':
      return <RenderTool example={exampleReadiness()} />;
    case 'comparateur':
      return <CompareTool example={exampleCompare()} />;
    case 'llms-txt':
      return <LlmsTool example={exampleLlms()} />;
    case 'fiche-produit':
      return <ProductTool example={exampleProduct()} />;
    case 'apercu-google':
      return <SerpTool example={SERP_EXAMPLE} />;
    case 'balises-title-meta':
      return <MetaTool example={exampleMeta()} />;
    case 'indexabilite':
      return <IndexTool example={exampleIndex()} />;
    case 'redirections':
      return <RedirectTool example={exampleRedirects()} />;
    case 'en-tetes-http':
      return <HeadersTool example={exampleHeaders()} />;
    case 'validateur-sitemap':
      return <SitemapTool example={exampleSitemap()} />;
    case 'hreflang':
      return <HreflangTool example={exampleHreflang()} />;
    case 'open-graph':
      return <OgTool example={exampleOg()} />;
    case 'analyse-liens':
      return <LinksTool example={exampleLinks()} />;
    case 'lisibilite':
      return <ReadabilityTool exampleText={READABILITY_EXAMPLE} />;
    case 'generateur-robots-txt':
      return <RobotsGenTool today={V6_UPDATED} />;
  }
}

export default async function OutilPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isSlug(slug)) notFound();
  return (
    <ToolPage tool={getTool(slug)}>
      <ToolFor slug={slug} />
    </ToolPage>
  );
}
