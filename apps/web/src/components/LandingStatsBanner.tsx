"use client";

import { useVaultDirectory } from "@/components/VaultDirectoryProvider";

export function LandingStatsBanner() {
  const { systems, isLoading } = useVaultDirectory();
  const vaultCount = systems.filter((system) => system.active).length;

  return (
    <div className="mx-auto mt-4 flex w-full max-w-[36rem] items-stretch justify-center gap-0 overflow-hidden rounded-lg border border-line/50 bg-base/70">
      <Stat label="Vaults" value={isLoading ? "…" : String(vaultCount)} />
      <Stat label="Chain" value="Sepolia" />
      <Stat label="Draws" value="Onchain FHE" />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 border-r border-line/40 px-4 py-4 last:border-r-0">
      <p className="m-0 font-mono text-[0.62rem] tracking-[0.16em] text-muted">
        {label.toUpperCase()}
      </p>
      <p className="m-0 font-dm-sans text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}
