"use client";

import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { AppIcon } from "@/components/AppIcon";
import { ScrollRevealSection } from "@/components/motion/ScrollRevealSection";

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

function CellMarker({ kind }: { kind: "public" | "sealed" }) {
  if (kind === "public") {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-public/20 text-public">
        <AppIcon icon={VisibilityIcon} size={16} />
      </span>
    );
  }

  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ember/20 text-ember">
      <AppIcon icon={VisibilityOffIcon} size={16} />
    </span>
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

      <div className="overflow-hidden rounded-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <header className="bg-public/[0.1] px-6 py-5 md:px-8 md:py-6">
            <p className="m-0 font-mono text-[0.68rem] font-medium tracking-[0.18em] text-public">
              PUBLIC
            </p>
            <h3 className="mt-2 mb-0 font-fraunces text-[1.25rem] font-medium leading-snug text-ink">
              Visible to everyone
            </h3>
          </header>
          <header className="bg-ember/[0.1] px-6 py-5 md:px-8 md:py-6">
            <p className="m-0 font-mono text-[0.68rem] font-medium tracking-[0.18em] text-ember">
              SEALED
            </p>
            <h3 className="mt-2 mb-0 font-fraunces text-[1.25rem] font-medium leading-snug text-ink">
              Sealed to you
            </h3>
          </header>
        </div>

        {ROWS.map((row) => (
          <div
            key={row.public}
            className="grid grid-cols-1 border-t border-line md:grid-cols-2"
          >
            <div className="flex items-start gap-3 bg-public/[0.05] px-6 py-4 md:px-8 md:py-5">
              <CellMarker kind="public" />
              <span className="text-[0.92rem] leading-snug text-ink/90">{row.public}</span>
            </div>
            <div className="flex items-start gap-3 bg-ember/[0.05] px-6 py-4 md:px-8 md:py-5">
              <CellMarker kind="sealed" />
              <span className="text-[0.92rem] leading-snug text-ink/90">{row.sealed}</span>
            </div>
          </div>
        ))}
      </div>
    </ScrollRevealSection>
  );
}
