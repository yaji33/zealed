import { expect } from "chai";

import { nextKeeperAction, revealTargetBlock, type KeeperSnapshot } from "../scripts/lib/keeperAction";

function snap(over: Partial<KeeperSnapshot> = {}): KeeperSnapshot {
  return {
    drawId: 0n,
    revealed: false,
    lastCommitTimestamp: 0n,
    minInterval: 20n * 60n,
    now: 1_000n,
    blockNumber: 100n,
    revealBlock: 0n,
    maxRevealWindow: 256n,
    ...over,
  };
}

describe("keeperAction", () => {
  it("commits immediately when no draw has ever been committed", () => {
    expect(nextKeeperAction(snap())).to.equal("commit");
  });

  it("waits until MIN_DRAW_INTERVAL after the last commit", () => {
    expect(
      nextKeeperAction(
        snap({
          drawId: 1n,
          revealed: true,
          lastCommitTimestamp: 1_000n,
          now: 1_000n + 20n * 60n - 1n,
        }),
      ),
    ).to.equal("wait");
    expect(
      nextKeeperAction(
        snap({
          drawId: 1n,
          revealed: true,
          lastCommitTimestamp: 1_000n,
          now: 1_000n + 20n * 60n,
        }),
      ),
    ).to.equal("commit");
  });

  it("waits while the reveal block is still in the future", () => {
    expect(
      nextKeeperAction(
        snap({
          drawId: 1n,
          revealed: false,
          revealBlock: 110n,
          blockNumber: 110n,
        }),
      ),
    ).to.equal("wait");
  });

  it("reveals once the reveal block is in and the hash window is open", () => {
    expect(
      nextKeeperAction(
        snap({
          drawId: 1n,
          revealed: false,
          revealBlock: 110n,
          blockNumber: 111n,
        }),
      ),
    ).to.equal("reveal");
  });

  it("flags a missed 256-block hash window", () => {
    expect(
      nextKeeperAction(
        snap({
          drawId: 1n,
          revealed: false,
          revealBlock: 110n,
          blockNumber: 110n + 256n + 1n,
        }),
      ),
    ).to.equal("missed");
  });

  it("places the reveal target past MIN_REVEAL_DELAY plus slack", () => {
    expect(revealTargetBlock(100n, 5n, 32n)).to.equal(137n);
  });
});
