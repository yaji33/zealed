import { ethers } from "hardhat";

import {
  activeDrawFundingError,
  assertFundingNotALump,
  defaultDrawBudget,
  formatConfidentialTokens,
  fundingUnitsForVault,
  previewAllocateDraw,
} from "./lib/prizeFunding";
import { registeredVaultSystems } from "./lib/registrySystems";
import { mintWrapAndContribute, synchronizePrizeLiquidity } from "./lib/sponsorPrizeLiquidity";

const RPC =
  process.env.SEPOLIA_RPC_URL ??
  (process.env.INFURA_API_KEY
    ? `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`
    : "https://ethereum-sepolia-rpc.publicnode.com");

const LIVE_SHARES = [5_000n, 3_000n, 1_500n] as const;
const LIVE_SLOTS = [1n, 2n, 4n] as const;
const LIVE_RESERVE_SHARES = 500n;

async function main() {
  const sdk = await import("@zama-fhe/relayer-sdk/node");
  const rpcFromHH = (ethers.provider as unknown as { _getConnection?: () => { url?: string } })._getConnection?.()?.url;
  const instance = await sdk.createInstance({ ...sdk.SepoliaConfig, network: rpcFromHH || RPC });
  const requested = process.env.VAULT_ID?.trim();
  const systems = (await registeredVaultSystems()).filter((system) => !requested || system.id === requested);
  if (systems.length === 0)
    throw new Error(requested ? `Active vault '${requested}' was not found.` : "No active vaults.");

  for (const system of systems) {
    const [sponsor] = await ethers.getSigners();
    const pool = await ethers.getContractAt("PrizePool", system.prizePool, sponsor);
    const activeId = await pool.activeDrawId();
    const fundingUnits = fundingUnitsForVault(system.id);
    if (activeId !== 0n) {
      throw new Error(
        activeDrawFundingError(system.id, activeId, await pool.activeClaimDeadline(), defaultDrawBudget(system.id)),
      );
    }
    assertFundingNotALump(fundingUnits);
    const preview = previewAllocateDraw(fundingUnits, LIVE_SHARES, LIVE_SLOTS, LIVE_RESERVE_SHARES);
    console.log(
      `[${system.id}] funding ${formatConfidentialTokens(fundingUnits)} confidential units; ` +
        `next award ≈ Grand ${formatConfidentialTokens(preview.perSlot[0])} / ` +
        `Standard ${formatConfidentialTokens(preview.perSlot[1])} / ` +
        `Community ${formatConfidentialTokens(preview.perSlot[2])}`,
    );
    await mintWrapAndContribute(system, fundingUnits);
    await synchronizePrizeLiquidity(system.prizePool, instance);
    console.log(`[${system.id}] prize liquidity funded and synchronized`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
