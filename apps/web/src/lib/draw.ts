/** Sepolia average used only to estimate seconds until a future reveal block. */
export const AVERAGE_BLOCK_SECONDS = 12;

/**
 * Must match DrawManager.YIELD_DIVISOR.
 * prize = tvl * elapsed / YIELD_DIVISOR (~1% of TVL per 20-minute interval).
 */
export const YIELD_DIVISOR = 120_000n;

/** Extra blocks so MetaMask confirmation time cannot miss MIN_REVEAL_DELAY. */
export const DRAW_REVEAL_SLACK_BLOCKS = 32n;

/** Fallback gas for FHE-heavy commit/reveal when estimateGas fails. */
export const DRAW_SETTLE_GAS = 1_500_000n;

/** Fallback gas for pull-based `checkIfWon` (Fenwick walk). */
export const DRAW_CHECK_GAS = 5_000_000n;

/** Fallback gas for prize `claim` (encrypted transfer). */
export const DRAW_CLAIM_GAS = 1_500_000n;

/** Estimate demo yield from public TVL and elapsed seconds (same formula as on-chain). */
export function estimateYieldPrize(tvl: bigint, elapsedSec: bigint): bigint {
  if (tvl === 0n || elapsedSec === 0n) return 0n;
  return (tvl * elapsedSec) / YIELD_DIVISOR;
}
