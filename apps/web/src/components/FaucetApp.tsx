"use client";

import dynamic from "next/dynamic";
import { useAccount } from "wagmi";
import { WalletGate } from "@/components/WalletGate";
import { useConnectWallet } from "@/hooks/useConnectWallet";
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
  () => import("@/components/CusdcFaucetCard").then((m) => ({ default: m.CusdcFaucetCard })),
  {
    ssr: false,
    loading: () => <AppPanel message="Loading faucet…" />,
  },
);

export function FaucetApp() {
  const { isConnected } = useAccount();
  const { ready } = useConnectWallet();

  if (!ready) {
    return <AppPanel message="Checking wallet…" />;
  }

  if (!isConnected) {
    return <WalletGate />;
  }

  return <CusdcFaucetCard />;
}
