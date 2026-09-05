import { getAddress, type Address } from "viem";

/** Official Zama Sepolia confidential wrappers: https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia */
export type WrapperMeta = {
  address: Address;
  name: string;
  symbol: string;
  shortLabel: string;
  slug: string;
  /** ERC-7984 confidential decimals. Official Sepolia mocks report 6. */
  decimals: number;
  /** Public mock underlying decimals. WETH/ZAMA underlyings are 18. */
  underlyingDecimals: number;
  /** Human faucet mint/wrap amount, about $100 notional. */
  mintUsd100: string;
  accent: string;
  mintable: boolean;
};

export const ZAMA_SEPOLIA_WRAPPERS: readonly WrapperMeta[] = [
  {
    address: "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639",
    name: "Confidential USDC (Mock)",
    symbol: "cUSDCMock",
    shortLabel: "cUSDC",
    slug: "cusdc",
    decimals: 6,
    underlyingDecimals: 6,
    mintUsd100: "100",
    accent: "#2775CA",
    mintable: true,
  },
  {
    address: "0x4E7B06D78965594eB5EF5414c357ca21E1554491",
    name: "Confidential USDT (Mock)",
    symbol: "cUSDTMock",
    shortLabel: "cUSDT",
    slug: "cusdt",
    decimals: 6,
    underlyingDecimals: 6,
    mintUsd100: "100",
    accent: "#26A17B",
    mintable: true,
  },
  {
    address: "0x46208622DA27d91db4f0393733C8BA082ed83158",
    name: "Confidential WETH (Mock)",
    symbol: "cWETHMock",
    shortLabel: "cWETH",
    slug: "cweth",
    decimals: 6,
    underlyingDecimals: 18,
    mintUsd100: "0.04",
    accent: "#627EEA",
    mintable: true,
  },
  {
    address: "0xf2D628d2598aF4eAF94CB76a437Ff86CA78FfbFB",
    name: "Confidential ZAMA (Mock)",
    symbol: "cZAMAMock",
    shortLabel: "cZAMA",
    slug: "czama",
    decimals: 6,
    underlyingDecimals: 18,
    mintUsd100: "1918.4",
    accent: "#E8C547",
    mintable: true,
  },
  {
    address: "0xe4FcF848739845BC81Dee1d5352cf3844F0a60C7",
    name: "Confidential XAUt (Mock)",
    symbol: "cXAUtMock",
    shortLabel: "cXAUt",
    slug: "cxaut",
    decimals: 6,
    underlyingDecimals: 6,
    mintUsd100: "0.0226",
    accent: "#D4A84B",
    mintable: true,
  },
  {
    address: "0xaa5612FA27c927a0c7961f5AEFEE5ba3A0F9C891",
    name: "Confidential BRON (Mock)",
    symbol: "cBRONMock",
    shortLabel: "cBRON",
    slug: "cbron",
    decimals: 6,
    underlyingDecimals: 18,
    mintUsd100: "1503",
    accent: "#CD7F32",
    mintable: true,
  },
  {
    address: "0xfCE5c7069c5525eF6c8C2b2E35A745bA20a2F7CC",
    name: "Confidential tGBP (Mock)",
    symbol: "ctGBPMock",
    shortLabel: "ctGBP",
    slug: "ctgbp",
    decimals: 6,
    underlyingDecimals: 18,
    mintUsd100: "74",
    accent: "#5B9FD4",
    mintable: true,
  },
] as const;

const BY_ADDRESS = new Map(
  ZAMA_SEPOLIA_WRAPPERS.map((wrapper) => [
    wrapper.address.toLowerCase(),
    wrapper,
  ]),
);

const BY_SLUG = new Map(
  ZAMA_SEPOLIA_WRAPPERS.map((wrapper) => [wrapper.slug, wrapper]),
);

export function metaForAsset(asset: Address | string | undefined): WrapperMeta | undefined {
  if (!asset) return undefined;
  try {
    return BY_ADDRESS.get(getAddress(asset).toLowerCase()) ?? BY_ADDRESS.get(asset.toLowerCase());
  } catch {
    return BY_ADDRESS.get(asset.toLowerCase());
  }
}

export function metaForSlug(slug: string): WrapperMeta | undefined {
  return BY_SLUG.get(slug.toLowerCase());
}

export function shortLabelFor(asset: Address | undefined, fallback: string): string {
  return metaForAsset(asset)?.shortLabel ?? fallback;
}

export function wrapperSymbolFor(asset: Address | undefined, fallback: string): string {
  return metaForAsset(asset)?.symbol ?? fallback;
}

export function wrapperDecimalsFor(asset: Address | undefined, fallback = 6): number {
  return metaForAsset(asset)?.decimals ?? fallback;
}

export function wrapperUnderlyingDecimalsFor(
  asset: Address | undefined,
  fallback = 6,
): number {
  return metaForAsset(asset)?.underlyingDecimals ?? fallback;
}

export function wrapperAccentFor(asset: Address | undefined): string {
  return metaForAsset(asset)?.accent ?? "#b8f5e6";
}

/** Faucet mint/wrap default in human tokens, about $100 of the selected asset. */
export function defaultMintAmount(asset: Address | string | undefined): string {
  return metaForAsset(asset)?.mintUsd100 ?? "100";
}
