import { ethers } from "hardhat";

const OPERATOR_UNTIL = 2n ** 48n - 1n;

export type PrizeLiquidityTarget = {
  id: string;
  asset: string;
  prizePool: string;
};

export type RelayerDecrypt = {
  publicDecrypt(handles: string[]): Promise<{
    clearValues: Record<string, unknown>;
    decryptionProof: Uint8Array | string;
  }>;
};

function toHex(value: Uint8Array | string): `0x${string}` {
  const hex = typeof value === "string" ? (value.startsWith("0x") ? value : `0x${value}`) : ethers.hexlify(value);
  return hex as `0x${string}`;
}

export async function mintWrapAndContribute(
  target: PrizeLiquidityTarget,
  fundingUnits: bigint,
): Promise<void> {
  const [sponsor] = await ethers.getSigners();
  const asset = await ethers.getContractAt(
    [
      "function underlying() view returns (address)",
      "function rate() view returns (uint256)",
      "function wrap(address to,uint256 amount) external",
      "function setOperator(address operator,uint48 until) external",
    ],
    target.asset,
    sponsor,
  );
  const underlyingAddress = await asset.underlying();
  const underlying = await ethers.getContractAt(
    [
      "function mint(address to,uint256 amount) external",
      "function approve(address spender,uint256 amount) external returns (bool)",
      "function decimals() view returns (uint8)",
    ],
    underlyingAddress,
    sponsor,
  );
  const rate = BigInt(await asset.rate());
  if (rate === 0n) throw new Error(`[${target.id}] wrapper rate is zero.`);
  const underlyingUnits = fundingUnits * rate;
  const decimals = Number(await underlying.decimals());
  const maxMint = 1_000_000n * 10n ** BigInt(decimals);
  if (underlyingUnits > maxMint) {
    throw new Error(`[${target.id}] funding exceeds the official 1M-token mint limit.`);
  }
  await (await underlying.mint(sponsor.address, underlyingUnits, { gasLimit: 200_000n })).wait();
  await (await underlying.approve(target.asset, underlyingUnits, { gasLimit: 100_000n })).wait();
  await (await asset.wrap(sponsor.address, underlyingUnits, { gasLimit: 1_500_000n })).wait();
  await (await asset.setOperator(target.prizePool, OPERATOR_UNTIL, { gasLimit: 300_000n })).wait();

  const pool = await ethers.getContractAt("PrizePool", target.prizePool, sponsor);
  await (await pool.contribute(fundingUnits, { gasLimit: 800_000n })).wait();
}

export async function synchronizePrizeLiquidity(
  prizePoolAddress: string,
  instance: RelayerDecrypt,
): Promise<bigint> {
  const [sponsor] = await ethers.getSigners();
  const pool = await ethers.getContractAt("PrizePool", prizePoolAddress, sponsor);
  await (await pool.prepareLiquidity({ gasLimit: 500_000n })).wait();
  const handle = toHex(await pool.liquidityBalanceHandle());
  const result = await instance.publicDecrypt([handle]);
  const clearBalance = BigInt(String(result.clearValues[handle] ?? 0));
  await (await pool.finalizeLiquidity(clearBalance, toHex(result.decryptionProof), { gasLimit: 500_000n })).wait();
  return clearBalance;
}
