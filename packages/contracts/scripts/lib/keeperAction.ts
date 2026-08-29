export type KeeperSnapshot = {
  drawId: bigint;
  revealed: boolean;
  lastCommitTimestamp: bigint;
  minInterval: bigint;
  now: bigint;
  blockNumber: bigint;
  revealBlock: bigint;
  maxRevealWindow: bigint;
};

export type KeeperAction = "wait" | "commit" | "reveal" | "missed";

/**
 * Permissionless keeper schedule. Never inspects depositors.
 * `commit` after MIN_DRAW_INTERVAL; `reveal` after the reveal block and inside the 256-block window.
 */
export function nextKeeperAction(s: KeeperSnapshot): KeeperAction {
  const pending = s.drawId > 0n && !s.revealed;
  if (pending) {
    if (s.blockNumber <= s.revealBlock) return "wait";
    if (s.blockNumber > s.revealBlock + s.maxRevealWindow) return "missed";
    return "reveal";
  }
  const nextCommitAt = s.lastCommitTimestamp === 0n ? 0n : s.lastCommitTimestamp + s.minInterval;
  return s.now >= nextCommitAt ? "commit" : "wait";
}

/** Reveal block far enough ahead that a pending tx cannot miss MIN_REVEAL_DELAY. */
export function revealTargetBlock(blockNumber: bigint, minRevealDelay: bigint, slack: bigint): bigint {
  return blockNumber + minRevealDelay + slack;
}
