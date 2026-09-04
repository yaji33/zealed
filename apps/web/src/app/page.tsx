import Image from "next/image";
import heroBg from "@/assets/hero-bg.png";
import { HowItWorksSection } from "@/components/HowItWorksSection";
import { LandingHero } from "@/components/LandingHero";
import { LaunchAppLink } from "@/components/LaunchAppLink";
import { AnchorLink } from "@/components/motion/AnchorLink";
import { ScrollRevealSection } from "@/components/motion/ScrollRevealSection";
import { StaggerGrid, StaggerItem } from "@/components/motion/StaggerGrid";
import { VisibleVsSealedSection } from "@/components/VisibleVsSealedSection";
import { addresses } from "@/lib/config";

const CONTRACTS = [
  {
    name: "ConfidentialVault",
    address: addresses.vault,
    body: "One principal custodian inside each curated asset system. Tracks encrypted balances and keeps withdrawal available through every draw phase.",
  },
  {
    name: "TicketEngine",
    address: addresses.ticketEngine,
    body: "Versions encrypted balance-time checkpoints in a Fenwick tree so closed draws stay immutable while later deposits update a new active version.",
  },
  {
    name: "PrizePool",
    address: addresses.prizePool,
    body: "Isolates sponsor-funded mock yield from principal. Allocates bounded Grand, Standard, and Community tiers plus reserve and rollover.",
  },
  {
    name: "DrawManager",
    address: addresses.drawManager,
    body: "Stores one encrypted FHE.randEuint64() value per bounded prize slot. Users check one slot at a time; nothing loops over depositors.",
  },
] as const;

const FAQ = [
  {
    q: "Can I lose my deposit?",
    a: "No. Principal stays in ConfidentialVault and is withdrawable at any time. Prizes are paid only from PrizePool sponsor-funded mock yield, never from saver principal.",
  },
  {
    q: "If balances are encrypted, how can the draw be fair?",
    a: "Each prize slot stores an encrypted random value generated onchain with FHE.randEuint64(). Your client compares that value against your encrypted historical range. Fairness does not require publishing your balance.",
  },
  {
    q: "Can anyone tell whether I won?",
    a: "No. You check your own tier slot, and the answer stays encrypted. A losing check and a winning check look the same onchain. Optional tier-only disclosure never publishes the prize amount.",
  },
  {
    q: "What can the public actually see?",
    a: "Aggregates only: principal TVL when published, available prize liquidity, reserve, tier allocations and slot counts, draw lifecycle, and snapshot versions. Individual deposits, odds, outcomes, and prize amounts stay sealed.",
  },
  {
    q: "What asset does the pool hold?",
    a: "Zealed supports curated asset-specific ERC-7984 vaults. Each vault has isolated principal, eligibility snapshots, draws, and prize liquidity. The Sepolia faucet mints the selected vault's official mock underlying (cUSDC or cUSDT).",
  },
  {
    q: "Is this live?",
    a: "Yes. The verified Sepolia registry exposes independent cUSDCMock and cUSDTMock vault systems with isolated principal, draws, and prize liquidity.",
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
      <section className="relative flex min-h-svh overflow-hidden">
        <Image
          src={heroBg}
          alt=""
          fill
          priority
          className="z-0 object-cover object-center"
        />
        <LandingHero />
      </section>

      <HowItWorksSection />

      <VisibleVsSealedSection />

      <ScrollRevealSection id="contracts" className={sectionClass}>
        <h2>The contracts</h2>
        <p className="-mt-7 mb-10 max-w-[44rem] text-muted">
          Zealed runs on the Zama Protocol&apos;s fhEVM with one principal vault
          and a separate prize pool. Contracts add, compare, and select over
          encrypted values without decrypting them. Per-slot randomness stays
          encrypted; decryption of your own result happens on your device with
          your key.
        </p>
        <StaggerGrid className="grid grid-cols-2 gap-5 max-[760px]:grid-cols-1 xl:grid-cols-4">
          {CONTRACTS.map((contract) => (
            <StaggerItem
              key={contract.name}
              className="relative flex flex-col gap-3 overflow-hidden rounded-lg bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.06] to-transparent"
                aria-hidden="true"
              />
              <h3 className="relative font-mono text-base font-medium">
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
          {FAQ.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-[1.15rem] font-dm-sans text-[1.02rem] font-medium [&::-webkit-details-marker]:hidden after:font-mono after:text-ember after:content-['+'] after:transition-transform group-open:after:rotate-45">
                {item.q}
              </summary>
              <p className="mb-5 max-w-[52rem] text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </ScrollRevealSection>

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
              Confidential prize savings. Save together, win in private.
            </p>
          </div>
          <nav
            aria-label="Footer"
            className="flex flex-col gap-[0.7rem] text-[0.9rem] [&_a]:text-muted [&_a:hover]:text-ink"
          >
            <AnchorLink href="#how-it-works">How it works</AnchorLink>
            <AnchorLink href="#visible-vs-sealed">Visible vs sealed</AnchorLink>
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
