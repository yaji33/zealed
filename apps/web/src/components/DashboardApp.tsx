"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useAccount } from "wagmi";
import { SiteHeader } from "@/components/SiteHeader";
import { WalletGate } from "@/components/WalletGate";
import { useConnectWallet } from "@/hooks/useConnectWallet";
import { endAppTransition } from "@/lib/appTransition";
import { prefetchDashboardChunks } from "@/lib/prefetchApp";
import { cardClass, cardHighlightClass } from "@/lib/uiClasses";

function AppPanel({ message }: { message: string }) {
  return (
    <section className={`${cardClass} py-14 text-center`}>
      <div className={cardHighlightClass} aria-hidden="true" />
      <p className="relative m-0 font-mono text-[0.68rem] tracking-[0.18em] text-ember/75">APP</p>
      <p className="relative mt-4 text-muted">{message}</p>
    </section>
  );
}

const PrivateDashboard = dynamic(
  () =>
    import("@/components/PrivateDashboard").then((m) => ({ default: m.PrivateDashboard })),
  {
    ssr: false,
    loading: () => <AppPanel message="Loading your position…" />,
  },
);

const PublicOverview = dynamic(
  () => import("@/components/PublicOverview").then((m) => ({ default: m.PublicOverview })),
  {
    ssr: false,
    loading: () => <AppPanel message="Loading pool data…" />,
  },
);

export function DashboardApp() {
  const { isConnected, status } = useAccount();
  const { isPending: isConnectPending } = useConnectWallet();
  const checking = status === "connecting" || isConnectPending;

  useEffect(() => {
    endAppTransition();
  }, []);

  useEffect(() => {
    prefetchDashboardChunks();
  }, []);

  return (
    <div className="min-h-svh bg-void text-ink">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-8">
        {checking ? (
          <AppPanel message="Checking wallet…" />
        ) : isConnected ? (
          <PrivateDashboard />
        ) : (
          <WalletGate />
        )}
        <PublicOverview />
      </main>
    </div>
  );
}
