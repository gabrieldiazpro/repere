import type { ReactNode } from "react";

const widths = {
  narrow: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
} as const;

export function Container({
  size = "default",
  className = "",
  children,
}: {
  size?: keyof typeof widths;
  className?: string;
  children: ReactNode;
}) {
  return <div className={`mx-auto w-full ${widths[size]} px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

export default Container;
