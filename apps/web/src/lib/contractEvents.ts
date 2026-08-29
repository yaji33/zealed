import type { PublicClient } from "viem";

/** Public RPCs reject `fromBlock: 0` and cap eth_getLogs range. */
const LOOKBACK_BLOCKS = 120_000n;
const CHUNK_BLOCKS = 8_000n;

type EventQuery = Parameters<PublicClient["getContractEvents"]>[0];

export async function getContractEventsChunked(
  client: PublicClient,
  params: Omit<EventQuery, "fromBlock" | "toBlock">,
) {
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
      batch.map(async ({ start, end }) => {
        try {
          return await client.getContractEvents({
            ...params,
            fromBlock: start,
            toBlock: end,
          });
        } catch {
          return [];
        }
      }),
    );
    for (const chunk of chunks) logs.push(...chunk);
  }

  return logs;
}
