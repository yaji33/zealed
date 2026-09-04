import { describe, expect, it } from "vitest";
import { calculateTierChance } from "@/components/PrivateOddsPanel";

describe("calculateTierChance", () => {
  it("compounds the per-slot chance across a bounded tier", () => {
    expect(calculateTierChance(10n, 100n, 1)).toBeCloseTo(0.1);
    expect(calculateTierChance(10n, 100n, 2)).toBeCloseTo(0.19);
    expect(calculateTierChance(10n, 100n, 4)).toBeCloseTo(0.3439);
  });

  it("clamps impossible weights and rejects empty domains", () => {
    expect(calculateTierChance(200n, 100n, 4)).toBe(1);
    expect(calculateTierChance(1n, 0n, 1)).toBeNull();
    expect(calculateTierChance(1n, 10n, 0)).toBeNull();
  });
});
