"use client";

import type { Hex } from "viem";
import { useVaultDirectory } from "@/components/VaultDirectoryProvider";
import { bannerWarnClass, fieldClass } from "@/lib/uiClasses";

export function VaultSelector() {
  const {
    systems,
    selected,
    selectVault,
    registryConfigured,
    isLoading,
    isError,
  } = useVaultDirectory();
  const activeSystems = systems.filter((system) => system.active);

  if (isLoading && registryConfigured) {
    return <p className={bannerWarnClass}>Loading confidential vaults…</p>;
  }
  if (isError && registryConfigured) {
    return (
      <p className={bannerWarnClass}>
        Vault discovery is temporarily unavailable. Direct legacy withdrawal
        remains available through the recorded legacy deployment.
      </p>
    );
  }
  if (!selected) {
    return (
      <p className={bannerWarnClass}>
        No active confidential vault is configured.
      </p>
    );
  }

  return (
    <section
      className="flex flex-col justify-between gap-3 rounded-lg border border-edge bg-panel px-4 py-3 sm:flex-row sm:items-center"
      aria-label="Prize vault selection"
    >
      <div>
        <p className="m-0 font-mono text-[0.65rem] tracking-[0.18em] text-ember">
          ACTIVE VAULT
        </p>
        <p className="mt-1 text-sm text-muted">
          Every vault has isolated principal, eligibility snapshots, draws, and
          prize liquidity.
        </p>
      </div>
      <label className="flex min-w-48 flex-col gap-1 text-xs text-muted">
        Save with
        <select
          className={fieldClass}
          value={selected.id}
          onChange={(event) => selectVault(event.target.value as Hex)}
          disabled={activeSystems.length < 2}
        >
          {activeSystems.map((system) => (
            <option key={system.id} value={system.id}>
              {system.label}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
