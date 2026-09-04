import { describe, expect, it } from "vitest";
import { wrappedAssetQueryKey } from "@/hooks/useWrappedAsset";

describe("wrappedAssetQueryKey", () => {
  it("isolates wrapped balances by underlying, wrapper, and account", () => {
    const account = "0x0000000000000000000000000000000000000001";
    const usdc = wrappedAssetQueryKey(
      "0x0000000000000000000000000000000000000002",
      "0x0000000000000000000000000000000000000003",
      account,
    );
    const usdt = wrappedAssetQueryKey(
      "0x0000000000000000000000000000000000000004",
      "0x0000000000000000000000000000000000000005",
      account,
    );

    expect(usdc).not.toEqual(usdt);
    expect(usdc).toEqual([
      "wrapped-asset",
      "0x0000000000000000000000000000000000000002",
      "0x0000000000000000000000000000000000000003",
      account,
    ]);
  });
});
