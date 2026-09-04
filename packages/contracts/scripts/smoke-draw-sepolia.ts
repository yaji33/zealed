import { ethers } from "hardhat";
import { selectedVaultSystem } from "./lib/registrySystems";

const RPC =
  process.env.SEPOLIA_RPC_URL ??
  (process.env.INFURA_API_KEY
    ? `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`
    : "https://ethereum-sepolia-rpc.publicnode.com");
const OPERATOR_UNTIL = 2n ** 48n - 1n;

function toHex(value: Uint8Array | string): `0x${string}` {
  const hex = typeof value === "string" ? (value.startsWith("0x") ? value : `0x${value}`) : ethers.hexlify(value);
  return hex as `0x${string}`;
}

function bufferedGas(estimate: bigint): bigint {
  return (estimate * 125n) / 100n;
}

async function main() {
  const sdk = await import("@zama-fhe/relayer-sdk/node");
  const [signer] = await ethers.getSigners();
  const rpcFromHH = (ethers.provider as unknown as { _getConnection?: () => { url?: string } })._getConnection?.()?.url;
  const instance = await sdk.createInstance({ ...sdk.SepoliaConfig, network: rpcFromHH || RPC });
  const system = await selectedVaultSystem();
  const poolAddress = system.prizePool;

  const draw = await ethers.getContractAt("DrawManager", system.drawManager, signer);
  const tickets = await ethers.getContractAt("TicketEngine", system.ticketEngine, signer);
  const pool = await ethers.getContractAt("PrizePool", poolAddress, signer);
  const asset = await ethers.getContractAt(
    ["function setOperator(address operator, uint48 until) external"],
    system.asset,
    signer,
  );

  if ((await tickets.indexOf(signer.address)) === 0n) {
    throw new Error("The smoke wallet must deposit before running the draw smoke");
  }

  let id = await draw.drawId();
  let state = id === 0n ? undefined : await draw.draws(id);
  if (!state?.awarded) {
    await (await asset.setOperator(poolAddress, OPERATOR_UNTIL, { gasLimit: 300_000n })).wait();
    if (!state?.closed) {
      await (await pool.prepareLiquidity({ gasLimit: 500_000n })).wait();
      const liquidityHandle = toHex(await pool.liquidityBalanceHandle());
      const liquidityResult = await instance.publicDecrypt([liquidityHandle]);
      const clearLiquidity = BigInt(String(liquidityResult.clearValues[liquidityHandle] ?? 0));
      if (clearLiquidity === 0n) throw new Error(`Prize pool for '${system.id}' must be funded before draw smoke.`);
      await (
        await pool.finalizeLiquidity(clearLiquidity, toHex(liquidityResult.decryptionProof), { gasLimit: 500_000n })
      ).wait();
      const closeGas = bufferedGas(await draw.closeDraw.estimateGas());
      await (await draw.closeDraw({ gasLimit: closeGas })).wait();
      id = await draw.drawId();
    }
    const scoreHandle = toHex(await tickets.preparedTotal());
    const scoreResult = await instance.publicDecrypt([scoreHandle]);
    const score = BigInt(String(scoreResult.clearValues[scoreHandle] ?? 0));
    const proof = toHex(scoreResult.decryptionProof);
    const awardGas = bufferedGas(await draw.awardDraw.estimateGas(id, score, proof));
    await (await draw.awardDraw(id, score, proof, { gasLimit: awardGas })).wait();
  }

  if (!(await draw.hasChecked(id, 0, 0, signer.address))) {
    const checkGas = bufferedGas(await draw.checkPrize.estimateGas(id, 0, 0));
    await (await draw.checkPrize(id, 0, 0, { gasLimit: checkGas })).wait();
  }
  const pendingHandle = toHex(await draw.getPendingPrize(id, 0, 0));
  const ZERO_HANDLE = `0x${"0".repeat(64)}`;
  if (pendingHandle !== ZERO_HANDLE) {
    const keypair = instance.generateKeypair();
    const startTimestamp = Math.floor(Date.now() / 1000);
    const durationDays = 1;
    const eip712 = instance.createEIP712(keypair.publicKey, [system.drawManager], startTimestamp, durationDays);
    const { EIP712Domain: _ignored, ...types } = eip712.types as Record<string, unknown>;
    void _ignored;
    const signature = await signer.signTypedData(
      eip712.domain,
      types as Record<string, { name: string; type: string }[]>,
      eip712.message,
    );
    await instance.userDecrypt(
      [{ handle: pendingHandle, contractAddress: system.drawManager }],
      keypair.privateKey,
      keypair.publicKey,
      signature.replace(/^0x/, ""),
      [system.drawManager],
      signer.address,
      startTimestamp,
      durationDays,
    );
  }
  if (!(await draw.hasClaimed(id, 0, 0, signer.address))) {
    const claimGas = bufferedGas(await draw.claim.estimateGas(id, 0, 0));
    await (await draw.claim(id, 0, 0, { gasLimit: claimGas })).wait();
  }
  console.log(`SMOKE_DRAW_OK ${system.id}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
