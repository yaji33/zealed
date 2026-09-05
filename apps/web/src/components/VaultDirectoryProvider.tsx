"use client";

import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { hexToString, isAddress, type Address, type Hex } from "viem";
import { usePublicClient } from "wagmi";
import { vaultRegistryAbi } from "@/lib/abi/vaultRegistry";
import { addresses } from "@/lib/addresses";
import { slugFromVaultId } from "@/lib/vaultPath";
import { metaForAsset, metaForSlug } from "@/lib/wrapperMeta";

export type VaultSystem = {
  id: Hex;
  slug: string;
  label: string;
  asset: Address;
  vault: Address;
  ticketEngine: Address;
  prizePool: Address;
  drawManager: Address;
  active: boolean;
};

type VaultDirectoryValue = {
  systems: VaultSystem[];
  selected: VaultSystem | undefined;
  selectVault: (id: Hex) => void;
  registryConfigured: boolean;
  isLoading: boolean;
  isError: boolean;
};

const VaultDirectoryContext = createContext<VaultDirectoryValue | undefined>(
  undefined,
);
const STORAGE_KEY = "zealed:selected-vault";

function registryAddress(): Address | undefined {
  const value = process.env.NEXT_PUBLIC_VAULT_REGISTRY_ADDRESS?.trim();
  return value && isAddress(value) ? value : undefined;
}

function fallbackSystem(): VaultSystem | undefined {
  if (
    !addresses.asset ||
    !addresses.vault ||
    !addresses.ticketEngine ||
    !addresses.prizePool ||
    !addresses.drawManager
  ) {
    return undefined;
  }
  const slug = "cusdc";
  return {
    id: "0x6375736463000000000000000000000000000000000000000000000000000000",
    slug,
    label: metaForAsset(addresses.asset)?.shortLabel ?? "cUSDC",
    asset: addresses.asset,
    vault: addresses.vault,
    ticketEngine: addresses.ticketEngine,
    prizePool: addresses.prizePool,
    drawManager: addresses.drawManager,
    active: true,
  };
}

function labelFor(id: Hex, asset: Address): string {
  const fromAsset = metaForAsset(asset)?.shortLabel;
  if (fromAsset) return fromAsset;
  const slug = slugFromVaultId(id);
  const fromSlug = metaForSlug(slug)?.shortLabel;
  if (fromSlug) return fromSlug;
  try {
    const label = hexToString(id, { size: 32 }).replaceAll("\0", "");
    if (/^c[a-z0-9]+$/i.test(label) && label.length > 1) {
      return `c${label.slice(1).toUpperCase()}`;
    }
    return label || "Vault";
  } catch {
    return "Vault";
  }
}

export function VaultDirectoryProvider({ children }: { children: ReactNode }) {
  const client = usePublicClient();
  const registry = registryAddress();
  const fallback = useMemo(() => fallbackSystem(), []);
  const [selectedId, setSelectedId] = useState<Hex | undefined>();

  const directory = useQuery({
    queryKey: ["vault-directory", registry],
    enabled: Boolean(client && registry),
    staleTime: 30_000,
    refetchInterval: 30_000,
    queryFn: async (): Promise<VaultSystem[]> => {
      if (!client || !registry) return [];
      const count = await client.readContract({
        address: registry,
        abi: vaultRegistryAbi,
        functionName: "vaultCount",
      });
      const ids = await Promise.all(
        Array.from({ length: Number(count) }, (_, index) =>
          client.readContract({
            address: registry,
            abi: vaultRegistryAbi,
            functionName: "vaultIdAt",
            args: [BigInt(index)],
          }),
        ),
      );
      const systems = await Promise.all(
        ids.map((id) =>
          client.readContract({
            address: registry,
            abi: vaultRegistryAbi,
            functionName: "getVault",
            args: [id],
          }),
        ),
      );
      return systems.map((system, index) => ({
        id: ids[index],
        slug: slugFromVaultId(ids[index]),
        label: labelFor(ids[index], system.asset),
        asset: system.asset,
        vault: system.vault,
        ticketEngine: system.ticketEngine,
        prizePool: system.prizePool,
        drawManager: system.drawManager,
        active: system.active,
      }));
    },
  });

  const systems = useMemo(() => {
    if (registry) return directory.data ?? [];
    return fallback ? [fallback] : [];
  }, [directory.data, fallback, registry]);
  const activeSystems = useMemo(
    () => systems.filter((system) => system.active),
    [systems],
  );
  const selected =
    activeSystems.find((system) => system.id === selectedId) ??
    activeSystems[0];

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored?.startsWith("0x")) setSelectedId(stored as Hex);
  }, []);

  const selectVault = useCallback(
    (id: Hex) => {
      if (!activeSystems.some((system) => system.id === id)) return;
      setSelectedId(id);
      window.localStorage.setItem(STORAGE_KEY, id);
    },
    [activeSystems],
  );

  const value = useMemo<VaultDirectoryValue>(
    () => ({
      systems,
      selected,
      selectVault,
      registryConfigured: Boolean(registry),
      isLoading: directory.isLoading,
      isError: directory.isError,
    }),
    [
      directory.isError,
      directory.isLoading,
      registry,
      selectVault,
      selected,
      systems,
    ],
  );

  return (
    <VaultDirectoryContext.Provider value={value}>
      {children}
    </VaultDirectoryContext.Provider>
  );
}

export function useVaultDirectory(): VaultDirectoryValue {
  const value = useContext(VaultDirectoryContext);
  if (!value)
    throw new Error(
      "useVaultDirectory must be used inside VaultDirectoryProvider",
    );
  return value;
}
