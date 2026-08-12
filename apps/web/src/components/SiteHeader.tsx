"use client";

import Link from "next/link";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export function SiteHeader() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const connector = connectors[0];

  return (
    <header className="site-header">
      <div className="brand-lockup">
        <Link href="/" className="brand">
          Zealed
        </Link>
        <span className="brand-tag">confidential prize savings</span>
      </div>
      <nav className="nav">
        <Link href="/">Public</Link>
        <Link href="/dashboard">Private</Link>
        {isConnected && address ? (
          <button type="button" className="btn ghost" onClick={() => disconnect()}>
            {shorten(address)}
          </button>
        ) : (
          <button
            type="button"
            className="btn"
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
