import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "light";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold leading-tight text-center transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 select-none";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-strong shadow-[0_1px_0_rgba(255,255,255,.15)_inset,0_6px_16px_-6px_rgba(55,48,163,.55)]",
  secondary: "bg-white text-primary ring-1 ring-inset ring-line hover:ring-primary hover:bg-primary-bg",
  ghost: "text-primary underline-offset-4 hover:underline",
  light: "bg-white text-primary-deep hover:bg-primary-bg",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-10 px-4 py-1.5 text-sm",
  md: "min-h-12 px-5 py-2.5 text-base",
  lg: "min-h-14 px-7 py-3 text-lg",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className = "",
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  const pad = variant === "ghost" ? "min-h-10 px-1 text-base" : sizes[size];
  return `${base} ${variants[variant]} ${pad} ${className}`.trim();
}

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
};

export type ButtonProps = Common &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: string;
  };

export function Button({ variant, size, className, children, href, ...rest }: ButtonProps) {
  const cls = buttonClasses({ variant, size, className });
  if (href) {
    const ariaLabel = rest["aria-label"];
    return (
      <Link href={href} className={cls} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }
  return (
    <button type={rest.type ?? "button"} className={cls} {...rest}>
      {children}
    </button>
  );
}

export default Button;
