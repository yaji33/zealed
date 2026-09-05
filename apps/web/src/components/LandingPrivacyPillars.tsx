"use client";

import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import LockIcon from "@mui/icons-material/Lock";
import { AppIcon } from "@/components/AppIcon";
import { ScrollRevealSection } from "@/components/motion/ScrollRevealSection";
import { StaggerGrid, StaggerItem } from "@/components/motion/StaggerGrid";
import { cardClass } from "@/lib/uiClasses";

const PILLARS = [
  {
    title: "Principal stays yours",
    body: "ERC-7984 deposits sit in ConfidentialVault and stay withdrawable at any time. Draws never lock principal.",
    icon: AccountBalanceWalletIcon,
  },
  {
    title: "Prizes never spend principal",
    body: "Available prize liquidity is sponsor-funded mock yield in PrizePool — a separate custody domain from saver balances.",
    icon: EmojiEventsIcon,
  },
  {
    title: "You decrypt locally",
    body: "Winner checks are pull-based per slot. Outcomes stay encrypted onchain; only your client decrypts via EIP-712 authorization.",
    icon: LockIcon,
  },
] as const;

export function LandingPrivacyPillars() {
  return (
    <ScrollRevealSection
      id="privacy"
      className="mx-auto w-full max-w-[1160px] scroll-mt-8 px-6 pb-8 pt-[5.5rem] font-inter text-ink"
    >
      <h2 className="mb-4 font-fraunces text-[clamp(1.9rem,3.6vw,2.7rem)] font-medium tracking-tight">
        Built for sealed savings
      </h2>
      <p className="mb-10 max-w-[44rem] text-muted">
        Three hard boundaries keep principal, prizes, and private state apart.
      </p>

      <StaggerGrid className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {PILLARS.map((pillar) => (
          <StaggerItem key={pillar.title} className={`${cardClass} mb-0`}>
            <span className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-soft text-mint">
              <AppIcon icon={pillar.icon} size={20} />
            </span>
            <h3 className="m-0 font-dm-sans text-[1.1rem] font-medium text-ink">
              {pillar.title}
            </h3>
            <p className="mt-3 mb-0 text-[0.92rem] leading-relaxed text-muted">
              {pillar.body}
            </p>
          </StaggerItem>
        ))}
      </StaggerGrid>
    </ScrollRevealSection>
  );
}
