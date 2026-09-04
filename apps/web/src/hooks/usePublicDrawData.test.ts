import { describe, expect, it } from "vitest";
import { adaptDrawHistoryRow } from "@/hooks/usePublicDrawData";

describe("adaptDrawHistoryRow", () => {
  it("maps public lifecycle fields without user data", () => {
    const row = adaptDrawHistoryRow(
      7n,
      [2n, 100n, 4n, 200n, 9_000n, 500n, true, true, false, false],
      1_250_000n,
    );
    expect(row).toEqual({
      drawId: 7n,
      startTime: 100,
      endTime: 200,
      claimDeadline: 500,
      prizeAmount: 1_250_000n,
      settled: true,
      reconciled: false,
    });
    expect(row).not.toHaveProperty("account");
  });
});
