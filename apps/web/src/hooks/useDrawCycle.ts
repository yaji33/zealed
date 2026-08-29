"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useBlockNumber, useReadContract } from "wagmi";
import { addresses } from "@/lib/config";
import { drawManagerAbi } from "@/lib/abi/zealed";
import { AVERAGE_BLOCK_SECONDS } from "@/lib/draw";

export type DrawCyclePhase =
  | "loading"
  | "interval"
  | "open"
  | "awaiting-reveal"
  | "settle"
  | "missed";

const DEFAULT_INTERVAL = 20n * 60n;
const DEFAULT_REVEAL_DELAY = 5n;
const DEFAULT_REVEAL_WINDOW = 256n;
const READ_MS = 12_000;

export function useDrawCycle() {
  const draw = addresses.drawManager;
  const queryClient = useQueryClient();
  const enabled = Boolean(draw);

  const { data: drawId, refetch: refetchDrawId } = useReadContract({
    address: draw,
    abi: drawManagerAbi,
    functionName: "drawId",
    query: { enabled, refetchInterval: READ_MS },
  });

  const { data: revealed, refetch: refetchRevealed } = useReadContract({
    address: draw,
    abi: drawManagerAbi,
    functionName: "revealed",
    query: { enabled, refetchInterval: READ_MS },
  });

  const { data: revealBlock, refetch: refetchRevealBlock } = useReadContract({
    address: draw,
    abi: drawManagerAbi,
    functionName: "revealBlock",
    query: { enabled, refetchInterval: READ_MS },
  });

  const { data: lastCommitTimestamp, refetch: refetchLastCommit } = useReadContract({
    address: draw,
    abi: drawManagerAbi,
    functionName: "lastCommitTimestamp",
    query: { enabled, refetchInterval: READ_MS },
  });

  const { data: minInterval } = useReadContract({
    address: draw,
    abi: drawManagerAbi,
    functionName: "MIN_DRAW_INTERVAL",
    query: { enabled },
  });

  const { data: minRevealDelay } = useReadContract({
    address: draw,
    abi: drawManagerAbi,
    functionName: "MIN_REVEAL_DELAY",
    query: { enabled },
  });

  const { data: maxRevealWindow } = useReadContract({
    address: draw,
    abi: drawManagerAbi,
    functionName: "MAX_REVEAL_WINDOW",
    query: { enabled },
  });

  const { data: blockNumber } = useBlockNumber({
    query: { enabled, refetchInterval: READ_MS },
  });

  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const [revealSeconds, setRevealSeconds] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const intervalSec = minInterval ?? DEFAULT_INTERVAL;
  const delayBlocks = minRevealDelay ?? DEFAULT_REVEAL_DELAY;
  const windowBlocks = maxRevealWindow ?? DEFAULT_REVEAL_WINDOW;

  const pending = drawId !== undefined && drawId > 0n && revealed === false;
  const idle = drawId === 0n || revealed === true;

  const nextCommitAt =
    lastCommitTimestamp === undefined || lastCommitTimestamp === 0n
      ? 0
      : Number(lastCommitTimestamp) + Number(intervalSec);

  const blocksLeft =
    pending && revealBlock !== undefined && blockNumber !== undefined && revealBlock > blockNumber
      ? Number(revealBlock - blockNumber)
      : 0;

  const phase: DrawCyclePhase = useMemo(() => {
    if (!enabled) return "loading";
    if (drawId === undefined || revealed === undefined || lastCommitTimestamp === undefined) {
      return "loading";
    }
    if (pending) {
      if (blockNumber === undefined || revealBlock === undefined) return "loading";
      if (blockNumber <= revealBlock) return "awaiting-reveal";
      if (blockNumber > revealBlock + windowBlocks) return "missed";
      return "settle";
    }
    if (!idle) return "loading";
    return nowSec >= nextCommitAt ? "open" : "interval";
  }, [
    blockNumber,
    drawId,
    enabled,
    idle,
    lastCommitTimestamp,
    nextCommitAt,
    nowSec,
    pending,
    revealBlock,
    revealed,
    windowBlocks,
  ]);

  useEffect(() => {
    if (phase !== "awaiting-reveal") {
      setRevealSeconds(0);
      return;
    }
    setRevealSeconds(blocksLeft * AVERAGE_BLOCK_SECONDS);
  }, [phase, blocksLeft]);

  useEffect(() => {
    if (phase !== "awaiting-reveal") return;
    const id = window.setInterval(() => {
      setRevealSeconds((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, blocksLeft]);

  const secondsRemaining =
    phase === "interval"
      ? Math.max(0, nextCommitAt - nowSec)
      : phase === "awaiting-reveal"
        ? revealSeconds
        : 0;

  const clockLabel = useMemo(() => {
    if (phase === "missed") return "Reveal window missed";
    return "Next draw";
  }, [phase]);

  const refetch = useCallback(async () => {
    await Promise.all([
      refetchDrawId(),
      refetchRevealed(),
      refetchRevealBlock(),
      refetchLastCommit(),
      queryClient.invalidateQueries({ queryKey: ["draw-history"] }),
    ]);
  }, [queryClient, refetchDrawId, refetchLastCommit, refetchRevealBlock, refetchRevealed]);

  return {
    phase,
    drawId,
    revealed,
    revealBlock,
    lastCommitTimestamp,
    minRevealDelay: delayBlocks,
    maxRevealWindow: windowBlocks,
    blockNumber,
    secondsRemaining,
    clockLabel,
    refetch,
  };
}
