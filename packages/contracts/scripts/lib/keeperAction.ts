export type KeeperSnapshot = {
  drawId: bigint;
  periodStartTime: bigint;
  now: bigint;
  minInterval: bigint;
  closed: boolean;
  awarded: boolean;
  claimDeadline: bigint;
  reconciliationPrepared: boolean;
  reconciled: boolean;
};

export type KeeperAction =
  | "wait"
  | "close"
  | "award"
  | "prepare-reconciliation"
  | "finalize-reconciliation";

/** Returns the next permissionless lifecycle action without inspecting depositors. */
export function nextKeeperAction(snapshot: KeeperSnapshot): KeeperAction {
  if (snapshot.drawId === 0n || snapshot.reconciled) {
    return snapshot.now >= snapshot.periodStartTime + snapshot.minInterval ? "close" : "wait";
  }
  if (snapshot.closed && !snapshot.awarded) return "award";
  if (snapshot.awarded && snapshot.now > snapshot.claimDeadline) {
    return snapshot.reconciliationPrepared ? "finalize-reconciliation" : "prepare-reconciliation";
  }
  return "wait";
}
