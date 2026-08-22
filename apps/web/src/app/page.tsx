import Image from "next/image";
import Link from "next/link";
import heroBg from "@/assets/hero-bg.png";
import { AsciiPoolField } from "@/components/AsciiPoolField";
import { HowItWorksSection } from "@/components/HowItWorksSection";
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

const VISIBLE_ITEMS = [
  "Pool total",
  "Prize size for each draw",
  "Draw schedule and the random value",
  "Verified contract code",
] as const;

const SEALED_ITEMS = [
  "Your deposit and balance",
  "Your odds of winning",
  "Whether you won or lost",
  "Your prize amount",
] as const;

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const sectionClass =
  "mx-auto w-full max-w-[1160px] px-6 pb-8 pt-[5.5rem] font-inter text-ink [&_h2]:m-0 [&_h2]:font-fraunces [&_h2]:text-[clamp(1.9rem,3.6vw,2.7rem)] [&_h2]:font-medium [&_h2]:tracking-tight [&_h2]:mb-9 [&_h3]:m-0 [&_h3]:font-medium";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-void font-inter leading-relaxed text-ink [&_h1]:m-0 [&_h2]:m-0 [&_h3]:m-0 [&_h1]:font-medium [&_h2]:font-medium [&_h3]:font-medium">
      <section className="relative flex min-h-svh overflow-hidden">
        <Image src={heroBg} alt="" fill priority className="z-0 object-cover object-center" />
        <div className="relative z-[1] mx-auto flex w-full max-w-[1160px] flex-col px-6 pb-6 pt-7">
          <header className="flex items-center justify-between font-dm-sans">
            <Link href="/" className="text-xl font-medium tracking-tight text-ink">
              Zealed
            </Link>
            <nav className="flex items-center gap-[1.4rem] text-[0.85rem] max-[760px]:gap-4">
              <a href="#how-it-works" className="text-ink">
                How it works
              </a>
              <a href="#faq" className="text-ink">
                FAQ
              </a>
              <span className="text-ink/55" aria-hidden="true">
                |
              </span>
              <Link
                href="/dashboard"
                className="rounded bg-mint px-[1.15rem] py-[0.55rem] font-medium text-void"
              >
                Launch App
              </Link>
            </nav>
          </header>

          <div className="mx-auto mt-10 flex max-w-[40rem] flex-1 flex-col items-center justify-center py-16 text-center max-[760px]:py-12">
            <h1 className="font-dm-sans text-[clamp(2.6rem,6.5vw,4.6rem)] font-medium leading-[1.08] tracking-tight text-ink">
              Save together.
              <br />
              Win in{" "}
              <em className="font-fraunces italic font-normal text-ember">private</em>.
            </h1>
            <p className="mt-6 max-w-[30rem] text-[1.02rem] text-ink/90">
              Deposit into a shared pool. Yield funds the prize. Your balance stays encrypted, and
              only you can see if you won.
            </p>
          </div>

          <AsciiPoolField />
        </div>
      </section>

      <HowItWorksSection />

      <section id="visible-vs-sealed" className={sectionClass}>
        <h2>Visible vs sealed</h2>
        <p className="-mt-7 mb-10 max-w-[44rem] text-muted">
          The pool is auditable. Your position is not. Everything needed to verify fairness is
          public, and everything about you stays encrypted.
        </p>
        <div className="grid grid-cols-2 gap-12 max-[760px]:grid-cols-1">
          <div className="border-t border-line pt-6">
            <h3 className="mb-5 font-dm-sans text-[1.1rem]">Visible to everyone</h3>
            <ul className="m-0 flex list-none flex-col gap-[0.85rem] p-0 text-muted [&_li]:before:mr-3 [&_li]:before:font-mono [&_li]:before:text-muted [&_li]:before:content-['+']">
              {VISIBLE_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="border-t border-line pt-6">
            <h3 className="mb-5 font-dm-sans text-[1.1rem] text-ember">Sealed to you</h3>
            <ul className="m-0 flex list-none flex-col gap-[0.85rem] p-0 text-muted [&_li]:before:mr-3 [&_li]:before:font-mono [&_li]:before:text-ember [&_li]:before:content-['#']">
              {SEALED_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="under-the-hood" className={sectionClass}>
        <h2>Under the hood</h2>
        <p className="-mt-7 mb-10 max-w-[44rem] text-muted">
          Zealed runs on the Zama Protocol&apos;s fhEVM. Contracts add, compare, and select over
          encrypted values without ever decrypting them. The only plaintext number in the draw is
          the public random value, and it reveals nothing about any position. Decryption happens
          once, on your device, with your key.
        </p>
        <div className="grid grid-cols-3 gap-5 max-[760px]:grid-cols-1">
          {CONTRACTS.map((contract) => (
            <article
              key={contract.name}
              className="flex flex-col gap-3 rounded-card border border-line p-6"
            >
              <h3 className="font-mono text-base font-medium">{contract.name}</h3>
              <p className="m-0 flex-1 text-[0.92rem] text-muted">{contract.body}</p>
              {contract.address ? (
                <a
                  className="font-mono text-[0.82rem] text-ember hover:underline hover:underline-offset-[3px]"
                  href={`https://sepolia.etherscan.io/address/${contract.address}#code`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortAddress(contract.address)}
                </a>
              ) : (
                <span className="font-mono text-[0.82rem] text-ember">not configured</span>
              )}
            </article>
          ))}
        </div>
      </section>

      <section id="faq" className={sectionClass}>
        <h2>FAQ</h2>
        <div className="max-w-[46rem] [&_details:last-child]:border-b [&_details]:border-t [&_details]:border-line">
          {FAQ.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-[1.15rem] font-dm-sans text-[1.02rem] font-medium [&::-webkit-details-marker]:hidden after:font-mono after:text-ember after:content-['+'] after:transition-transform group-open:after:rotate-45">
                {item.q}
              </summary>
              <p className="mb-5 max-w-[42rem] text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="mx-auto w-full max-w-[1160px] px-6 pb-10 pt-20 font-inter text-ink">
        <div className="flex flex-wrap justify-between gap-10 border-t border-line pt-10">
          <div>
            <span className="text-xl font-medium tracking-tight text-ink">Zealed</span>
            <p className="mt-2.5 max-w-[20rem] text-[0.9rem] text-muted">
              Confidential prize savings. Save together, win in private.
            </p>
          </div>
          <nav className="flex flex-col gap-[0.7rem] text-[0.9rem] [&_a]:text-muted [&_a:hover]:text-ink">
            <a href="#how-it-works">How it works</a>
            <a href="#visible-vs-sealed">Visible vs sealed</a>
            <a href="#under-the-hood">Under the hood</a>
            <a href="#faq">FAQ</a>
            <Link href="/dashboard">Launch app</Link>
          </nav>
        </div>
        <p className="mt-12 text-[0.82rem] text-muted">
          Built on the Zama Protocol. Running on Ethereum Sepolia testnet.
        </p>
      </footer>
    </div>
  );
}
