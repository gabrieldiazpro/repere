import { SegmentHub, hubMetadata } from '@/lib/seo/segment-pages';

export const metadata = hubMetadata('ecommerce');

export default function Page() {
  return <SegmentHub segment="ecommerce" />;
}
