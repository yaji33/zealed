"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useDisconnect } from "wagmi";
import { useConnectWallet } from "@/hooks/useConnectWallet";

const btnMint =
  "cursor-pointer appearance-none rounded bg-mint px-[1.15rem] py-[0.55rem] font-medium text-void disabled:cursor-not-allowed disabled:opacity-45";

const btnWallet =
  "cursor-pointer appearance-none rounded bg-mint/15 px-[1.15rem] py-[0.55rem] font-mono text-[0.85rem] font-medium text-ink disabled:cursor-not-allowed disabled:opacity-45";

export function SiteHeader() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { connectWallet, canConnect, isPending, error } = useConnectWallet();
  const { disconnect } = useDisconnect();
  const faucetActive = pathname === "/dashboard/faucet" || pathname.startsWith("/dashboard/faucet/");

  return (
    <header className="sticky top-0 z-50 border-b border-line/30 bg-base/70 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-2 px-4 py-5 font-dm-sans max-[760px]:px-4">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="text-2xl font-bold tracking-tight text-ink">
            Zealed
          </Link>
          <nav className="flex items-center gap-[1.4rem] text-[0.85rem] max-[760px]:gap-4">
            <Link
              href="/dashboard/faucet"
              className="text-ink"
              aria-current={faucetActive ? "page" : undefined}
            >
              Faucet
            </Link>
            <span className="text-ink/55" aria-hidden="true">
              |
            </span>
            {isConnected && address ? (
              <button type="button" className={btnWallet} onClick={() => disconnect()}>
                {shorten(address)}
              </button>
            ) : (
              <button
                type="button"
                className={btnMint}
                disabled={isPending || !canConnect}
                onClick={() => void connectWallet()}
              >
                {isPending ? "Connecting…" : "Connect"}
              </button>
            )}
          </nav>
        </div>
        {error && !isConnected && (
          <p className="m-0 text-right text-[0.8rem] text-danger">{error.message}</p>
        )}
      </div>
    </header>
  );
}

function shorten(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
