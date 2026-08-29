import { ethers } from "hardhat";
import deployment from "../deployments/sepolia.json";
import { nextKeeperAction, revealTargetBlock } from "./lib/keeperAction";

const RPC =
  process.env.SEPOLIA_RPC_URL ??
  (process.env.INFURA_API_KEY
    ? `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`
    : "https://ethereum-sepolia-rpc.publicnode.com");

/** Matches the in-app public demo prize (1 cUSDC at 6 decimals). */
const DEMO_PRIZE_PLAIN = 1_000_000n;
const DRAW_GAS = 1_500_000n;
const REVEAL_SLACK = 32n;
const POLL_MS = 15_000;

function toHex(value: Uint8Array | string): string {
  if (typeof value === "string") return value.startsWith("0x") ? value : `0x${value}`;
  return ethers.hexlify(value);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const sdk = await import("@zama-fhe/relayer-sdk/node");
  const [signer] = await ethers.getSigners();
  const rpcFromHH = (ethers.provider as unknown as { _getConnection?: () => { url?: string } })._getConnection?.()?.url;
  const instance = await sdk.createInstance({
    ...sdk.SepoliaConfig,
    network: rpcFromHH || RPC,
  });

  const draw = await ethers.getContractAt("DrawManager", deployment.contracts.DrawManager, signer);
  const tickets = await ethers.getContractAt("TicketEngine", deployment.contracts.TicketEngine, signer);

  console.log("keeper", signer.address, "draw", deployment.contracts.DrawManager);

  let stopping = false;
  process.on("SIGINT", () => {
    stopping = true;
  });

  while (!stopping) {
    try {
      const [drawId, revealed, lastCommitTimestamp, minInterval, minRevealDelay, maxRevealWindow, revealBlock, block, now] =
        await Promise.all([
          draw.drawId(),
          draw.revealed(),
          draw.lastCommitTimestamp(),
          draw.MIN_DRAW_INTERVAL(),
          draw.MIN_REVEAL_DELAY(),
          draw.MAX_REVEAL_WINDOW(),
          draw.revealBlock(),
          ethers.provider.getBlockNumber(),
          ethers.provider.getBlock("latest").then((b) => BigInt(b?.timestamp ?? 0)),
        ]);

      const action = nextKeeperAction({
        drawId,
        revealed,
        lastCommitTimestamp,
        minInterval,
        now,
        blockNumber: BigInt(block),
        revealBlock,
        maxRevealWindow,
      });

      if (action === "commit") {
        const handle = toHex(await tickets.totalTickets());
        const pub = await instance.publicDecrypt([handle]);
        const total = BigInt(String(pub.clearValues[handle] ?? 0));
        if (total === 0n) {
          console.log("skip commit: pool has no tickets");
        } else {
          const target = revealTargetBlock(BigInt(block), minRevealDelay, REVEAL_SLACK);
          const tx = await draw.commitDraw(target, DEMO_PRIZE_PLAIN, { gasLimit: DRAW_GAS });
          await tx.wait();
          console.log("commitDraw", tx.hash);
        }
      } else if (action === "reveal") {
        const handle = toHex(await tickets.totalTickets());
        const pub = await instance.publicDecrypt([handle]);
        const total = BigInt(String(pub.clearValues[handle] ?? 0));
        if (total === 0n) {
          console.log("skip reveal: pool has no tickets");
        } else {
          const tx = await draw.revealDraw(total, toHex(pub.decryptionProof), { gasLimit: DRAW_GAS });
          await tx.wait();
          console.log("revealDraw", tx.hash);
        }
      } else if (action === "missed") {
        console.log("reveal window missed; new commits are blocked until this draw can settle");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("keeper tick failed:", message.split("\n")[0]);
    }

    if (!stopping) await sleep(POLL_MS);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
