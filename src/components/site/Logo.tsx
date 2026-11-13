import Link from "next/link";

/** Pictogramme seul (cadre de visée + point ambre), SVG inline. */
export function LogoMark({
  size = 32,
  className = "",
  title,
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <rect width="64" height="64" rx="14" fill="#3730A3" />
      <g fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 26V19a2 2 0 0 1 2-2h7" />
        <path d="M38 17h7a2 2 0 0 1 2 2v7" />
        <path d="M47 38v7a2 2 0 0 1-2 2h-7" />
        <path d="M26 47h-7a2 2 0 0 1-2-2v-7" />
      </g>
      <circle cx="32" cy="32" r="7" fill="#F5A524" />
    </svg>
  );
}

/** Lockup : logo + « Repéré » (+ descripteur optionnel). */
export function Logo({
  size = 32,
  href = "/",
  withText = true,
  descriptor = false,
  inverted = false,
  className = "",
}: {
  size?: number;
  href?: string | null;
  withText?: boolean;
  descriptor?: boolean;
  inverted?: boolean;
  className?: string;
}) {
  const content = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      {withText ? (
        <span className="flex flex-col leading-none">
          <span
            className={`font-display font-bold tracking-[-0.02em] ${inverted ? "text-white" : "text-ink"}`}
            style={{ fontSize: Math.round(size * 0.68) }}
          >
            Repéré
          </span>
          {descriptor ? (
            <span className={`mt-1 text-xs font-medium ${inverted ? "text-on-deep" : "text-muted"}`}>
              Référencement IA
            </span>
          ) : null}
        </span>
      ) : (
        <span className="sr-only">Repéré</span>
      )}
    </span>
  );
  if (!href) return content;
  return (
    <Link href={href} className="inline-flex rounded-lg" aria-label="Repéré, accueil">
      {content}
    </Link>
  );
}

export default Logo;
