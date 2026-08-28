"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { Hex } from "viem";
import { addresses } from "@/lib/config";
import { vaultAbi } from "@/lib/abi/zealed";
import { getFhevmInstance } from "@/lib/relayerSdk";

/**
 * Public self-relay decrypt of ConfidentialVault.totalDeposits (aggregate TVL).
 * No wallet required — same disclosure class as TicketEngine.totalTickets.
 */
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

      if (!handle || /^0x0+$/.test(handle)) return 0n;

      const instance = await getFhevmInstance();
      const result = await instance.publicDecrypt([handle]);
      const value = result.clearValues[handle];
      if (typeof value === "bigint") return value;
      if (typeof value === "number") return BigInt(value);
      if (typeof value === "string") return BigInt(value);
      throw new Error("Unexpected publicDecrypt result for vault TVL");
    },
  });
}
