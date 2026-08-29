/** Sepolia average used only to estimate seconds until a future reveal block. */
export const AVERAGE_BLOCK_SECONDS = 12;

/**
 * Public prize used by in-app `commitDraw`. Aggregate disclosure is allowed;
 * this is a demo-sized 1 cUSDC (6 decimals), not yield-sourced on-chain.
 */
export const DEMO_PRIZE_PLAIN = 1_000_000n;

/** Extra blocks so MetaMask confirmation time cannot miss MIN_REVEAL_DELAY. */
export const DRAW_REVEAL_SLACK_BLOCKS = 32n;

/** Fallback gas for FHE-heavy commit/reveal when estimateGas fails. */
export const DRAW_SETTLE_GAS = 1_500_000n;

/** Fallback gas for pull-based `checkIfWon` (Fenwick walk). */
export const DRAW_CHECK_GAS = 5_000_000n;

