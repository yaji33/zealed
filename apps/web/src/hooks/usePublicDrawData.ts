"use client";

import { useMemo } from "react";
import { usePublicClient, useReadContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { addresses } from "@/lib/config";
import { drawManagerAbi } from "@/lib/abi/zealed";
import { getContractEventsChunked } from "@/lib/contractEvents";

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

  const { data: revealBlock } = useReadContract({
    address: drawManager,
    abi: drawManagerAbi,
    functionName: "revealBlock",
    query: { enabled: Boolean(drawManager) },
  });

  const historyQuery = useQuery({
    queryKey: ["draw-history", drawManager, drawId?.toString(), revealed, prizeAmountPlain?.toString()],
    enabled: Boolean(publicClient && drawManager && drawId !== undefined && revealed !== undefined),
    staleTime: 15_000,
    refetchInterval: 20_000,
    queryFn: async (): Promise<DrawHistoryRow[]> => {
      if (!publicClient || !drawManager) return [];

      const [committed, revealedEvents] = await Promise.all([
        getContractEventsChunked(publicClient, {
          address: drawManager,
          abi: drawManagerAbi,
          eventName: "DrawCommitted",
        }),
        getContractEventsChunked(publicClient, {
          address: drawManager,
          abi: drawManagerAbi,
          eventName: "DrawRevealed",
        }),
      ]);

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
          try {
            const block = await publicClient.getBlock({ blockNumber: ev.blockNumber });
            committedAt = Number(block.timestamp);
          } catch {
            committedAt = undefined;
          }
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

      if (
        drawId !== undefined &&
        drawId > 0n &&
        revealed === true &&
        prizeAmountPlain !== undefined &&
        prizeAmountPlain > 0n
      ) {
        const current = rows.find((row) => row.drawId === drawId);
        if (current) {
          current.settled = true;
          if (current.prizeAmount === 0n) current.prizeAmount = prizeAmountPlain;
        } else {
          rows.push({
            drawId,
            revealBlock: revealBlock ?? 0n,
            prizeAmount: prizeAmountPlain,
            settled: true,
          });
        }
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
