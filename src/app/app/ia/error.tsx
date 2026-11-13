'use client';

import { MesureError } from '@/components/app/mesure/MesureError';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <MesureError title="Ce que disent les IA" error={error} reset={reset} />;
}
