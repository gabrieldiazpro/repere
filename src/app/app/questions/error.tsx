'use client';

import { MesureError } from '@/components/app/mesure/MesureError';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <MesureError title="Questions suivies" error={error} reset={reset} />;
}
