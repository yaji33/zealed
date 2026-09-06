import type { Metadata } from "next";
import { HowItWorksSection } from "@/components/HowItWorksSection";
import { JsonLd } from "@/components/JsonLd";
import { LandingHero } from "@/components/LandingHero";
import { LandingPrivacyPillars } from "@/components/LandingPrivacyPillars";
import { LaunchAppLink } from "@/components/LaunchAppLink";
import { AnchorLink } from "@/components/motion/AnchorLink";
import { ScrollRevealSection } from "@/components/motion/ScrollRevealSection";
import { StaggerGrid, StaggerItem } from "@/components/motion/StaggerGrid";
import { VisibleVsSealedSection } from "@/components/VisibleVsSealedSection";
import { addresses } from "@/lib/config";
import { LANDING_FAQ } from "@/lib/landingContent";
import { landingJsonLd, routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata("home");

const CONTRACTS = [
  {
    name: "ConfidentialVault",
    address: addresses.vault,
    body: "Custodies encrypted principal. Withdrawal stays open through every draw.",
  },
  {
    name: "TicketEngine",
    address: addresses.ticketEngine,
    body: "Versions encrypted checkpoints so closed draws stay immutable.",
  },
  {
    name: "PrizePool",
    address: addresses.prizePool,
    body: "Holds sponsor-funded mock yield, separate from principal.",
  },
  {
    name: "DrawManager",
    address: addresses.drawManager,
    body: "Stores encrypted FHE.randEuint64() per slot. You check one at a time.",
  },
] as const;

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const sectionClass =
  "mx-auto w-full max-w-[1160px] scroll-mt-8 px-6 pb-8 pt-[5.5rem] font-inter text-ink [&_h2]:m-0 [&_h2]:font-fraunces [&_h2]:text-[clamp(1.9rem,3.6vw,2.7rem)] [&_h2]:font-medium [&_h2]:tracking-tight [&_h2]:mb-9 [&_h3]:m-0 [&_h3]:font-medium";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-void font-inter leading-relaxed text-ink [&_h1]:m-0 [&_h2]:m-0 [&_h3]:m-0 [&_h1]:font-medium [&_h2]:font-medium [&_h3]:font-medium">
      <JsonLd data={landingJsonLd()} />
      <main id="main">
        <LandingHero />
        <HowItWorksSection />
        <VisibleVsSealedSection />
        <LandingPrivacyPillars />

        <ScrollRevealSection id="contracts" className={sectionClass}>
          <h2>The contracts</h2>
          <p className="-mt-7 mb-10 max-w-[44rem] text-muted">
            One principal vault and a separate prize pool on Zama fhEVM. Values stay
            encrypted onchain. You decrypt your own result locally.
          </p>
          <StaggerGrid className="grid grid-cols-2 gap-5 max-[760px]:grid-cols-1 xl:grid-cols-4">
            {CONTRACTS.map((contract) => (
              <StaggerItem
                key={contract.name}
                className="relative flex flex-col gap-3 overflow-hidden rounded-lg border border-edge bg-surface p-6"
              >
                <h3 className="relative font-mono text-base font-medium text-ink">
                  {contract.name}
                </h3>
                <p className="relative m-0 flex-1 text-[0.92rem] leading-relaxed text-muted">
                  {contract.body}
                </p>
                {contract.address ? (
                  <a
                    className="relative font-mono text-[0.82rem] text-ember hover:underline hover:underline-offset-[3px]"
                    href={`https://sepolia.etherscan.io/address/${contract.address}#code`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {shortAddress(contract.address)}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : (
                  <span className="relative font-mono text-[0.82rem] text-ember">
                    not configured
                  </span>
                )}
              </StaggerItem>
            ))}
          </StaggerGrid>
        </ScrollRevealSection>

        <ScrollRevealSection id="faq" className={sectionClass}>
          <h2>FAQ</h2>
          <div className="w-full [&_details:last-child]:border-b [&_details]:border-t [&_details]:border-line">
            {LANDING_FAQ.map((item) => (
              <details key={item.q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-[1.15rem] font-dm-sans text-[1.02rem] font-medium [&::-webkit-details-marker]:hidden after:font-mono after:text-ember after:content-['+'] after:transition-transform group-open:after:rotate-45">
                  {item.q}
                </summary>
                <p className="mb-5 max-w-[52rem] text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </ScrollRevealSection>
      </main>

      <ScrollRevealSection
        as="footer"
        className="mx-auto w-full max-w-[1160px] px-6 pb-10 pt-20 font-inter text-ink"
      >
        <div className="flex flex-wrap justify-between gap-10 border-t border-line pt-10">
          <div>
            <span className="text-xl font-medium tracking-tight text-ink">
              Zealed
            </span>
            <p className="mt-2.5 max-w-[20rem] text-[0.9rem] text-muted">
              Confidential prize savings. Save. Win privately.
            </p>
          </div>
          <nav
            aria-label="Footer"
            className="flex flex-col gap-[0.7rem] text-[0.9rem] [&_a]:text-muted [&_a:hover]:text-ink"
          >
            <AnchorLink href="#how-it-works">How it works</AnchorLink>
            <AnchorLink href="#visible-vs-sealed">Visible vs sealed</AnchorLink>
            <AnchorLink href="#privacy">Privacy</AnchorLink>
            <AnchorLink href="#contracts">The contracts</AnchorLink>
            <AnchorLink href="#faq">FAQ</AnchorLink>
            <LaunchAppLink>Launch app</LaunchAppLink>
          </nav>
        </div>
        <p className="mt-12 text-[0.82rem] text-muted">
          Built on the Zama Protocol. Running on Ethereum Sepolia testnet.
        </p>
      </ScrollRevealSection>
    </div>
  );
}
