import { ethers } from "hardhat";

import { registeredVaultSystems } from "./lib/registrySystems";

const RPC =
  process.env.SEPOLIA_RPC_URL ??
  (process.env.INFURA_API_KEY
    ? `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`
    : "https://ethereum-sepolia-rpc.publicnode.com");
const DEFAULT_FUNDING_UNITS = 100_000_000n;
const OPERATOR_UNTIL = 2n ** 48n - 1n;

function toHex(value: Uint8Array | string): `0x${string}` {
  const hex = typeof value === "string" ? (value.startsWith("0x") ? value : `0x${value}`) : ethers.hexlify(value);
  return hex as `0x${string}`;
}

async function main() {
  const sdk = await import("@zama-fhe/relayer-sdk/node");
  const [sponsor] = await ethers.getSigners();
  const rpcFromHH = (ethers.provider as unknown as { _getConnection?: () => { url?: string } })._getConnection?.()?.url;
  const instance = await sdk.createInstance({ ...sdk.SepoliaConfig, network: rpcFromHH || RPC });
  const requested = process.env.VAULT_ID?.trim();
  const systems = (await registeredVaultSystems()).filter((system) => !requested || system.id === requested);
  if (systems.length === 0)
    throw new Error(requested ? `Active vault '${requested}' was not found.` : "No active vaults.");
  const fundingUnits = BigInt(process.env.PRIZE_FUNDING_UNITS ?? DEFAULT_FUNDING_UNITS);
  if (fundingUnits <= 0n || fundingUnits > 2n ** 64n - 1n) throw new Error("Invalid PRIZE_FUNDING_UNITS.");

  for (const system of systems) {
    const asset = await ethers.getContractAt(
      [
        "function underlying() view returns (address)",
        "function rate() view returns (uint256)",
        "function wrap(address to,uint256 amount) external",
        "function setOperator(address operator,uint48 until) external",
      ],
      system.asset,
      sponsor,
    );
    const underlyingAddress = await asset.underlying();
    const underlying = await ethers.getContractAt(
      [
        "function mint(address to,uint256 amount) external",
        "function approve(address spender,uint256 amount) external returns (bool)",
      ],
      underlyingAddress,
      sponsor,
    );
    const rate = BigInt(await asset.rate());
    const underlyingUnits = fundingUnits * rate;
    await (await underlying.mint(sponsor.address, underlyingUnits)).wait();
    await (await underlying.approve(system.asset, underlyingUnits)).wait();
    await (await asset.wrap(sponsor.address, underlyingUnits)).wait();
    await (await asset.setOperator(system.prizePool, OPERATOR_UNTIL)).wait();

    const pool = await ethers.getContractAt("PrizePool", system.prizePool, sponsor);
    await (await pool.contribute(fundingUnits, { gasLimit: 800_000n })).wait();
    await (await pool.prepareLiquidity({ gasLimit: 500_000n })).wait();
    const handle = toHex(await pool.liquidityBalanceHandle());
    const result = await instance.publicDecrypt([handle]);
    const clearBalance = BigInt(String(result.clearValues[handle] ?? 0));
    await (await pool.finalizeLiquidity(clearBalance, toHex(result.decryptionProof), { gasLimit: 500_000n })).wait();
    console.log(`[${system.id}] prize liquidity funded and synchronized`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
