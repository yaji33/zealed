"use client";

import { useMemo } from "react";
import { usePublicClient, useReadContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { addresses } from "@/lib/config";
import { drawManagerAbi } from "@/lib/abi/zealed";

export type DrawHistoryRow = {
  drawId: bigint;
  revealBlock: bigint;
  prizeAmount: bigint;
  settled: boolean;
  randomValue?: bigint;
  totalTickets?: bigint;
  /** Approximate commit time from the commit tx block; may be undefined if RPC omits it. */
  committedAt?: number;
};

export function usePublicDrawData() {
  const publicClient = usePublicClient();
  const drawManager = addresses.drawManager;

  const { data: drawId } = useReadContract({
    address: drawManager,
    abi: drawManagerAbi,
    functionName: "drawId",
    query: { enabled: Boolean(drawManager) },
  });

  const { data: revealed } = useReadContract({
    address: drawManager,
    abi: drawManagerAbi,
    functionName: "revealed",
    query: { enabled: Boolean(drawManager) },
  });

  const { data: prizeAmountPlain } = useReadContract({
    address: drawManager,
    abi: drawManagerAbi,
    functionName: "prizeAmountPlain",
    query: { enabled: Boolean(drawManager) },
  });

  const { data: totalTicketsPlain } = useReadContract({
    address: drawManager,
    abi: drawManagerAbi,
    functionName: "totalTicketsPlain",
    query: { enabled: Boolean(drawManager) },
  });

  const historyQuery = useQuery({
    queryKey: ["draw-history", drawManager, drawId?.toString()],
    enabled: Boolean(publicClient && drawManager),
    queryFn: async (): Promise<DrawHistoryRow[]> => {
      if (!publicClient || !drawManager) return [];

      const committed = await publicClient.getContractEvents({
        address: drawManager,
        abi: drawManagerAbi,
        eventName: "DrawCommitted",
        fromBlock: 0n,
        toBlock: "latest",
      });

      const revealedEvents = await publicClient.getContractEvents({
        address: drawManager,
        abi: drawManagerAbi,
        eventName: "DrawRevealed",
        fromBlock: 0n,
        toBlock: "latest",
      });

      const revealedById = new Map<string, (typeof revealedEvents)[number]>();
      for (const ev of revealedEvents) {
        const id = (ev.args as { drawId?: bigint }).drawId;
        if (id !== undefined) revealedById.set(id.toString(), ev);
      }

      const rows: DrawHistoryRow[] = [];
      for (const ev of committed) {
        const args = ev.args as {
          drawId?: bigint;
          revealBlock?: bigint;
          prizeAmount?: bigint;
        };
        if (args.drawId === undefined || args.revealBlock === undefined || args.prizeAmount === undefined) {
          continue;
        }
        const match = revealedById.get(args.drawId.toString());
        const revealedArgs = match?.args as
          | { randomValue?: bigint; totalTickets?: bigint }
          | undefined;

        let committedAt: number | undefined;
        if (ev.blockNumber !== undefined) {
          const block = await publicClient.getBlock({ blockNumber: ev.blockNumber });
          committedAt = Number(block.timestamp);
        }

        rows.push({
          drawId: args.drawId,
          revealBlock: args.revealBlock,
          prizeAmount: args.prizeAmount,
          settled: Boolean(match),
          randomValue: revealedArgs?.randomValue,
          totalTickets: revealedArgs?.totalTickets,
          committedAt,
        });
      }

      return rows.sort((a, b) => Number(b.drawId - a.drawId));
    },
  });

  const totals = useMemo(() => {
    const rows = historyQuery.data ?? [];
    const settled = rows.filter((r) => r.settled);
    const totalPrizes = settled.reduce((acc, r) => acc + r.prizeAmount, 0n);
    // In this protocol, yield is distributed as prizes — public prize sum is the yield signal.
    return {
      totalPrizesPaid: totalPrizes,
      totalYieldGenerated: totalPrizes,
      settledDrawCount: settled.length,
    };
  }, [historyQuery.data]);

  return {
    drawId,
    revealed,
    prizeAmountPlain,
    totalTicketsPlain,
    history: historyQuery.data ?? [],
    historyLoading: historyQuery.isLoading,
    historyError: historyQuery.error,
    ...totals,
  };
}
