"use client";

import { useQuery } from "@tanstack/react-query";
import { useBlockNumber, useReadContract, usePublicClient } from "wagmi";
import { useVaultDirectory } from "@/components/VaultDirectoryProvider";
import { drawManagerAbi, prizePoolAbi } from "@/lib/abi/zealed";
import { PRIZE_TIERS } from "@/hooks/usePrizePoolData";

export type DrawHistoryRow = {
  drawId: bigint;
  startTime: number;
  endTime: number;
  claimDeadline: number;
  prizeAmount: bigint;
  settled: boolean;
  reconciled: boolean;
};

type DrawTuple = readonly [
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  boolean,
  boolean,
  boolean,
  boolean,
];

export function adaptDrawHistoryRow(
  drawId: bigint,
  state: DrawTuple,
  prizeAmount: bigint,
): DrawHistoryRow {
  return {
    drawId,
    startTime: Number(state[1]),
    endTime: Number(state[3]),
    claimDeadline: Number(state[5]),
    prizeAmount,
    settled: state[7],
    reconciled: state[9],
  };
}

const READ_MS = 12_000;

/** Public draw history. Prize totals are aggregate tier allocations, never user outcomes. */
export function usePublicDrawData() {
  const client = usePublicClient();
  const { selected } = useVaultDirectory();
  const drawManager = selected?.drawManager;
  const prizePool = selected?.prizePool;
  const enabled = Boolean(selected);

  const { data: drawId } = useReadContract({
    address: drawManager,
    abi: drawManagerAbi,
    functionName: "drawId",
    query: { enabled, refetchInterval: READ_MS },
  });
  const { data: blockNumber } = useBlockNumber({
    watch: true,
    query: { enabled, refetchInterval: READ_MS },
  });

  const historyQuery = useQuery({
    queryKey: [
      "draw-history",
      drawManager,
      prizePool,
      drawId?.toString(),
      blockNumber?.toString(),
    ],
    enabled: Boolean(
      enabled && client && drawManager && prizePool && drawId !== undefined,
    ),
    staleTime: 8_000,
    refetchInterval: READ_MS,
    queryFn: async (): Promise<DrawHistoryRow[]> => {
      if (
        !client ||
        !drawManager ||
        !prizePool ||
        drawId === undefined ||
        drawId === 0n
      )
        return [];
      const ids = Array.from({ length: Number(drawId) }, (_, index) =>
        BigInt(index + 1),
      );
      const states = await client.multicall({
        allowFailure: true,
        contracts: ids.map((id) => ({
          address: drawManager,
          abi: drawManagerAbi,
          functionName: "draws" as const,
          args: [id] as const,
        })),
      });
      const allocations = await client.multicall({
        allowFailure: true,
        contracts: ids.flatMap((id) =>
          PRIZE_TIERS.map((tier) => ({
            address: prizePool,
            abi: prizePoolAbi,
            functionName: "prizePerSlot" as const,
            args: [id, tier.id] as const,
          })),
        ),
      });

      return ids
        .flatMap((id, index) => {
          const stateResult = states[index];
          if (stateResult?.status !== "success") return [];
          const state = stateResult.result;
          const prizeAmount = PRIZE_TIERS.reduce((sum, tier, tierIndex) => {
            const result = allocations[index * PRIZE_TIERS.length + tierIndex];
            const perSlot =
              result?.status === "success" ? BigInt(result.result) : 0n;
            return sum + perSlot * BigInt(tier.slots);
          }, 0n);
          return [adaptDrawHistoryRow(id, state, prizeAmount)];
        })
        .sort((a, b) => Number(b.drawId - a.drawId));
    },
  });

  const settled = (historyQuery.data ?? []).filter((row) => row.settled);
  return {
    drawId,
    history: historyQuery.data ?? [],
    historyLoading: historyQuery.isLoading,
    historyError: historyQuery.error,
    totalPrizesAllocated: settled.reduce(
      (sum, row) => sum + row.prizeAmount,
      0n,
    ),
    settledDrawCount: settled.length,
  };
}
