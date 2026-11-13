import type { ReactNode } from "react";
import { Container } from "./Container";

type Tone = "canvas" | "white" | "deep" | "primary";

const tones: Record<Tone, string> = {
  canvas: "bg-canvas text-ink",
  white: "bg-white text-ink",
  deep: "on-dark bg-primary-deep text-white",
  primary: "on-dark bg-primary text-white",
};

export function Section({
  id,
  tone = "canvas",
  size = "default",
  className = "",
  containerClassName = "",
  labelledBy,
  children,
}: {
  id?: string;
  tone?: Tone;
  size?: "narrow" | "default" | "wide";
  className?: string;
  containerClassName?: string;
  labelledBy?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={`py-16 sm:py-24 ${tones[tone]} ${className}`}>
      <Container size={size} className={containerClassName}>
        {children}
      </Container>
    </section>
  );
}

export function SectionHeading({
  id,
  title,
  intro,
  className = "",
  align = "left",
}: {
  id?: string;
  title: ReactNode;
  intro?: ReactNode;
  className?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={`max-w-2xl ${align === "center" ? "mx-auto text-center" : ""} ${className}`}>
      <h2 id={id} className="text-3xl font-bold sm:text-[2.6rem]">
        {title}
      </h2>
      {intro ? <p className="mt-4 text-lg opacity-90">{intro}</p> : null}
    </div>
  );
}

export default Section;
