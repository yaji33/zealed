"use client";

import dynamic from "next/dynamic";
import { useAccount } from "wagmi";
import { WalletGate } from "@/components/WalletGate";
import { NetworkGuard } from "@/components/NetworkGuard";
import { PublicPoolOverview } from "@/components/PublicPoolOverview";
import { VaultSelector } from "@/components/VaultSelector";
import { useConnectWallet } from "@/hooks/useConnectWallet";
import { cardClass } from "@/lib/uiClasses";

function AppPanel({ message }: { message: string }) {
  return (
    <section className={`${cardClass} py-14 text-center`}>
      <p className="relative m-0 font-mono text-[0.68rem] tracking-[0.18em] text-ember/75">
        APP
      </p>
      <p className="relative mt-4 text-muted">{message}</p>
    </section>
  );
}

const PrivateDashboard = dynamic(
  () =>
    import("@/components/PrivateDashboard").then((m) => ({
      default: m.PrivateDashboard,
    })),
  {
    ssr: false,
    loading: () => <AppPanel message="Loading your position…" />,
  },
);

const VaultChart = dynamic(
  () =>
    import("@/components/VaultChart").then((m) => ({ default: m.VaultChart })),
  {
    ssr: false,
    loading: () => <AppPanel message="Loading pool data…" />,
  },
);

export function DashboardApp() {
  const { isConnected } = useAccount();
  const { ready } = useConnectWallet();

  return (
    <div className="flex flex-col gap-6">
      <VaultSelector />
      <PublicPoolOverview />
      <NetworkGuard>
        {!ready ? (
          <AppPanel message="Checking wallet…" />
        ) : isConnected ? (
          <PrivateDashboard />
        ) : (
          <WalletGate />
        )}
      </NetworkGuard>
      <VaultChart />
    </div>
  );
}
