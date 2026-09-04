import { ethers } from "hardhat";

export type TierConfiguration = {
  shares: [number, number, number];
  slots: [number, number, number];
  reserveShares: number;
};

export type DeployedVaultSystem = {
  asset: string;
  vault: string;
  ticketEngine: string;
  prizePool: string;
  drawManager: string;
};

export const DEFAULT_TIERS: TierConfiguration = {
  shares: [5_000, 3_000, 1_500],
  slots: [1, 2, 4],
  reserveShares: 500,
};

export async function deployVaultSystem(
  asset: string,
  tiers: TierConfiguration = DEFAULT_TIERS,
): Promise<DeployedVaultSystem> {
  if (!ethers.isAddress(asset) || asset === ethers.ZeroAddress) {
    throw new Error("ASSET_ADDRESS must be a non-zero contract address.");
  }
  if ((await ethers.provider.getCode(asset)) === "0x") {
    throw new Error(`No asset contract is deployed at ${asset}.`);
  }

  const Vault = await ethers.getContractFactory("ConfidentialVault");
  const vault = await Vault.deploy(asset);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();

  const Tickets = await ethers.getContractFactory("TicketEngine");
  const tickets = await Tickets.deploy(vaultAddress);
  await tickets.waitForDeployment();
  const ticketEngineAddress = await tickets.getAddress();

  const Pool = await ethers.getContractFactory("PrizePool");
  const pool = await Pool.deploy(asset, tiers.shares, tiers.slots, tiers.reserveShares);
  await pool.waitForDeployment();
  const prizePoolAddress = await pool.getAddress();

  const Draw = await ethers.getContractFactory("DrawManager");
  const draw = await Draw.deploy(ticketEngineAddress, vaultAddress, prizePoolAddress);
  await draw.waitForDeployment();
  const drawManagerAddress = await draw.getAddress();

  await (await vault.setTicketEngine(ticketEngineAddress)).wait();
  await (await tickets.setDrawManager(drawManagerAddress)).wait();
  await (await pool.setDrawManager(drawManagerAddress)).wait();

  return {
    asset,
    vault: vaultAddress,
    ticketEngine: ticketEngineAddress,
    prizePool: prizePoolAddress,
    drawManager: drawManagerAddress,
  };
}

export async function renounceVaultSystemOwnership(system: DeployedVaultSystem): Promise<void> {
  const vault = await ethers.getContractAt("ConfidentialVault", system.vault);
  const tickets = await ethers.getContractAt("TicketEngine", system.ticketEngine);
  const pool = await ethers.getContractAt("PrizePool", system.prizePool);
  await (await vault.renounceOwnership()).wait();
  await (await tickets.renounceOwnership()).wait();
  await (await pool.renounceOwnership()).wait();
}
