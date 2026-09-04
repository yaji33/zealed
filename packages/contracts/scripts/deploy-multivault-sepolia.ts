import { ethers, run } from "hardhat";
import * as fs from "node:fs";
import * as path from "node:path";

import { DEFAULT_TIERS, deployVaultSystem, renounceVaultSystemOwnership } from "./lib/deployVaultSystem";

const DEFAULT_CUSDC = "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639";

async function verify(address: string, constructorArguments: unknown[]): Promise<void> {
  try {
    await run("verify:verify", { address, constructorArguments });
    console.log("verified", address);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes("already verified")) throw error;
    console.log("already verified", address);
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 11155111n) {
    throw new Error(`Expected Sepolia (11155111), got chainId ${network.chainId}`);
  }

  const asset = process.env.ASSET_ADDRESS ?? process.env.CUSDC_ADDRESS ?? DEFAULT_CUSDC;
  const vaultLabel = process.env.VAULT_ID ?? "cusdc";
  const vaultId = ethers.encodeBytes32String(vaultLabel);

  const Registry = await ethers.getContractFactory("VaultRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();

  const system = await deployVaultSystem(asset);
  await (
    await registry.registerVault(
      vaultId,
      system.asset,
      system.vault,
      system.ticketEngine,
      system.prizePool,
      system.drawManager,
    )
  ).wait();
  await renounceVaultSystemOwnership(system);

  const deployment = {
    network: "sepolia",
    chainId: 11155111,
    architecture: "curated-multi-vault",
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    registry: registryAddress,
    vaults: [{ id: vaultLabel, ...system }],
  };
  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "sepolia-multivault.json");
  fs.writeFileSync(outFile, `${JSON.stringify(deployment, null, 2)}\n`);
  console.log(JSON.stringify(deployment, null, 2));

  if (process.env.VERIFY_CONTRACTS !== "0") {
    await verify(registryAddress, []);
    await verify(system.vault, [asset]);
    await verify(system.ticketEngine, [system.vault]);
    await verify(system.prizePool, [asset, DEFAULT_TIERS.shares, DEFAULT_TIERS.slots, DEFAULT_TIERS.reserveShares]);
    await verify(system.drawManager, [system.ticketEngine, system.vault, system.prizePool]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
