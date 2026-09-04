import { ethers } from "hardhat";
import { nextKeeperAction } from "./lib/keeperAction";
import { registeredVaultSystems } from "./lib/registrySystems";

const RPC =
  process.env.SEPOLIA_RPC_URL ??
  (process.env.INFURA_API_KEY
    ? `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`
    : "https://ethereum-sepolia-rpc.publicnode.com");
const POLL_MS = 15_000;
const MAX_KEEPER_VAULTS = 32;

type Stack = {
  id: string;
  asset: string;
  vault: string;
  ticketEngine: string;
  prizePool: string;
  drawManager: string;
};

type RelayerInstance = {
  publicDecrypt(handles: string[]): Promise<{
    clearValues: Record<string, unknown>;
    decryptionProof: Uint8Array | string;
  }>;
};

function toHex(value: Uint8Array | string): string {
  if (typeof value === "string") return value.startsWith("0x") ? value : `0x${value}`;
  return ethers.hexlify(value);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function bufferedGas(estimate: bigint): bigint {
  return (estimate * 125n) / 100n;
}

async function publicDecrypt(instance: RelayerInstance, handle: string): Promise<{ clear: bigint; proof: string }> {
  const result = await instance.publicDecrypt([handle]);
  return {
    clear: BigInt(String(result.clearValues[handle] ?? 0)),
    proof: toHex(result.decryptionProof),
  };
}

async function configuredStacks(): Promise<Stack[]> {
  const systems = await registeredVaultSystems();
  if (systems.length > MAX_KEEPER_VAULTS) {
    throw new Error(`Registry has ${systems.length} active entries; keeper limit is ${MAX_KEEPER_VAULTS}.`);
  }
  return systems;
}

async function tickStack(stack: Stack, instance: RelayerInstance): Promise<void> {
  const [signer] = await ethers.getSigners();
  const draw = await ethers.getContractAt("DrawManager", stack.drawManager, signer);
  const tickets = await ethers.getContractAt("TicketEngine", stack.ticketEngine, signer);
  const prizePool = await ethers.getContractAt("PrizePool", stack.prizePool, signer);

  const id = await draw.drawId();
  const periodStartTime = await draw.periodStartTime();
  const minInterval = await draw.MIN_DRAW_INTERVAL();
  const now = BigInt((await ethers.provider.getBlock("latest"))?.timestamp ?? 0);
  const state =
    id === 0n
      ? {
          startVersion: 0n,
          startTime: 0n,
          endVersion: 0n,
          endTime: 0n,
          totalScore: 0n,
          claimDeadline: 0n,
          closed: false,
          awarded: false,
          reconciliationPrepared: false,
          reconciled: false,
        }
      : await draw.draws(id);

  const action = nextKeeperAction({
    drawId: id,
    periodStartTime,
    now,
    minInterval,
    closed: state.closed,
    awarded: state.awarded,
    claimDeadline: state.claimDeadline,
    reconciliationPrepared: state.reconciliationPrepared,
    reconciled: state.reconciled,
  });

  if (action === "close") {
    if ((await tickets.nextIndex()) <= 1n) {
      console.log(`[${stack.id}] keeper waiting for first depositor`);
    } else {
      const gasLimit = bufferedGas(await draw.closeDraw.estimateGas());
      const tx = await draw.closeDraw({ gasLimit });
      await tx.wait();
      console.log(`[${stack.id}] keeper closed draw`, tx.hash);
    }
  } else if (action === "award") {
    await (await prizePool.prepareLiquidity({ gasLimit: 500_000n })).wait();
    const liquidity = await publicDecrypt(instance, toHex(await prizePool.liquidityBalanceHandle()));
    if (liquidity.clear === 0n) {
      throw new Error("Prize pool is empty; run prizes:fund:sepolia before awarding.");
    }
    await (await prizePool.finalizeLiquidity(liquidity.clear, liquidity.proof, { gasLimit: 500_000n })).wait();

    const score = await publicDecrypt(instance, toHex(await tickets.preparedTotal()));
    if (score.clear === 0n) {
      const tx = await draw.cancelEmptyDraw(id, score.proof, { gasLimit: 500_000n });
      await tx.wait();
      console.log(`[${stack.id}] keeper cancelled empty draw`, tx.hash);
    } else {
      const gasLimit = bufferedGas(await draw.awardDraw.estimateGas(id, score.clear, score.proof));
      const tx = await draw.awardDraw(id, score.clear, score.proof, { gasLimit });
      await tx.wait();
      console.log(`[${stack.id}] keeper awarded draw`, tx.hash);
    }
  } else if (action === "prepare-reconciliation") {
    const tx = await draw.prepareReconciliation(id, { gasLimit: 800_000n });
    await tx.wait();
    console.log(`[${stack.id}] keeper prepared rollover`, tx.hash);
  } else if (action === "finalize-reconciliation") {
    const balance = await publicDecrypt(instance, toHex(await prizePool.reconciliationBalanceHandle()));
    const tx = await draw.finalizeReconciliation(id, balance.clear, balance.proof, {
      gasLimit: 800_000n,
    });
    await tx.wait();
    console.log(`[${stack.id}] keeper finalized rollover`, tx.hash);
  }
}

async function main() {
  const sdk = await import("@zama-fhe/relayer-sdk/node");
  const rpcFromHH = (ethers.provider as unknown as { _getConnection?: () => { url?: string } })._getConnection?.()?.url;
  const instance = await sdk.createInstance({ ...sdk.SepoliaConfig, network: rpcFromHH || RPC });

  let stopping = false;
  process.on("SIGINT", () => {
    stopping = true;
  });

  while (!stopping) {
    const stacks = await configuredStacks();
    if (stacks.length === 0) throw new Error("Registry has no active vault systems.");
    for (const stack of stacks) {
      try {
        await tickStack(stack, instance);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[${stack.id}] keeper tick failed:`, message.split("\n")[0]);
      }
    }

    if (process.env.KEEPER_ONCE === "1") break;
    if (!stopping) await sleep(POLL_MS);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
