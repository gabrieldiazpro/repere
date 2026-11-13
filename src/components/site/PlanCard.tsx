import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import type { Plan } from "@/lib/plans";
import { formatEuros, intervalLabel } from "./plans-fallback";

function Check({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" className={`mt-0.5 shrink-0 ${className}`}>
      <circle cx="10" cy="10" r="9" fill="currentColor" opacity=".14" />
      <path d="M6 10.2l2.6 2.6L14 7.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function planHref(plan: Plan) {
  return plan.priceCents === 0 ? "/audit" : `/audit?plan=${plan.id}`;
}

export function PlanCard({
  plan,
  note,
  tagline,
  ribbon,
  headingLevel = 3,
}: {
  plan: Plan;
  note?: string;
  tagline?: string;
  ribbon?: string;
  headingLevel?: 2 | 3;
}) {
  const H = headingLevel === 2 ? "h2" : "h3";
  const featured = plan.highlighted;
  const free = plan.priceCents === 0;

  return (
    <article
      className={`relative flex h-full flex-col rounded-[var(--radius-card)] p-6 sm:p-7 ${
        featured
          ? "on-dark bg-primary-deep text-white shadow-[0_24px_60px_-28px_rgba(30,26,92,.8)] lg:-my-4 lg:py-10"
          : "bg-white ring-1 ring-line"
      }`}
    >
      {featured || ribbon ? (
        <p className="absolute -top-3.5 left-6 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-sm font-semibold text-ink">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ink" />
          {ribbon ?? "Le plus choisi pour démarrer"}
        </p>
      ) : null}

      <H className={`text-xl font-bold ${featured ? "text-white" : "text-ink"}`}>{plan.name}</H>
      {tagline ? <p className={`mt-1 text-[0.95rem] ${featured ? "text-on-deep" : "text-muted"}`}>{tagline}</p> : null}

      <p className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="tabular whitespace-nowrap font-display text-5xl font-bold tracking-tight">{formatEuros(plan.priceCents)}</span>
        <span className={`whitespace-nowrap text-[0.95rem] ${featured ? "text-on-deep" : "text-muted"}`}>
          {free ? "sans carte bancaire" : intervalLabel(plan.interval)}
        </span>
      </p>

      <ul className="mt-6 space-y-3 text-[0.97rem]">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <Check className={featured ? "text-accent" : "text-primary"} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-8">
        <Link
          href={planHref(plan)}
          className={buttonClasses({
            variant: featured ? "light" : free ? "primary" : "secondary",
            size: "md",
            className: "w-full",
          })}
        >
          {plan.cta}
        </Link>
        {note ? <p className={`mt-3 text-center text-sm ${featured ? "text-on-deep" : "text-muted"}`}>{note}</p> : null}
      </div>
    </article>
  );
}

export default PlanCard;
