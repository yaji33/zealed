"use client";

import LockIcon from "@mui/icons-material/Lock";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { AppIcon } from "@/components/AppIcon";
import { ScrollRevealSection } from "@/components/motion/ScrollRevealSection";
import { cardClass } from "@/lib/uiClasses";

const ROWS = [
  {
    public: "Principal TVL (aggregate)",
    sealed: "Your deposit and balance",
  },
  {
    public: "Tier allocations, reserve, slot counts",
    sealed: "Your odds of winning",
  },
  {
    public: "Draw lifecycle and snapshot version",
    sealed: "Whether you won or lost a slot",
  },
  {
    public: "Verified contract code",
    sealed: "Your prize amount",
  },
] as const;

function RowList({
  kind,
  items,
}: {
  kind: "public" | "sealed";
  items: readonly string[];
}) {
  const isPublic = kind === "public";
  return (
    <ul className="m-0 list-none p-0">
      {items.map((label, index) => (
        <li
          key={label}
          className={`flex items-start gap-3 py-4 ${
            index > 0 ? "border-t border-line/40" : ""
          }`}
        >
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
              isPublic ? "bg-mint/15 text-mint" : "bg-ember/20 text-ember"
            }`}
          >
            <AppIcon
              icon={isPublic ? VisibilityIcon : LockIcon}
              size={16}
            />
          </span>
          <span className="pt-0.5 text-[0.92rem] leading-snug text-ink/90">
            {label}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function VisibleVsSealedSection() {
  return (
    <ScrollRevealSection
      id="visible-vs-sealed"
      className="mx-auto w-full max-w-[1160px] scroll-mt-8 px-6 pb-8 pt-[5.5rem] font-inter text-ink"
    >
      <h2 className="mb-4 font-fraunces text-[clamp(1.9rem,3.6vw,2.7rem)] font-medium tracking-tight">
        Visible vs sealed
      </h2>
      <p className="mb-10 max-w-[44rem] text-muted">
        The pool is auditable. Your position is not.
      </p>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className={`${cardClass} mb-0`}>
          <p className="m-0 font-mono text-[0.68rem] font-medium tracking-[0.18em] text-mint">
            PUBLIC
          </p>
          <h3 className="mt-2 mb-4 font-dm-sans text-[1.2rem] font-medium leading-snug text-ink">
            Visible to everyone
          </h3>
          <RowList kind="public" items={ROWS.map((r) => r.public)} />
        </div>
        <div className={`${cardClass} mb-0`}>
          <p className="m-0 font-mono text-[0.68rem] font-medium tracking-[0.18em] text-ember">
            SEALED
          </p>
          <h3 className="mt-2 mb-4 font-dm-sans text-[1.2rem] font-medium leading-snug text-ink">
            Sealed to you
          </h3>
          <RowList kind="sealed" items={ROWS.map((r) => r.sealed)} />
        </div>
      </div>

      <p className="mt-6 text-center font-mono text-[0.72rem] tracking-[0.14em] text-muted">
        Auditable pool. Private position.
      </p>
    </ScrollRevealSection>
  );
}
