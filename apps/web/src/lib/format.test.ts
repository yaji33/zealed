import { describe, expect, it } from "vitest";
import {
  formatCompactAmount,
  formatCountdown,
  formatUnits,
  parseUnits,
} from "@/lib/format";

describe("amount formatting", () => {
  it("round-trips six-decimal token amounts", () => {
    expect(parseUnits("353.26")).toBe(353_260_000n);
    expect(formatUnits(353_260_000n)).toBe("353.26");
  });

  it("rejects malformed and over-precise input", () => {
    expect(() => parseUnits("1.0000001")).toThrow("Too many decimal places");
    expect(() => parseUnits("-1")).toThrow("Invalid amount");
    expect(() => parseUnits("")).toThrow("Enter an amount");
  });

  it("formats compact public aggregates and draw clocks", () => {
    expect(formatCompactAmount(1_250_000_000n)).toBe("1,250");
    expect(formatCountdown(3_661)).toBe("01:01:01");
    expect(formatCountdown(-1)).toBe("00:00:00");
  });
});
