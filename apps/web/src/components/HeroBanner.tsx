import type { ReactNode } from "react";
import { cardClass } from "@/lib/uiClasses";

export function HeroBanner({
  icon,
  headline,
  line,
  cta,
  visual,
}: {
  icon?: ReactNode;
  headline: ReactNode;
  line?: ReactNode;
  cta?: ReactNode;
  visual?: ReactNode;
}) {
  return (
    <section
      className={`${cardClass} border-mint/25 bg-gradient-to-r from-mint/[0.08] via-surface to-ember/[0.06]`}
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {icon ? (
            <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-mint/15 text-mint">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className="m-0 font-dm-sans text-[clamp(1.5rem,3.2vw,2.15rem)] font-medium tracking-tight text-ink">
              {headline}
            </h1>
            {line ? (
              <p className="mt-2 max-w-xl text-[0.95rem] leading-snug text-muted">
                {line}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {cta}
          {visual}
        </div>
      </div>
    </section>
  );
}
