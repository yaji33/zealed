"use client";

import type { ReactNode } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { bannerWarnClass, btnClass } from "@/lib/uiClasses";
import { noticeFromWalletError } from "@/lib/walletError";
import { StatusNotice } from "@/components/StatusNotice";

export function NetworkGuard({ children }: { children: ReactNode }) {
  const { chainId, isConnected } = useAccount();
  const { switchChain, isPending, error } = useSwitchChain();
  const wrongNetwork = isConnected && chainId !== sepolia.id;

  if (!wrongNetwork) return <>{children}</>;

  return (
    <section className={bannerWarnClass} role="alert">
      <h2 className="m-0 font-dm-sans text-lg font-medium text-ink">Switch to Sepolia</h2>
      <p className="mb-4 mt-2">Transactions run on Ethereum Sepolia.</p>
      <button
        type="button"
        className={btnClass}
        disabled={isPending}
        onClick={() => switchChain({ chainId: sepolia.id })}
      >
        {isPending ? "Switching…" : "Switch network"}
      </button>
      {error ? (
        <StatusNotice kind="err">
          {noticeFromWalletError(error, "Could not switch network.").text}
        </StatusNotice>
      ) : null}
    </section>
  );
}
