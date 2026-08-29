import { ethers } from "hardhat";
import deployment from "../deployments/sepolia.json";
import { nextKeeperAction, revealTargetBlock } from "./lib/keeperAction";

const RPC =
  process.env.SEPOLIA_RPC_URL ??
  (process.env.INFURA_API_KEY
    ? `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`
    : "https://ethereum-sepolia-rpc.publicnode.com");

const DRAW_GAS = 1_500_000n;
const REVEAL_SLACK = 32n;
const POLL_MS = 15_000;
const OPERATOR_UNTIL = 2n ** 48n - 1n;
/** Matches DrawManager.YIELD_DIVISOR. */
const YIELD_DIVISOR = 120_000n;

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
  const vault = await ethers.getContractAt("ConfidentialVault", deployment.contracts.ConfidentialVault, signer);
  const asset = await ethers.getContractAt(
    [
      "function setOperator(address operator, uint48 until) external",
      "function isOperator(address holder, address spender) view returns (bool)",
    ],
    deployment.asset,
    signer,
  );

  const drawAddress = deployment.contracts.DrawManager;
  console.log("keeper", signer.address, "draw", drawAddress);

  try {
    const isOp = await asset.isOperator(signer.address, drawAddress);
    if (!isOp) {
      const tx = await asset.setOperator(drawAddress, OPERATOR_UNTIL, { gasLimit: 300_000n });
      await tx.wait();
      console.log("setOperator(DrawManager) for prize pot funding");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("operator check/set skipped:", message.split("\n")[0]);
  }

  let stopping = false;
  process.on("SIGINT", () => {
    stopping = true;
  });

  while (!stopping) {
    try {
      const [
        drawId,
        revealed,
        lastCommitTimestamp,
        minInterval,
        minRevealDelay,
        maxRevealWindow,
        revealBlock,
        block,
        now,
      ] = await Promise.all([
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
        const ticketHandle = toHex(await tickets.totalTickets());
        const ticketPub = await instance.publicDecrypt([ticketHandle]);
        const totalTickets = BigInt(String(ticketPub.clearValues[ticketHandle] ?? 0));
        if (totalTickets === 0n) {
          console.log("skip commit: pool has no tickets");
        } else {
          const tvlHandle = toHex(await vault.totalDeposits());
          const tvlPub = await instance.publicDecrypt([tvlHandle]);
          const tvl = BigInt(String(tvlPub.clearValues[tvlHandle] ?? 0));
          const elapsed = lastCommitTimestamp === 0n ? minInterval : now - lastCommitTimestamp;
          const prize = (tvl * elapsed) / YIELD_DIVISOR;
          if (prize === 0n) {
            console.log("skip commit: computed prize is zero");
          } else {
            const target = revealTargetBlock(BigInt(block), minRevealDelay, REVEAL_SLACK);
            const tx = await draw.commitDraw(target, tvl, toHex(tvlPub.decryptionProof), {
              gasLimit: DRAW_GAS,
            });
            await tx.wait();
            console.log("commitDraw", tx.hash);
          }
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
