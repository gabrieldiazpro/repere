import type { HTMLAttributes, ReactNode } from "react";

type Tone = "white" | "tint" | "outline";

const tones: Record<Tone, string> = {
  white: "bg-white ring-1 ring-line/70 shadow-[0_1px_2px_rgba(27,31,46,.04),0_12px_32px_-18px_rgba(27,31,46,.18)]",
  tint: "bg-primary-bg",
  outline: "bg-transparent ring-1 ring-line",
};

export function Card({
  tone = "white",
  className = "",
  children,
  as: Tag = "div",
  ...rest
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
  as?: "div" | "article" | "section" | "li";
} & Omit<HTMLAttributes<HTMLElement>, "className" | "children">) {
  return (
    <Tag className={`rounded-[var(--radius-card)] ${tones[tone]} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export default Card;
