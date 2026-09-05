"use client";

import SavingsIcon from "@mui/icons-material/Savings";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import type { SvgIconComponent } from "@mui/icons-material";
import { AppIcon } from "@/components/AppIcon";
import { ScrollRevealSection } from "@/components/motion/ScrollRevealSection";
import { StaggerGrid, StaggerItem } from "@/components/motion/StaggerGrid";

const STEPS: {
  number: string;
  title: string;
  body: string;
  icon: SvgIconComponent;
}[] = [
  {
    number: "01",
    title: "Deposit",
    body: "Your amount is encrypted before it reaches the contract.",
    icon: SavingsIcon,
  },
  {
    number: "02",
    title: "Prizes",
    body: "Mock yield enters PrizePool only. Principal never funds a tier.",
    icon: EmojiEventsIcon,
  },
  {
    number: "03",
    title: "Draw",
    body: "Each slot stores encrypted FHE randomness. You check your own range.",
    icon: AutoAwesomeIcon,
  },
  {
    number: "04",
    title: "Claim or withdraw",
    body: "Decrypt locally, claim privately, or withdraw anytime.",
    icon: LockOpenIcon,
  },
];

export function HowItWorksSection() {
  return (
    <ScrollRevealSection
      id="how-it-works"
      className="mx-auto w-full max-w-[1160px] scroll-mt-8 px-6 pb-8 pt-[5.5rem] font-inter text-ink"
    >
      <h2 className="mb-10 font-fraunces text-[clamp(1.9rem,3.6vw,2.7rem)] font-medium tracking-tight">
        How it works
      </h2>

      <StaggerGrid className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((step) => (
          <StaggerItem
            key={step.number}
            className="relative flex flex-col overflow-hidden rounded-lg bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f] p-8 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/[0.07] to-transparent"
              aria-hidden="true"
            />
            <span className="relative mb-5 font-mono text-[0.72rem] tracking-widest text-ember/75">
              {step.number}
            </span>
            <span className="relative mb-5 grid h-12 w-12 place-items-center rounded-lg bg-mint/15 text-mint">
              <AppIcon icon={step.icon} size={26} />
            </span>
            <h3 className="relative mb-3 font-fraunces text-[1.35rem] font-medium leading-snug text-ink">
              {step.title}
            </h3>
            <p className="m-0 text-[0.88rem] leading-relaxed text-muted">{step.body}</p>
          </StaggerItem>
        ))}
      </StaggerGrid>
    </ScrollRevealSection>
  );
}
