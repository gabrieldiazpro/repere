import type { ReactNode } from "react";

export type BadgeTone = "success" | "warning" | "danger" | "primary" | "neutral" | "accent";

const tones: Record<BadgeTone, string> = {
  success: "bg-success-bg text-success-ink",
  warning: "bg-warning-bg text-warning-ink",
  danger: "bg-danger-bg text-danger-ink",
  primary: "bg-primary-bg text-primary",
  neutral: "bg-canvas text-muted ring-1 ring-inset ring-line",
  accent: "bg-accent text-ink",
};

export function Badge({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold leading-6 ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export default Badge;
