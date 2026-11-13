'use client';

import { MesureError } from '@/components/app/mesure/MesureError';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <MesureError title="SEO et GEO" error={error} reset={reset} />;
}
