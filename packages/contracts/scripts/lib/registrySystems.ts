import { ethers } from "hardhat";

import deployment from "../../deployments/sepolia-multivault.json";

export type RegisteredVaultSystem = {
  id: string;
  vaultId: string;
  asset: string;
  vault: string;
  ticketEngine: string;
  prizePool: string;
  drawManager: string;
  active: boolean;
};

export function configuredRegistryAddress(): string {
  const address = process.env.VAULT_REGISTRY_ADDRESS?.trim() || deployment.registry;
  if (!ethers.isAddress(address) || address === ethers.ZeroAddress) {
    throw new Error("VAULT_REGISTRY_ADDRESS must identify the deployed VaultRegistry.");
  }
  return address;
}

export async function registeredVaultSystems(activeOnly = true): Promise<RegisteredVaultSystem[]> {
  const registry = await ethers.getContractAt("VaultRegistry", configuredRegistryAddress());
  const count = Number(await registry.vaultCount());
  const systems: RegisteredVaultSystem[] = [];

  for (let index = 0; index < count; index += 1) {
    const vaultId = await registry.vaultIdAt(index);
    const system = await registry.getVault(vaultId);
    if (activeOnly && !system.active) continue;
    systems.push({
      id: ethers.decodeBytes32String(vaultId),
      vaultId,
      asset: system.asset,
      vault: system.vault,
      ticketEngine: system.ticketEngine,
      prizePool: system.prizePool,
      drawManager: system.drawManager,
      active: system.active,
    });
  }

  return systems;
}

export async function selectedVaultSystem(): Promise<RegisteredVaultSystem> {
  const systems = await registeredVaultSystems(false);
  const requested = process.env.VAULT_ID?.trim();
  const selected = requested ? systems.find((system) => system.id === requested) : systems[0];
  if (!selected) {
    throw new Error(requested ? `Vault '${requested}' is not registered.` : "Registry has no vault systems.");
  }
  return selected;
}
