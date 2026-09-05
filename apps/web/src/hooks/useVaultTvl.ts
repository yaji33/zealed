"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { useVaultDirectory } from "@/components/VaultDirectoryProvider";
import { readPublicVaultTvl } from "@/lib/readVaultTvl";

export function useVaultTvl() {
  const publicClient = usePublicClient();
  const { selected } = useVaultDirectory();
  const vault = selected?.vault;

  return useQuery({
    queryKey: ["vault-tvl", vault],
    enabled: Boolean(publicClient && vault),
    staleTime: 8_000,
    refetchInterval: 12_000,
    queryFn: async (): Promise<bigint> => {
      if (!publicClient || !vault) return 0n;
      return readPublicVaultTvl(publicClient, vault);
    },
  });
}
