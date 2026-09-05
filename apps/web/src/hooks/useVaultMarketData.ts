"use client";

import { useQuery } from "@tanstack/react-query";
import type { PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import {
  useVaultDirectory,
  type VaultSystem,
} from "@/components/VaultDirectoryProvider";
import { prizePoolAbi } from "@/lib/abi/zealed";
import { readPublicVaultTvl } from "@/lib/readVaultTvl";
import { wrapperDecimalsFor } from "@/lib/wrapperMeta";

export type VaultMarketRow = {
  system: VaultSystem;
  principalTvl?: bigint;
  availablePrizeLiquidity?: bigint;
  decimals: number;
};

async function loadRow(
  client: PublicClient,
  system: VaultSystem,
): Promise<VaultMarketRow> {
  const decimals = wrapperDecimalsFor(system.asset);
  try {
    const [principalTvl, availablePrizeLiquidity] = await Promise.all([
      readPublicVaultTvl(client, system.vault),
      client.readContract({
        address: system.prizePool,
        abi: prizePoolAbi,
        functionName: "availableLiquidity",
      }),
    ]);
    return { system, principalTvl, availablePrizeLiquidity, decimals };
  } catch {
    return { system, decimals };
  }
}

export function useVaultMarketData() {
  const client = usePublicClient();
  const { systems, isLoading: directoryLoading } = useVaultDirectory();
  const active = systems.filter((system) => system.active);

  const query = useQuery({
    queryKey: ["vault-market", active.map((system) => system.id)],
    enabled: Boolean(client && active.length > 0),
    staleTime: 8_000,
    refetchInterval: 20_000,
    queryFn: async (): Promise<VaultMarketRow[]> => {
      if (!client) return [];
      return Promise.all(active.map((system) => loadRow(client, system)));
    },
  });

  const fallbackRows: VaultMarketRow[] = active.map((system) => ({
    system,
    decimals: wrapperDecimalsFor(system.asset),
  }));

  return {
    rows: query.data ?? fallbackRows,
    isLoading: directoryLoading || query.isLoading,
    isError: query.isError,
  };
}
