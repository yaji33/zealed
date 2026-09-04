import { ethers } from "hardhat";
import { selectedVaultSystem } from "./lib/registrySystems";

const RPC =
  process.env.SEPOLIA_RPC_URL ??
  (process.env.INFURA_API_KEY
    ? `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`
    : "https://ethereum-sepolia-rpc.publicnode.com");
const OPERATOR_UNTIL = 2n ** 48n - 1n;
const ZERO_HANDLE = `0x${"0".repeat(64)}`;

function toHex(value: Uint8Array | string): `0x${string}` {
  const hex = typeof value === "string" ? (value.startsWith("0x") ? value : `0x${value}`) : ethers.hexlify(value);
  return hex as `0x${string}`;
}

async function main() {
  const sdk = await import("@zama-fhe/relayer-sdk/node");
  const [signer] = await ethers.getSigners();
  const rpcFromHH = (ethers.provider as unknown as { _getConnection?: () => { url?: string } })._getConnection?.()?.url;
  const instance = await sdk.createInstance({ ...sdk.SepoliaConfig, network: rpcFromHH || RPC });
  const system = await selectedVaultSystem();
  const vaultAddress = system.vault;
  const assetAddress = system.asset;

  const vault = await ethers.getContractAt("ConfidentialVault", vaultAddress, signer);
  const asset = await ethers.getContractAt(
    [
      "function underlying() view returns (address)",
      "function rate() view returns (uint256)",
      "function wrap(address to,uint256 amount) external",
      "function setOperator(address operator,uint48 until) external",
    ],
    assetAddress,
    signer,
  );
  const underlyingAddress = await asset.underlying();
  const underlying = await ethers.getContractAt(
    [
      "function mint(address to,uint256 amount) external",
      "function approve(address spender,uint256 amount) external returns (bool)",
    ],
    underlyingAddress,
    signer,
  );

  const depositAmount = 1_000_000n;
  const withdrawAmount = 250_000n;
  const underlyingAmount = depositAmount * BigInt(await asset.rate());
  await (await underlying.mint(signer.address, underlyingAmount)).wait();
  await (await underlying.approve(assetAddress, underlyingAmount)).wait();
  await (await asset.wrap(signer.address, underlyingAmount)).wait();
  await (await asset.setOperator(vaultAddress, OPERATOR_UNTIL)).wait();

  const encrypt = async (amount: bigint) => {
    const input = instance.createEncryptedInput(vaultAddress, signer.address);
    input.add64(amount);
    const encrypted = await input.encrypt();
    return { handle: toHex(encrypted.handles[0]), proof: toHex(encrypted.inputProof) };
  };

  const beforeHandle = toHex(await vault.getBalance());
  const deposit = await encrypt(depositAmount);
  await (await vault.deposit(deposit.handle, deposit.proof, { gasLimit: 5_000_000n })).wait();
  const afterDepositHandle = toHex(await vault.getBalance());
  const withdraw = await encrypt(withdrawAmount);
  await (await vault.withdraw(withdraw.handle, withdraw.proof, { gasLimit: 5_000_000n })).wait();
  const afterWithdrawHandle = toHex(await vault.getBalance());

  const keypair = instance.generateKeypair();
  const startTimestamp = Math.floor(Date.now() / 1000);
  const durationDays = 1;
  const eip712 = instance.createEIP712(keypair.publicKey, [vaultAddress], startTimestamp, durationDays);
  const { EIP712Domain: _ignored, ...types } = eip712.types as Record<string, unknown>;
  void _ignored;
  const signature = await signer.signTypedData(
    eip712.domain,
    types as Record<string, { name: string; type: string }[]>,
    eip712.message,
  );
  const decryptHandles = [beforeHandle, afterDepositHandle, afterWithdrawHandle].filter(
    (handle) => handle !== ZERO_HANDLE,
  );
  const values = await instance.userDecrypt(
    decryptHandles.map((handle) => ({
      handle,
      contractAddress: vaultAddress,
    })),
    keypair.privateKey,
    keypair.publicKey,
    signature.replace(/^0x/, ""),
    [vaultAddress],
    signer.address,
    startTimestamp,
    durationDays,
  );

  const before = beforeHandle === ZERO_HANDLE ? 0n : BigInt(String(values[beforeHandle] ?? 0));
  const afterDeposit = BigInt(String(values[afterDepositHandle] ?? 0));
  const afterWithdraw = BigInt(String(values[afterWithdrawHandle] ?? 0));
  if (afterDeposit - before !== depositAmount || afterDeposit - afterWithdraw !== withdrawAmount) {
    throw new Error("Encrypted vault balance invariant failed");
  }
  console.log(`SMOKE_VAULT_OK ${system.id}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.split("\n")[0]);
  process.exit(1);
});
