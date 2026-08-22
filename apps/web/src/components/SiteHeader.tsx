"use client";

import Link from "next/link";
import { useAccount, useConnect, useDisconnect } from "wagmi";

const btnBase =
  "cursor-pointer appearance-none rounded-btn border border-transparent bg-accent px-4 py-[0.65rem] font-semibold text-[#14110a] disabled:cursor-not-allowed disabled:opacity-45";

export function SiteHeader() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const connector = connectors[0];

  return (
    <header className="mb-8 flex items-center justify-between gap-4 border-b border-line pb-7 pt-3 max-[720px]:flex-col max-[720px]:items-start">
      <div className="flex flex-col gap-0.5">
        <Link
          href="/"
          className="text-[clamp(1.8rem,4vw,2.4rem)] font-bold tracking-tight"
        >
          Zealed
        </Link>
        <span className="text-[0.85rem] text-muted">confidential prize savings</span>
      </div>
      <nav className="flex items-center gap-4">
        <Link href="/" className="text-[0.95rem] text-muted hover:text-ink">
          Public
        </Link>
        <Link href="/dashboard" className="text-[0.95rem] text-muted hover:text-ink">
          Private
        </Link>
        {isConnected && address ? (
          <button
            type="button"
            className={`${btnBase} border-line bg-soft font-mono text-[0.85rem] text-ink`}
            onClick={() => disconnect()}
          >
            {shorten(address)}
          </button>
        ) : (
          <button
            type="button"
            className={btnBase}
            disabled={isPending || !connector}
            onClick={() => connector && connect({ connector })}
          >
            {isPending ? "Connecting…" : "Connect"}
          </button>
        )}
      </nav>
    </header>
  );
}

function shorten(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
