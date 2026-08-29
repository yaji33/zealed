"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { Hex } from "viem";
import { addresses } from "@/lib/config";
import { vaultAbi } from "@/lib/abi/zealed";
import { getFhevmInstance } from "@/lib/relayerSdk";
import { isZeroHandle, readClearValue } from "@/lib/publicDecrypt";

export function useVaultTvl() {
  const publicClient = usePublicClient();
  const vault = addresses.vault;

  return useQuery({
    queryKey: ["vault-tvl", vault],
    enabled: Boolean(publicClient && vault),
    refetchInterval: 30_000,
    queryFn: async (): Promise<bigint> => {
      if (!publicClient || !vault) return 0n;

      const handle = (await publicClient.readContract({
        address: vault,
        abi: vaultAbi,
        functionName: "totalDeposits",
      })) as Hex;

      if (isZeroHandle(handle)) return 0n;

      const instance = await getFhevmInstance();
      const result = await instance.publicDecrypt([handle]);
      const value = readClearValue(result.clearValues as Record<string, unknown>, handle);
      if (value === undefined) throw new Error("Unexpected publicDecrypt result for vault TVL");
      return value;
    },
  });
}
