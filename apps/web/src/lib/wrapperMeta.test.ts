import { describe, expect, it } from "vitest";
import { prizeVaultName, slugFromVaultId, vaultWorkspacePath } from "@/lib/vaultPath";
import {
  defaultMintAmount,
  metaForAsset,
  metaForSlug,
  wrapperSymbolFor,
  ZAMA_SEPOLIA_WRAPPERS,
} from "@/lib/wrapperMeta";

describe("vault path helpers", () => {
  it("decodes curated vault ids into lowercase slugs", () => {
    expect(
      slugFromVaultId(
        "0x6375736463000000000000000000000000000000000000000000000000000000",
      ),
    ).toBe("cusdc");
    expect(
      slugFromVaultId(
        "0x6375736474000000000000000000000000000000000000000000000000000000",
      ),
    ).toBe("cusdt");
  });

  it("builds workspace paths and prize vault names", () => {
    expect(vaultWorkspacePath("cusdc")).toBe("/dashboard/cusdc");
    expect(prizeVaultName("cUSDC")).toBe("Prize cUSDC");
  });
});

describe("Zama wrapper metadata", () => {
  it("maps official Sepolia mock addresses without mixing symbols", () => {
    const usdc = metaForAsset("0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639");
    const usdt = metaForSlug("cusdt");
    expect(usdc?.symbol).toBe("cUSDCMock");
    expect(usdt?.shortLabel).toBe("cUSDT");
    expect(wrapperSymbolFor(usdc?.address, "token")).toBe("cUSDCMock");
    expect(ZAMA_SEPOLIA_WRAPPERS.every((wrapper) => wrapper.mintable)).toBe(true);
    expect(metaForSlug("cweth")?.decimals).toBe(6);
    expect(metaForSlug("cweth")?.underlyingDecimals).toBe(18);
    expect(metaForSlug("czama")?.decimals).toBe(6);
    expect(metaForSlug("cxaut")?.decimals).toBe(6);
    expect(metaForSlug("cxaut")?.underlyingDecimals).toBe(6);
    expect(metaForSlug("cbron")?.decimals).toBe(6);
    expect(metaForSlug("cbron")?.underlyingDecimals).toBe(18);
  });

  it("defaults faucet mint to about $100 of each wrapper", () => {
    expect(defaultMintAmount(metaForSlug("cusdc")?.address)).toBe("100");
    expect(defaultMintAmount(metaForSlug("cusdt")?.address)).toBe("100");
    expect(defaultMintAmount(metaForSlug("cweth")?.address)).toBe("0.04");
    expect(defaultMintAmount(metaForSlug("czama")?.address)).toBe("1918.4");
    expect(defaultMintAmount(metaForSlug("cxaut")?.address)).toBe("0.0226");
    expect(defaultMintAmount(metaForSlug("cbron")?.address)).toBe("1503");
    expect(defaultMintAmount(metaForSlug("ctgbp")?.address)).toBe("74");
  });
});
