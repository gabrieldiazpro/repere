'use client';

export function RetryButton() {
  return (
    <button
      type="button"
      onClick={() => (window.location.href = '/app')}
      className="rp-tap rounded-xl bg-[var(--primary)] px-6 font-semibold text-white"
    >
      Réessayer
    </button>
  );
}
