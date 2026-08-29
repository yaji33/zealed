import { ethers } from "hardhat";
import deployment from "../deployments/sepolia.json";

const UNDERLYING = "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF";
const OPERATOR_UNTIL = 2n ** 48n - 1n;
const AMOUNT = 1_000_000n;
const WITHDRAW = 250_000n;
const RPC =
  process.env.SEPOLIA_RPC_URL ??
  // Prefer Infura when available (public RPCs often timeout during Relayer SDK encrypt).
  (process.env.INFURA_API_KEY
    ? `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`
    : "https://ethereum-sepolia-rpc.publicnode.com");


const erc20Abi = [
  "function mint(address to, uint256 amount) external",
  "function approve(address spender, uint256 amount) external returns (bool)",
];

const wrapperAbi = [
  "function wrap(address to, uint256 amount) external returns (bytes32)",
  "function rate() view returns (uint256)",
  "function setOperator(address operator, uint48 until) external",
  "function isOperator(address holder, address spender) view returns (bool)",
];

function toHex(value: Uint8Array | string): string {
  if (typeof value === "string") return value.startsWith("0x") ? value : `0x${value}`;
  return ethers.hexlify(value);
}

async function main() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const rpcFromHH = (ethers.provider as unknown as { _getConnection?: () => { url?: string } })._getConnection?.()?.url;
  const rpc = rpcFromHH || RPC;
  console.log("chainId:", Number(network.chainId), "sdk rpc:", rpc.replace(/\/v3\/.*/, "/v3/***"));

  console.log("creating FHE instance…");
  const sdk = await import("@zama-fhe/relayer-sdk/node");
  const tInst = Date.now();
  const instance = await sdk.createInstance({
    ...sdk.SepoliaConfig,
    network: rpc,
  });
  console.log("FHE instance ready ms:", Date.now() - tInst);

  const vaultAddress = deployment.contracts.ConfidentialVault;
  const assetAddress = deployment.asset;
  const drawAddress = deployment.contracts.DrawManager;
  const ticketsAddress = deployment.contracts.TicketEngine;

  console.log("Smoke signer:", signer.address);
  console.log("Vault:", vaultAddress);

  const underlying = new ethers.Contract(UNDERLYING, erc20Abi, signer);
  const asset = new ethers.Contract(assetAddress, wrapperAbi, signer);
  const vault = await ethers.getContractAt("ConfidentialVault", vaultAddress, signer);
  const draw = await ethers.getContractAt("DrawManager", drawAddress, signer);
  const tickets = await ethers.getContractAt("TicketEngine", ticketsAddress, signer);

  const rate: bigint = await asset.rate();
  const underlyingNeeded = AMOUNT * rate;
  console.log("cUSDC rate:", rate.toString(), "minting underlying:", underlyingNeeded.toString());

  await (await underlying.mint(signer.address, underlyingNeeded)).wait();
  console.log("minted underlying");
  await (await underlying.approve(assetAddress, underlyingNeeded)).wait();
  console.log("approved wrapper");
  await (await asset.wrap(signer.address, underlyingNeeded)).wait();
  console.log("wrapped cUSDC");

  const isOp = await asset.isOperator(signer.address, vaultAddress);
  console.log("isOperator:", isOp);
  if (!isOp) {
    await (await asset.setOperator(vaultAddress, OPERATOR_UNTIL)).wait();
    console.log("setOperator(vault)");
  }

  async function encrypt64(contract: string, amount: bigint) {
    const encStart = Date.now();
    const input = instance.createEncryptedInput(contract, signer.address);
    input.add64(amount);
    const encrypted = await input.encrypt();
    console.log("encrypt latency ms:", Date.now() - encStart);
    return {
      handle: toHex(encrypted.handles[0]),
      inputProof: toHex(encrypted.inputProof),
    };
  }

  async function userDecrypt(handle: string, contract: string): Promise<bigint> {
    const keypair = instance.generateKeypair();
    const startTimestamp = Math.floor(Date.now() / 1000);
    const durationDays = 7;
    const eip712 = instance.createEIP712(keypair.publicKey, [contract], startTimestamp, durationDays);
    const { EIP712Domain: _ignored, ...types } = eip712.types as Record<string, unknown>;
    void _ignored;
    const signature = await signer.signTypedData(
      eip712.domain,
      types as Record<string, { name: string; type: string }[]>,
      eip712.message,
    );
    const decStart = Date.now();
    const results = await instance.userDecrypt(
      [{ handle, contractAddress: contract }],
      keypair.privateKey,
      keypair.publicKey,
      signature.replace(/^0x/, ""),
      [contract],
      signer.address,
      startTimestamp,
      durationDays,
    );
    console.log("userDecrypt latency ms:", Date.now() - decStart);
    const value = results[handle];
    if (typeof value === "bigint") return value;
    if (typeof value === "number") return BigInt(value);
    if (typeof value === "string") return BigInt(value);
    throw new Error("unexpected decrypt type");
  }

  console.log("encrypting deposit…");
  const balBefore = await userDecrypt(toHex(await vault.getBalance()), vaultAddress).catch(() => 0n);
  console.log("balance before deposit:", balBefore.toString());

  const depEnc = await encrypt64(vaultAddress, AMOUNT);
  const depStart = Date.now();
  const depTx = await vault.deposit(depEnc.handle, depEnc.inputProof);
  const depReceipt = await depTx.wait();
  console.log("deposit gasUsed:", depReceipt?.gasUsed.toString(), "wall ms:", Date.now() - depStart);

  const balClear = await userDecrypt(toHex(await vault.getBalance()), vaultAddress);
  console.log("balance after deposit:", balClear.toString());
  if (balClear !== balBefore + AMOUNT) {
    throw new Error(`expected ${balBefore + AMOUNT}, got ${balClear}`);
  }

  const wEnc = await encrypt64(vaultAddress, WITHDRAW);
  const wStart = Date.now();
  const wTx = await vault.withdraw(wEnc.handle, wEnc.inputProof);
  const wReceipt = await wTx.wait();
  console.log("withdraw gasUsed:", wReceipt?.gasUsed.toString(), "wall ms:", Date.now() - wStart);

  const bal2 = await userDecrypt(toHex(await vault.getBalance()), vaultAddress);
  console.log("balance after withdraw:", bal2.toString());
  if (bal2 !== balBefore + AMOUNT - WITHDRAW) {
    throw new Error(`expected ${balBefore + AMOUNT - WITHDRAW}, got ${bal2}`);
  }

  const totalHandle = toHex(await vault.totalDeposits());
  const pubStart = Date.now();
  const totalDecrypt = await instance.publicDecrypt([totalHandle]);
  console.log("publicDecrypt TVL latency ms:", Date.now() - pubStart);
  console.log("public TVL:", String(totalDecrypt.clearValues[totalHandle]));

  if (process.env.RUN_DRAW === "1") {
    const index = await tickets.indexOf(signer.address);
    console.log("ticket index:", index.toString());
    if (index === 0n) throw new Error("expected ticket index after deposit");

    const drawOp = await asset.isOperator(signer.address, drawAddress);
    if (!drawOp) {
      await (await asset.setOperator(drawAddress, OPERATOR_UNTIL)).wait();
      console.log("setOperator(DrawManager)");
    }

    const minDelay = Number(await draw.MIN_REVEAL_DELAY());
    const target = (await ethers.provider.getBlockNumber()) + minDelay + 1;
    const tvlClear = BigInt(String(totalDecrypt.clearValues[totalHandle]));
    await (
      await draw.commitDraw(target, tvlClear, toHex(totalDecrypt.decryptionProof), { gasLimit: 1_500_000n })
    ).wait();
    console.log("committed draw; waiting for block", target);
    while ((await ethers.provider.getBlockNumber()) <= target) {
      await new Promise((r) => setTimeout(r, 12_000));
      console.log("…block", await ethers.provider.getBlockNumber());
    }

    await (await tickets.makeTotalPubliclyDecryptable()).wait().catch(() => undefined);
    // commitDraw already called makeTotalPubliclyDecryptable on TicketEngine

    const ticketsTotal = toHex(await tickets.totalTickets());
    const pub = await instance.publicDecrypt([ticketsTotal]);
    const total = BigInt(String(pub.clearValues[ticketsTotal]));
    // Hardhat FHE plugin is not initialized on Sepolia — skip eth_estimateGas.
    const revealTx = await draw.revealDraw(total, toHex(pub.decryptionProof), { gasLimit: 1_500_000n });
    await revealTx.wait();
    const drawId = await draw.drawId();
    console.log("revealed draw", drawId.toString(), "r=", (await draw.drawRandomValue()).toString());

    const checkStart = Date.now();
    const checkTx = await draw.checkIfWon(drawId, { gasLimit: 5_000_000n });
    const checkReceipt = await checkTx.wait();
    console.log("checkIfWon gasUsed:", checkReceipt?.gasUsed.toString(), "wall ms:", Date.now() - checkStart);

    const prizeClear = await userDecrypt(toHex(await draw.getPendingPrize()), drawAddress);
    console.log("pending prize:", prizeClear.toString());
  } else {
    console.log("Skipping draw cycle (set RUN_DRAW=1 to enable).");
  }

  console.log("SMOKE_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
