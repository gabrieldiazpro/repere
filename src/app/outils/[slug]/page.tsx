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
