import type { PublicClient } from "viem";

/** Public RPCs reject `fromBlock: 0` and cap eth_getLogs range. */
const LOOKBACK_BLOCKS = 400_000n;
const CHUNK_BLOCKS = 8_000n;

type EventQuery = Parameters<PublicClient["getContractEvents"]>[0];
type ChunkParams = Omit<EventQuery, "fromBlock" | "toBlock" | "blockHash">;

async function fetchChunk(
  client: PublicClient,
  params: ChunkParams,
  start: bigint,
  end: bigint,
  chunkSize: bigint,
): Promise<Awaited<ReturnType<PublicClient["getContractEvents"]>>> {
  try {
    return await client.getContractEvents({
      ...params,
      fromBlock: start,
      toBlock: end,
    });
  } catch {
    // Retry once with a smaller window — public RPCs often reject mid-range.
    if (chunkSize <= 1_000n || end - start <= 1_000n) return [];
    const half = chunkSize / 2n;
    const mid = start + half > end ? end : start + half;
    const [left, right] = await Promise.all([
      fetchChunk(client, params, start, mid, half),
      mid < end ? fetchChunk(client, params, mid + 1n, end, half) : Promise.resolve([]),
    ]);
    return [...left, ...right];
  }
}

export async function getContractEventsChunked(client: PublicClient, params: ChunkParams) {
  const latest = await client.getBlockNumber();
  const from = latest > LOOKBACK_BLOCKS ? latest - LOOKBACK_BLOCKS : 0n;
  const ranges: { start: bigint; end: bigint }[] = [];
  for (let start = from; start <= latest; start += CHUNK_BLOCKS + 1n) {
    const end = start + CHUNK_BLOCKS > latest ? latest : start + CHUNK_BLOCKS;
    ranges.push({ start, end });
  }

  const logs: Awaited<ReturnType<PublicClient["getContractEvents"]>> = [];
  const concurrency = 4;
  for (let i = 0; i < ranges.length; i += concurrency) {
    const batch = ranges.slice(i, i + concurrency);
    const chunks = await Promise.all(
      batch.map(({ start, end }) => fetchChunk(client, params, start, end, CHUNK_BLOCKS)),
    );
    for (const chunk of chunks) logs.push(...chunk);
  }

  return logs;
}
