"use client";

import dynamic from "next/dynamic";
import { useAccount } from "wagmi";
import { WalletGate } from "@/components/WalletGate";
import { useConnectWallet } from "@/hooks/useConnectWallet";
import { cardClass, sectionRuleClass } from "@/lib/uiClasses";

function AppPanel({ message }: { message: string }) {
  return (
    <section className={`${cardClass} py-14 text-center`}>
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

  return (
    <>
      {checking ? (
        <AppPanel message="Checking wallet…" />
      ) : isConnected ? (
        <PrivateDashboard />
      ) : (
        <WalletGate />
      )}
      <div className={sectionRuleClass} role="separator" />
      <PublicOverview />
    </>
  );
}
