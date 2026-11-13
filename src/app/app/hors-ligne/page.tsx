import { AppLogo } from '@/components/app/icons';
import { RetryButton } from '@/components/app/RetryButton';

export const metadata = { title: 'Hors ligne' };
export const dynamic = 'force-static';

// Page de repli du service worker (précachée à l'installation).
export default function HorsLignePage() {
  return (
    <div className="mx-auto flex min-h-[80dvh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <AppLogo size={64} />
      <h1 className="rp-display text-2xl">Vous êtes hors ligne</h1>
      <p className="text-[var(--muted)]">
        Votre connexion semble coupée. Vérifiez-la, puis cliquez sur « Réessayer ». Les écrans déjà ouverts restent consultables.
      </p>
      <RetryButton />
    </div>
  );
}
