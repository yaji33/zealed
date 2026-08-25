"use client";

import { useConnectWallet } from "@/hooks/useConnectWallet";
import { cardClass, cardHighlightClass } from "@/lib/uiClasses";

export function WalletGate() {
  const { connectWallet, canConnect, isPending, error, connector } = useConnectWallet();

  return (
    <section className={`${cardClass} px-8 py-14 text-center sm:px-12`}>
      <div className={cardHighlightClass} aria-hidden="true" />
      <p className="relative m-0 font-mono text-[0.68rem] tracking-[0.18em] text-ember/75">
        APP
      </p>
      <h1 className="relative mt-4 font-fraunces text-[clamp(1.75rem,3.5vw,2.4rem)] font-medium tracking-tight text-ink">
        Connect to enter
      </h1>
      <p className="relative mx-auto mt-4 max-w-[28rem] text-[1rem] leading-relaxed text-muted">
        Your balance, odds, and draw outcomes stay encrypted. Connect a wallet to unseal your
        position and deposit, withdraw, or claim.
      </p>
      <div className="relative mt-8 flex flex-col items-center gap-3">
        <button
          type="button"
          className="cursor-pointer appearance-none rounded bg-mint px-[1.15rem] py-[0.55rem] font-dm-sans font-medium text-void disabled:cursor-not-allowed disabled:opacity-45"
          disabled={isPending || !canConnect}
          onClick={() => void connectWallet()}
        >
          {isPending ? "Connecting…" : !connector ? "No wallet detected" : "Connect wallet"}
        </button>
        {!connector && (
          <p className="m-0 max-w-[24rem] text-[0.85rem] text-muted">
            Install a browser wallet, then refresh this page.
          </p>
        )}
        {error && <p className="m-0 max-w-[28rem] text-[0.88rem] text-danger">{error.message}</p>}
      </div>
    </section>
  );
}
