"use client";

import type { ReactNode } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { bannerWarnClass, btnClass } from "@/lib/uiClasses";
import { noticeFromWalletError } from "@/lib/walletError";

export function NetworkGuard({ children }: { children: ReactNode }) {
  const { chainId, isConnected } = useAccount();
  const { switchChain, isPending, error } = useSwitchChain();
  const wrongNetwork = isConnected && chainId !== sepolia.id;

  if (!wrongNetwork) return <>{children}</>;

  return (
    <section className={bannerWarnClass} role="alert">
      <h2 className="m-0 font-dm-sans text-lg font-medium text-ink">Switch to Sepolia</h2>
      <p className="mb-4 mt-2">
        Zealed transactions are configured for Ethereum Sepolia. Switch networks before continuing.
      </p>
      <button
        type="button"
        className={btnClass}
        disabled={isPending}
        onClick={() => switchChain({ chainId: sepolia.id })}
      >
        {isPending ? "Switching…" : "Switch network"}
      </button>
      {error ? (
        <p className="mb-0 mt-3">{noticeFromWalletError(error, "Could not switch network.").text}</p>
      ) : null}
    </section>
  );
}
