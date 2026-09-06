import type { ReactNode } from "react";
import { cardClass } from "@/lib/uiClasses";
import { cn } from "@/lib/utils";

export function EmptyState({
  eyebrow = "EMPTY",
  title,
  body,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(`${cardClass} py-12 text-center`, className)}>
      <p className="m-0 font-mono text-[0.68rem] tracking-[0.18em] text-ember/75">
        {eyebrow}
      </p>
      <h2 className="mt-4 font-dm-sans text-xl font-medium text-ink">{title}</h2>
      {body ? (
        <p className="mx-auto mt-2 mb-0 max-w-md text-[0.95rem] leading-relaxed text-muted">
          {body}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  );
}
