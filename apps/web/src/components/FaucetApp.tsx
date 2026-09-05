"use client";

import dynamic from "next/dynamic";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import { useAccount } from "wagmi";
import { AppIcon } from "@/components/AppIcon";
import { HeroBanner } from "@/components/HeroBanner";
import { VaultSelector } from "@/components/VaultSelector";
import { WalletGate } from "@/components/WalletGate";
import { useConnectWallet } from "@/hooks/useConnectWallet";
import { useVaultDirectory } from "@/components/VaultDirectoryProvider";
import { cardClass } from "@/lib/uiClasses";

function AppPanel({ message }: { message: string }) {
  return (
    <section className={`${cardClass} py-14 text-center`}>
      <p className="relative m-0 font-mono text-[0.68rem] tracking-[0.18em] text-ember/75">
        FAUCET
      </p>
      <p className="relative mt-4 text-muted">{message}</p>
    </section>
  );
}

const CusdcFaucetCard = dynamic(
  () =>
    import("@/components/CusdcFaucetCard").then((m) => ({
      default: m.CusdcFaucetCard,
    })),
  {
    ssr: false,
    loading: () => <AppPanel message="Loading faucet…" />,
  },
);

export function FaucetApp() {
  const { isConnected } = useAccount();
  const { ready } = useConnectWallet();
  const { selected } = useVaultDirectory();
  const assetLabel = selected?.label ?? "tokens";

  if (!ready) {
    return <AppPanel message="Checking wallet…" />;
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col gap-6">
        <HeroBanner
          icon={<AppIcon icon={WaterDropIcon} size={22} />}
          headline="Mint, wrap, deposit."
          line={`Get test ${assetLabel} for the selected vault.`}
        />
        <WalletGate />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <HeroBanner
        icon={<AppIcon icon={WaterDropIcon} size={22} />}
        headline="Mint, wrap, deposit."
        line={`Get test ${assetLabel} for the selected vault.`}
      />
      <VaultSelector />
      <CusdcFaucetCard />
    </div>
  );
}
