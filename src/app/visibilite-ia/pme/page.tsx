import { SegmentHub, hubMetadata } from '@/lib/seo/segment-pages';

export const metadata = hubMetadata('pme');

export default function Page() {
  return <SegmentHub segment="pme" />;
}
