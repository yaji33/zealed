/** Fallback gas for FHE-heavy close/award when estimateGas fails. */
export const DRAW_SETTLE_GAS = 8_000_000n;

/** Fallback gas for pull-based `checkPrize` (historical range + encrypted compare). */
export const DRAW_CHECK_GAS = 5_000_000n;

/** Fallback gas for prize `claim` (encrypted transfer). */
export const DRAW_CLAIM_GAS = 1_500_000n;
