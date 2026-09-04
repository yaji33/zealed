import { ethers, run } from "hardhat";
import * as fs from "node:fs";
import * as path from "node:path";

import { DEFAULT_TIERS, deployVaultSystem, renounceVaultSystemOwnership } from "./lib/deployVaultSystem";

type MultiVaultDeployment = {
  network: string;
  chainId: number;
  architecture: string;
  deployedAt: string;
  deployer: string;
  registry: string;
  vaults: Array<{
    id: string;
    asset: string;
    vault: string;
    ticketEngine: string;
    prizePool: string;
    drawManager: string;
  }>;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function verify(address: string, constructorArguments: unknown[]): Promise<void> {
  try {
    await run("verify:verify", { address, constructorArguments });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes("already verified")) throw error;
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 11155111n) {
    throw new Error(`Expected Sepolia (11155111), got chainId ${network.chainId}`);
  }

  const registryAddress = required("VAULT_REGISTRY_ADDRESS");
  const asset = required("ASSET_ADDRESS");
  const vaultLabel = required("VAULT_ID");
  const vaultId = ethers.encodeBytes32String(vaultLabel);
  const registry = await ethers.getContractAt("VaultRegistry", registryAddress, deployer);
  if ((await registry.owner()).toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error("Configured deployer is not the VaultRegistry owner.");
  }

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

  const record = {
    network: "sepolia",
    chainId: 11155111,
    registeredAt: new Date().toISOString(),
    registry: registryAddress,
    vault: { id: vaultLabel, ...system },
  };
  const outDir = path.join(__dirname, "..", "deployments", "vaults");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${vaultLabel.toLowerCase()}.json`), `${JSON.stringify(record, null, 2)}\n`);

  const manifestPath = path.join(__dirname, "..", "deployments", "sepolia-multivault.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as MultiVaultDeployment;
  if (manifest.registry.toLowerCase() !== registryAddress.toLowerCase()) {
    throw new Error("Canonical deployment manifest belongs to a different VaultRegistry.");
  }
  if (!manifest.vaults.some((vault) => vault.id === vaultLabel)) {
    manifest.vaults.push({ id: vaultLabel, ...system });
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  console.log(JSON.stringify(record, null, 2));

  if (process.env.VERIFY_CONTRACTS !== "0") {
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
