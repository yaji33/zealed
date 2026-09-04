import { expect } from "chai";

import { nextKeeperAction, type KeeperSnapshot } from "../scripts/lib/keeperAction";

function snapshot(overrides: Partial<KeeperSnapshot> = {}): KeeperSnapshot {
  return {
    drawId: 0n,
    periodStartTime: 1_000n,
    now: 1_000n,
    minInterval: 1_200n,
    closed: false,
    awarded: false,
    claimDeadline: 0n,
    reconciliationPrepared: false,
    reconciled: false,
    ...overrides,
  };
}

describe("keeperAction", function () {
  it("waits before the interval and closes when an initial or reconciled period matures", function () {
    expect(nextKeeperAction(snapshot({ now: 2_199n }))).to.eq("wait");
    expect(nextKeeperAction(snapshot({ now: 2_200n }))).to.eq("close");
    expect(
      nextKeeperAction(snapshot({ drawId: 1n, reconciled: true, now: 2_200n })),
    ).to.eq("close");
  });

  it("awards a closed non-awarded draw", function () {
    expect(nextKeeperAction(snapshot({ drawId: 1n, closed: true }))).to.eq("award");
  });

  it("waits during the claim window", function () {
    expect(
      nextKeeperAction(
        snapshot({
          drawId: 1n,
          closed: true,
          awarded: true,
          claimDeadline: 5_000n,
          now: 5_000n,
        }),
      ),
    ).to.eq("wait");
  });

  it("prepares then finalizes reconciliation after expiry", function () {
    const expired = {
      drawId: 1n,
      closed: true,
      awarded: true,
      claimDeadline: 5_000n,
      now: 5_001n,
    };
    expect(nextKeeperAction(snapshot(expired))).to.eq("prepare-reconciliation");
    expect(
      nextKeeperAction(snapshot({ ...expired, reconciliationPrepared: true })),
    ).to.eq("finalize-reconciliation");
  });
});
