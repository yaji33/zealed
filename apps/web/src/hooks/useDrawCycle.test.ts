import { describe, expect, it } from "vitest";
import { deriveDrawPhase } from "@/hooks/useDrawCycle";

const base = {
  configured: true,
  loaded: true,
  nowSec: 1_000,
  closeAt: 2_000,
  claimDeadline: 3_000n,
  closed: false,
  awarded: false,
  reconciliationPrepared: false,
  reconciled: false,
};

describe("deriveDrawPhase", () => {
  it("moves an open period through close and award", () => {
    expect(deriveDrawPhase(base)).toBe("open");
    expect(deriveDrawPhase({ ...base, nowSec: 2_000 })).toBe("ready-to-close");
    expect(deriveDrawPhase({ ...base, closed: true })).toBe("awaiting-award");
    expect(deriveDrawPhase({ ...base, closed: true, awarded: true })).toBe("claiming");
  });

  it("moves expired draws through reconciliation", () => {
    expect(deriveDrawPhase({
      ...base,
      nowSec: 3_001,
      closed: true,
      awarded: true,
    })).toBe("reconciliation");
    expect(deriveDrawPhase({
      ...base,
      nowSec: 3_001,
      closed: true,
      awarded: true,
      reconciliationPrepared: true,
      reconciled: true,
    })).toBe("open");
  });

  it("stays loading without verified configuration", () => {
    expect(deriveDrawPhase({ ...base, configured: false })).toBe("loading");
    expect(deriveDrawPhase({ ...base, loaded: false })).toBe("loading");
  });
});
