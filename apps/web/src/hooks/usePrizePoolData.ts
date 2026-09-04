"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useBlockNumber, usePublicClient } from "wagmi";
import { useVaultDirectory } from "@/components/VaultDirectoryProvider";
import { prizePoolAbi } from "@/lib/abi/zealed";

export const PRIZE_TIERS = [
  { id: 0, name: "Grand", slots: 1 },
  { id: 1, name: "Standard", slots: 2 },
  { id: 2, name: "Community", slots: 4 },
] as const;

export type PrizeTierData = {
  id: 0 | 1 | 2;
  name: "Grand" | "Standard" | "Community";
  slots: number;
  share: number;
  prizePerSlot: bigint;
  allocation: bigint;
};

export type PrizePoolData = {
  availableLiquidity: bigint;
  reserveLiquidity: bigint;
  activeDrawId: bigint;
  activeClaimDeadline: bigint;
  tiers: PrizeTierData[];
};

const READ_MS = 12_000;

export function usePrizePoolData() {
  const client = usePublicClient();
  const queryClient = useQueryClient();
  const { selected } = useVaultDirectory();
  const pool = selected?.prizePool;
  const configured = Boolean(selected);
  const enabled = Boolean(client && pool && configured);
  const { data: blockNumber } = useBlockNumber({
    watch: true,
    query: { enabled, refetchInterval: READ_MS },
  });

  const query = useQuery({
    queryKey: ["prize-pool", pool],
    enabled,
    staleTime: 8_000,
    refetchInterval: READ_MS,
    queryFn: async (): Promise<PrizePoolData> => {
      if (!client || !pool) throw new Error("PrizePool is not configured.");

      const [
        availableLiquidity,
        reserveLiquidity,
        activeDrawId,
        activeClaimDeadline,
      ] = await Promise.all([
        client.readContract({
          address: pool,
          abi: prizePoolAbi,
          functionName: "availableLiquidity",
        }),
        client.readContract({
          address: pool,
          abi: prizePoolAbi,
          functionName: "reserveLiquidity",
        }),
        client.readContract({
          address: pool,
          abi: prizePoolAbi,
          functionName: "activeDrawId",
        }),
        client.readContract({
          address: pool,
          abi: prizePoolAbi,
          functionName: "activeClaimDeadline",
        }),
      ]);

      const tiers = await Promise.all(
        PRIZE_TIERS.map(async (tier): Promise<PrizeTierData> => {
          const [share, configuredSlots, prizePerSlot] = await Promise.all([
            client.readContract({
              address: pool,
              abi: prizePoolAbi,
              functionName: "tierShares",
              args: [tier.id],
            }),
            client.readContract({
              address: pool,
              abi: prizePoolAbi,
              functionName: "slotCount",
              args: [tier.id],
            }),
            client.readContract({
              address: pool,
              abi: prizePoolAbi,
              functionName: "prizePerSlot",
              args: [activeDrawId, tier.id],
            }),
          ]);
          const slots = Number(configuredSlots) || tier.slots;
          return {
            id: tier.id,
            name: tier.name,
            slots,
            share: Number(share),
            prizePerSlot,
            allocation: prizePerSlot * BigInt(slots),
          };
        }),
      );

      return {
        availableLiquidity,
        reserveLiquidity,
        activeDrawId,
        activeClaimDeadline,
        tiers,
      };
    },
  });

  useEffect(() => {
    if (blockNumber === undefined) return;
    void queryClient.invalidateQueries({ queryKey: ["prize-pool", pool] });
  }, [blockNumber, pool, queryClient]);

  return { ...query, configured };
}
