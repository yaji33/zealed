import { maxUint256 } from "viem";

/** One-time faucet approve so wrap can consume allowance without a second permit. */
export const UNLIMITED_ALLOWANCE = maxUint256;

const UNLIMITED_FLOOR = 2n ** 255n;

/** Remaining spender allowance after the wrapper pulls `wrapped` underlying units. */
export function remainingAllowanceAfterWrap(
  previous: bigint,
  wrapped: bigint,
): bigint {
  if (previous >= UNLIMITED_FLOOR) return previous;
  return previous > wrapped ? previous - wrapped : 0n;
}

/** Use the local remaining figure until the chain read catches up. */
export function displayedAllowance(
  chain: bigint | undefined,
  localRemaining: bigint | null,
): bigint {
  return localRemaining ?? chain ?? 0n;
}

/**
 * After a local approve/wrap, ignore a chain read that still looks like the
 * previous state (stale-low after approve, stale-high after wrap).
 */
export function settleLocalAllowance(
  chain: bigint | undefined,
  localRemaining: bigint,
): bigint | null {
  if (chain === undefined) return localRemaining;
  if (localRemaining >= UNLIMITED_FLOOR) {
    return chain >= UNLIMITED_FLOOR ? null : localRemaining;
  }
  return chain <= localRemaining ? null : localRemaining;
}
