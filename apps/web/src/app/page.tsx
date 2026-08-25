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
    body: "Holds the pool. Tracks each encrypted balance and its time-weighted average homomorphically. Deposit and withdraw anytime, with no lockup.",
  },
  {
    name: "TicketEngine",
    address: addresses.ticketEngine,
    body: "Turns encrypted balances into encrypted ticket weights, kept in a Fenwick tree so every update costs O(log n) and never touches another user's slot.",
  },
  {
    name: "DrawManager",
    address: addresses.drawManager,
    body: "Fixes the random value by commit and reveal, then answers checkIfWon per user with one encrypted range comparison. Nothing loops over depositors.",
  },
] as const;

const FAQ = [
  {
    q: "Can I lose my deposit?",
    a: "No. This is a no-loss design: only the yield the pool generates is drawn as prizes. Your principal is withdrawable at any time, and withdrawal is never gated by a draw cycle.",
  },
  {
    q: "If balances are encrypted, how can the draw be fair?",
    a: "The random value is public and fixed by commit and reveal against a future block hash, so anyone can verify it was not manipulated. It is compared against your encrypted ticket range onchain, so fairness is checkable without any balance ever being visible.",
  },
  {
    q: "Can anyone tell whether I won?",
    a: "No. You check your own result, and the answer comes back encrypted to your key. A losing check and a winning check are indistinguishable onchain. If you want to, you can optionally publish that you won a tier, without the amount. That switch is off by default.",
  },
  {
    q: "What can the public actually see?",
    a: "Aggregates only: the pool total, each draw's prize size, the draw schedule, and the random value. Individual deposits, balances, odds, and outcomes stay sealed.",
  },
  {
    q: "What asset does the pool hold?",
    a: "Confidential USDC (cUSDC), an encrypted ERC-7984 token from the Zama wrappers registry. Amounts move as ciphertext end to end.",
  },
  {
    q: "Is this live?",
    a: "Yes, on Ethereum Sepolia. All three contracts are deployed and verified on Etherscan, and the full flow runs against the live network: deposit, withdraw, draw settlement, and prize decryption.",
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
        <Image src={heroBg} alt="" fill priority className="z-0 object-cover object-center" />
        <LandingHero />
      </section>

      <HowItWorksSection />

      <VisibleVsSealedSection />

      <ScrollRevealSection id="contracts" className={sectionClass}>
        <h2>The contracts</h2>
        <p className="-mt-7 mb-10 max-w-[44rem] text-muted">
          Zealed runs on the Zama Protocol&apos;s fhEVM. Contracts add, compare, and select over
          encrypted values without ever decrypting them. The only plaintext number in the draw is
          the public random value, and it reveals nothing about any position. Decryption happens
          once, on your device, with your key.
        </p>
        <StaggerGrid className="grid grid-cols-3 gap-5 max-[760px]:grid-cols-1">
          {CONTRACTS.map((contract) => (
            <StaggerItem
              key={contract.name}
              className="relative flex flex-col gap-3 overflow-hidden rounded-lg bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.06] to-transparent"
                aria-hidden="true"
              />
              <h3 className="relative font-mono text-base font-medium">{contract.name}</h3>
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
                <span className="relative font-mono text-[0.82rem] text-ember">not configured</span>
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

      <ScrollRevealSection as="footer" className="mx-auto w-full max-w-[1160px] px-6 pb-10 pt-20 font-inter text-ink">
        <div className="flex flex-wrap justify-between gap-10 border-t border-line pt-10">
          <div>
            <span className="text-xl font-medium tracking-tight text-ink">Zealed</span>
            <p className="mt-2.5 max-w-[20rem] text-[0.9rem] text-muted">
              Confidential prize savings. Save together, win in private.
            </p>
          </div>
          <nav className="flex flex-col gap-[0.7rem] text-[0.9rem] [&_a]:text-muted [&_a:hover]:text-ink">
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
