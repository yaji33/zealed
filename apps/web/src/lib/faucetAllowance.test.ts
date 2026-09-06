import { describe, expect, it } from "vitest";
import { maxUint256 } from "viem";
import {
  displayedAllowance,
  remainingAllowanceAfterWrap,
  settleLocalAllowance,
  UNLIMITED_ALLOWANCE,
} from "@/lib/faucetAllowance";

describe("faucet allowance", () => {
  it("treats a finite approve as spent after wrap", () => {
    expect(remainingAllowanceAfterWrap(200n, 200n)).toBe(0n);
    expect(remainingAllowanceAfterWrap(700n, 200n)).toBe(500n);
    expect(remainingAllowanceAfterWrap(100n, 200n)).toBe(0n);
  });

  it("keeps an unlimited approve after wrap", () => {
    expect(remainingAllowanceAfterWrap(UNLIMITED_ALLOWANCE, 200n)).toBe(
      maxUint256,
    );
  });

  it("prefers the local remaining figure over a stale high chain read", () => {
    expect(displayedAllowance(200n, 0n)).toBe(0n);
    expect(displayedAllowance(undefined, 200n)).toBe(200n);
    expect(displayedAllowance(200n, null)).toBe(200n);
  });

  it("keeps a fresh unlimited approve when the chain read is still zero", () => {
    expect(settleLocalAllowance(0n, UNLIMITED_ALLOWANCE)).toBe(
      UNLIMITED_ALLOWANCE,
    );
    expect(settleLocalAllowance(UNLIMITED_ALLOWANCE, UNLIMITED_ALLOWANCE)).toBe(
      null,
    );
  });

  it("keeps a spent finite allowance when the chain read is still high", () => {
    expect(settleLocalAllowance(200n, 0n)).toBe(0n);
    expect(settleLocalAllowance(0n, 0n)).toBe(null);
    expect(settleLocalAllowance(500n, 500n)).toBe(null);
  });
});
