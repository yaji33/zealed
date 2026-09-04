"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useBlockNumber, useReadContract } from "wagmi";
import { useVaultDirectory } from "@/components/VaultDirectoryProvider";
import { drawManagerAbi } from "@/lib/abi/zealed";

export type DrawCyclePhase =
  | "loading"
  | "open"
  | "ready-to-close"
  | "awaiting-award"
  | "claiming"
  | "reconciliation";

const DEFAULT_INTERVAL = 20n * 60n;
const READ_MS = 12_000;

export function deriveDrawPhase(input: {
  configured: boolean;
  loaded: boolean;
  nowSec: number;
  closeAt: number;
  claimDeadline: bigint;
  closed: boolean;
  awarded: boolean;
  reconciliationPrepared: boolean;
  reconciled: boolean;
}): DrawCyclePhase {
  if (!input.configured || !input.loaded) return "loading";
  if (!input.closed)
    return input.nowSec >= input.closeAt ? "ready-to-close" : "open";
  if (!input.awarded) return "awaiting-award";
  if (
    !input.reconciliationPrepared &&
    input.nowSec <= Number(input.claimDeadline)
  )
    return "claiming";
  if (!input.reconciled) return "reconciliation";
  return "open";
}

export function useDrawCycle() {
  const { selected } = useVaultDirectory();
  const draw = selected?.drawManager;
  const queryClient = useQueryClient();
  const enabled = Boolean(draw);

  const { data: drawId, refetch: refetchDrawId } = useReadContract({
    address: draw,
    abi: drawManagerAbi,
    functionName: "drawId",
    query: { enabled, refetchInterval: READ_MS },
  });

  const { data: periodStartTime, refetch: refetchPeriodStart } =
    useReadContract({
      address: draw,
      abi: drawManagerAbi,
      functionName: "periodStartTime",
      query: { enabled, refetchInterval: READ_MS },
    });

  const { data: minInterval } = useReadContract({
    address: draw,
    abi: drawManagerAbi,
    functionName: "MIN_DRAW_INTERVAL",
    query: { enabled },
  });

  const { data: claimWindow } = useReadContract({
    address: draw,
    abi: drawManagerAbi,
    functionName: "CLAIM_WINDOW",
    query: { enabled },
  });

  const { data: drawState, refetch: refetchDrawState } = useReadContract({
    address: draw,
    abi: drawManagerAbi,
    functionName: "draws",
    args: drawId !== undefined && drawId > 0n ? [drawId] : undefined,
    query: {
      enabled: enabled && drawId !== undefined && drawId > 0n,
      refetchInterval: READ_MS,
    },
  });

  const { data: blockNumber } = useBlockNumber({
    query: { enabled, refetchInterval: READ_MS },
    watch: true,
  });

  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = window.setInterval(
      () => setNowSec(Math.floor(Date.now() / 1000)),
      1000,
    );
    return () => window.clearInterval(id);
  }, []);

  const intervalSec = minInterval ?? DEFAULT_INTERVAL;
  const closeAt = Number(periodStartTime ?? 0n) + Number(intervalSec);
  const closed = drawState?.[6] ?? false;
  const awarded = drawState?.[7] ?? false;
  const reconciliationPrepared = drawState?.[8] ?? false;
  const reconciled = drawState?.[9] ?? false;
  const claimDeadline = drawState?.[5] ?? 0n;

  const phase: DrawCyclePhase = useMemo(() => {
    return deriveDrawPhase({
      configured: enabled,
      loaded: drawId !== undefined && periodStartTime !== undefined,
      nowSec,
      closeAt,
      claimDeadline,
      closed,
      awarded,
      reconciliationPrepared,
      reconciled,
    });
  }, [
    awarded,
    claimDeadline,
    closeAt,
    closed,
    drawId,
    enabled,
    nowSec,
    periodStartTime,
    reconciliationPrepared,
    reconciled,
  ]);

  const secondsRemaining =
    phase === "open"
      ? Math.max(0, closeAt - nowSec)
      : phase === "claiming"
        ? Math.max(0, Number(claimDeadline) - nowSec)
        : 0;

  const clockLabel = useMemo(() => {
    if (phase === "claiming") return "Claim window";
    if (phase === "ready-to-close") return "Ready to close";
    if (phase === "awaiting-award") return "Awaiting award";
    if (phase === "reconciliation") return "Reconciliation";
    return "Draw closes";
  }, [phase]);

  const refetch = useCallback(async () => {
    await Promise.all([
      refetchDrawId(),
      refetchPeriodStart(),
      refetchDrawState(),
      queryClient.invalidateQueries({ queryKey: ["draw-history"] }),
      queryClient.invalidateQueries({ queryKey: ["vault-tvl"] }),
      queryClient.invalidateQueries({ queryKey: ["prize-pool"] }),
    ]);
  }, [queryClient, refetchDrawId, refetchDrawState, refetchPeriodStart]);

  return {
    phase,
    drawId,
    drawState,
    periodStartTime,
    minInterval: intervalSec,
    claimWindow,
    claimDeadline,
    blockNumber,
    secondsRemaining,
    clockLabel,
    refetch,
  };
}
