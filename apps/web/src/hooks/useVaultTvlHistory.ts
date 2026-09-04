"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { Hex } from "viem";
import { useVaultDirectory } from "@/components/VaultDirectoryProvider";
import { vaultAbi } from "@/lib/abi/zealed";
import { getContractEventsChunked } from "@/lib/contractEvents";
import { getFhevmInstance } from "@/lib/relayerSdk";
import {
  cleartextToBigint,
  isZeroHandle,
  readClearValue,
} from "@/lib/publicDecrypt";

const MAX_SAMPLES = 16;

export type VaultTvlPoint = {
  blockNumber: bigint;
  timestamp?: number;
  value: bigint;
};

function uniqueSortedBlocks(blocks: bigint[]): bigint[] {
  const seen = new Set<string>();
  const out: bigint[] = [];
  const sorted = [...blocks].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const block of sorted) {
    const key = block.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(block);
  }
  return out;
}

function sampleBlocks(blocks: bigint[], max: number): bigint[] {
  if (blocks.length <= max) return blocks;
  const last = max - 1;
  const picked: bigint[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < max; i += 1) {
    const idx = Math.round((i / last) * (blocks.length - 1));
    const block = blocks[idx];
    if (block === undefined) continue;
    const key = block.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(block);
  }
  return picked;
}

async function decryptHandles(handles: Hex[]): Promise<Map<string, bigint>> {
  const unique = [...new Set(handles.filter((h) => !isZeroHandle(h)))];
  const values = new Map<string, bigint>();
  if (unique.length === 0) return values;

  const instance = await getFhevmInstance();

  try {
    const result = await instance.publicDecrypt(unique);
    for (const handle of unique) {
      const value = readClearValue(
        result.clearValues as Record<string, unknown>,
        handle,
      );
      if (value !== undefined) values.set(handle, value);
    }
    if (values.size > 0) return values;
  } catch {
    // Fall through to per-handle decrypt.
  }

  const settled = await Promise.allSettled(
    unique.map(async (handle) => {
      const result = await instance.publicDecrypt([handle]);
      const value = readClearValue(
        result.clearValues as Record<string, unknown>,
        handle,
      );
      if (value === undefined) {
        const raw = result.clearValues[handle];
        return [handle, cleartextToBigint(raw)] as const;
      }
      return [handle, value] as const;
    }),
  );

  for (const item of settled) {
    if (item.status === "fulfilled") values.set(item.value[0], item.value[1]);
  }
  return values;
}

/**
 * TVL time series from Deposited/Withdrawn event blocks.
 * Events carry no amounts (confidential inputs). Each sample is
 * totalDeposits at that block, public-decrypted in one batch.
 */
export function useVaultTvlHistory() {
  const publicClient = usePublicClient();
  const { selected } = useVaultDirectory();
  const vault = selected?.vault;

  return useQuery({
    queryKey: ["vault-tvl-history", vault],
    enabled: Boolean(publicClient && vault),
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<VaultTvlPoint[]> => {
      if (!publicClient || !vault) return [];

      const [deposited, withdrawn] = await Promise.all([
        getContractEventsChunked(publicClient, {
          address: vault,
          abi: vaultAbi,
          eventName: "Deposited",
        }),
        getContractEventsChunked(publicClient, {
          address: vault,
          abi: vaultAbi,
          eventName: "Withdrawn",
        }),
      ]);

      const eventBlocks = uniqueSortedBlocks(
        [...deposited, ...withdrawn]
          .map((log) => log.blockNumber)
          .filter((block): block is bigint => block !== undefined),
      );

      const latest = await publicClient.getBlockNumber();
      const sampleAt = sampleBlocks(
        eventBlocks.length > 0 ? [...eventBlocks, latest] : [latest],
        MAX_SAMPLES,
      );

      const handleByBlock = new Map<string, Hex>();
      const reads = await Promise.allSettled(
        sampleAt.map(async (blockNumber) => {
          const handle = (await publicClient.readContract({
            address: vault,
            abi: vaultAbi,
            functionName: "totalDeposits",
            blockNumber,
          })) as Hex;
          return { blockNumber, handle };
        }),
      );

      for (const item of reads) {
        if (item.status !== "fulfilled") continue;
        if (isZeroHandle(item.value.handle)) continue;
        handleByBlock.set(item.value.blockNumber.toString(), item.value.handle);
      }

      const decrypted = await decryptHandles([...handleByBlock.values()]);
      const points: VaultTvlPoint[] = [];

      for (const [blockKey, handle] of handleByBlock) {
        const value = decrypted.get(handle);
        if (value === undefined) continue;
        points.push({ blockNumber: BigInt(blockKey), value });
      }

      points.sort((a, b) => (a.blockNumber < b.blockNumber ? -1 : 1));

      const ends = [points[0], points[points.length - 1]].filter(
        (p): p is VaultTvlPoint => Boolean(p),
      );
      const uniqueEnds = [
        ...new Map(ends.map((p) => [p.blockNumber.toString(), p])).values(),
      ];
      await Promise.all(
        uniqueEnds.map(async (point) => {
          try {
            const block = await publicClient.getBlock({
              blockNumber: point.blockNumber,
            });
            point.timestamp = Number(block.timestamp);
          } catch {
            // Axis labels stay optional.
          }
        }),
      );

      return points;
    },
  });
}
