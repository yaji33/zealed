"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect } from "react";
import { useAccount } from "wagmi";
import { EmptyState } from "@/components/EmptyState";
import { WalletGate } from "@/components/WalletGate";
import { NetworkGuard } from "@/components/NetworkGuard";
import { PublicPoolOverview } from "@/components/PublicPoolOverview";
import { VaultSelector } from "@/components/VaultSelector";
import { useVaultDirectory } from "@/components/VaultDirectoryProvider";
import { useConnectWallet } from "@/hooks/useConnectWallet";
import { btnSecondaryClass, cardClass } from "@/lib/uiClasses";
import { VAULTS_PATH } from "@/lib/vaultPath";

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

export function DashboardApp({ slug }: { slug: string }) {
  const { isConnected } = useAccount();
  const { ready } = useConnectWallet();
  const { systems, selected, selectVault, isLoading } = useVaultDirectory();
  const match = systems.find(
    (system) => system.active && system.slug === slug.toLowerCase(),
  );

  useEffect(() => {
    if (!match) return;
    if (selected?.id !== match.id) selectVault(match.id);
  }, [match, selectVault, selected?.id]);

  if (!isLoading && systems.length > 0 && !match) {
    return (
      <EmptyState
        eyebrow="VAULT"
        title="That vault is not in the live registry."
        body="It may have been removed from discovery. Principal withdrawal still works on the recorded contracts."
        action={
          <Link className={btnSecondaryClass} href={VAULTS_PATH}>
            Back to vaults
          </Link>
        }
      />
    );
  }

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
