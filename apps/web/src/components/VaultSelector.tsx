"use client";

import { usePathname, useRouter } from "next/navigation";
import type { Hex } from "viem";
import { useVaultDirectory } from "@/components/VaultDirectoryProvider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TokenIcon } from "@/components/TokenIcon";
import { bannerWarnClass } from "@/lib/uiClasses";
import {
  FAUCET_PATH,
  isVaultWorkspacePath,
  vaultWorkspacePath,
} from "@/lib/vaultPath";

export function VaultSelector() {
  const router = useRouter();
  const pathname = usePathname();
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
      <p className={bannerWarnClass}>No active confidential vault is configured.</p>
    );
  }

  function onVaultChange(value: string) {
    const id = value as Hex;
    selectVault(id);
    const next = activeSystems.find((system) => system.id === id);
    if (!next) return;
    if (isVaultWorkspacePath(pathname)) {
      router.push(vaultWorkspacePath(next.slug));
    } else if (pathname.startsWith(FAUCET_PATH)) {
      router.push(FAUCET_PATH);
    }
  }

  return (
    <section
      className="flex items-center justify-between gap-3 rounded-lg border border-edge bg-panel px-4 py-3"
      aria-label="Prize vault selection"
    >
      <div className="flex min-w-0 items-center gap-3">
        <TokenIcon
          asset={selected.asset}
          label={selected.label}
          size={32}
        />
        <div className="min-w-0">
          <p className="m-0 font-mono text-[0.65rem] tracking-[0.18em] text-ember">
            ACTIVE VAULT
          </p>
          <p className="mt-0.5 truncate text-sm text-muted">Each vault is isolated.</p>
        </div>
      </div>
      <div className="flex min-w-44 flex-col gap-1.5">
        <p id="vault-select-label" className="m-0 text-xs text-muted">
          Save with
        </p>
        <Select
          value={selected.id}
          onValueChange={onVaultChange}
          disabled={activeSystems.length < 2}
        >
          <SelectTrigger
            className="w-44"
            aria-labelledby="vault-select-label"
          >
            <SelectValue placeholder="Select vault" />
          </SelectTrigger>
          <SelectContent side="bottom" align="end" sideOffset={8}>
            {activeSystems.map((system) => (
              <SelectItem key={system.id} value={system.id} textValue={system.label}>
                <TokenIcon
                  asset={system.asset}
                  label={system.label}
                  size={20}
                />
                <SelectItemText>{system.label}</SelectItemText>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </section>
  );
}
