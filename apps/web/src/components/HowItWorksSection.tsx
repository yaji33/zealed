"use client";

import { ScrollRevealSection } from "@/components/motion/ScrollRevealSection";
import { StaggerGrid, StaggerItem } from "@/components/motion/StaggerGrid";
import { StepPixelArt, type StepVisual } from "@/components/StepPixelArt";

const STEPS: {
  number: string;
  title: string;
  body: string;
  visual: StepVisual;
}[] = [
  {
    number: "01",
    title: "Deposit",
    body: "Your amount is encrypted before it reaches the contract.",
    visual: "deposit",
  },
  {
    number: "02",
    title: "Prizes",
    body: "Mock yield enters PrizePool only. Principal never funds a tier.",
    visual: "yield",
  },
  {
    number: "03",
    title: "Draw",
    body: "Each slot stores encrypted FHE randomness. You check your own range.",
    visual: "draw",
  },
  {
    number: "04",
    title: "Claim or withdraw",
    body: "Decrypt locally, claim privately, or withdraw anytime.",
    visual: "claim",
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
            className="relative flex flex-col overflow-hidden rounded-lg border border-edge bg-surface p-6 sm:p-8"
          >
            <span className="relative mb-5 font-mono text-[0.72rem] tracking-widest text-ember/75">
              {step.number}
            </span>

            <div className="relative">
              <StepPixelArt type={step.visual} />
            </div>

            <h3 className="relative mb-3 font-dm-sans text-[1.2rem] font-medium leading-snug text-ink">
              {step.title}
            </h3>
            <p className="m-0 text-[0.88rem] leading-relaxed text-muted">{step.body}</p>
          </StaggerItem>
        ))}
      </StaggerGrid>
    </ScrollRevealSection>
  );
}
