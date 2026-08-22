import { ethers } from "hardhat";
import deployment from "../deployments/sepolia.json";

const RPC =
  process.env.SEPOLIA_RPC_URL ??
  (process.env.INFURA_API_KEY
    ? `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`
    : "https://ethereum-sepolia-rpc.publicnode.com");

function toHex(value: Uint8Array | string): string {
  if (typeof value === "string") return value.startsWith("0x") ? value : `0x${value}`;
  return ethers.hexlify(value);
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
  const drawAddress = deployment.contracts.DrawManager;

  const index = await tickets.indexOf(signer.address);
  console.log("ticket index:", index.toString());
  if (index === 0n) throw new Error("no ticket index — deposit first via smoke-sepolia.ts");

  let drawId = await draw.drawId();
  let revealed = await draw.revealed();
  console.log("drawId", drawId.toString(), "revealed", revealed);

  if (drawId === 0n || revealed) {
    const target = (await ethers.provider.getBlockNumber()) + 3;
    await (await draw.commitDraw(target, 1000n, { gasLimit: 1_500_000n })).wait();
    drawId = await draw.drawId();
    console.log("committed draw", drawId.toString(), "revealBlock", target);
    while ((await ethers.provider.getBlockNumber()) <= target) {
      await new Promise((r) => setTimeout(r, 12_000));
      console.log("…block", await ethers.provider.getBlockNumber());
    }
  } else {
    const revealBlock = await draw.revealBlock();
    console.log("waiting for existing revealBlock", revealBlock.toString());
    while ((await ethers.provider.getBlockNumber()) <= Number(revealBlock)) {
      await new Promise((r) => setTimeout(r, 12_000));
      console.log("…block", await ethers.provider.getBlockNumber());
    }
  }

  revealed = await draw.revealed();
  if (!revealed) {
    const ticketsTotal = toHex(await tickets.totalTickets());
    const pubStart = Date.now();
    const pub = await instance.publicDecrypt([ticketsTotal]);
    console.log("publicDecrypt totalTickets ms:", Date.now() - pubStart);
    const total = BigInt(String(pub.clearValues[ticketsTotal]));
    console.log("totalTickets", total.toString());
    await (
      await draw.revealDraw(total, toHex(pub.decryptionProof), { gasLimit: 1_500_000n })
    ).wait();
    console.log("revealed r=", (await draw.drawRandomValue()).toString());
  }

  drawId = await draw.drawId();
  const already = await draw.hasChecked(drawId, signer.address);
  if (already) {
    console.log("already checked this draw");
  } else {
    const checkStart = Date.now();
    const checkTx = await draw.checkIfWon(drawId, { gasLimit: 5_000_000n });
    const receipt = await checkTx.wait();
    console.log("checkIfWon gasUsed:", receipt?.gasUsed.toString(), "wall ms:", Date.now() - checkStart);
  }

  const keypair = instance.generateKeypair();
  const startTimestamp = Math.floor(Date.now() / 1000);
  const durationDays = 7;
  const handle = toHex(await draw.getPendingPrize());
  const eip712 = instance.createEIP712(keypair.publicKey, [drawAddress], startTimestamp, durationDays);
  const { EIP712Domain: _ignored, ...types } = eip712.types as Record<string, unknown>;
  void _ignored;
  const signature = await signer.signTypedData(
    eip712.domain,
    types as Record<string, { name: string; type: string }[]>,
    eip712.message,
  );
  const decStart = Date.now();
  const results = await instance.userDecrypt(
    [{ handle, contractAddress: drawAddress }],
    keypair.privateKey,
    keypair.publicKey,
    signature.replace(/^0x/, ""),
    [drawAddress],
    signer.address,
    startTimestamp,
    durationDays,
  );
  console.log("userDecrypt prize ms:", Date.now() - decStart);
  console.log("pending prize:", String(results[handle]));
  console.log("SMOKE_DRAW_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
