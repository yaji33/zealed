import type { Address, Hex, PublicClient } from "viem";
import { vaultAbi } from "@/lib/abi/zealed";
import { isZeroHandle, readClearValue } from "@/lib/publicDecrypt";
import { getFhevmInstance } from "@/lib/relayerSdk";

export async function readPublicVaultTvl(
  client: PublicClient,
  vault: Address,
): Promise<bigint> {
  const handle = (await client.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: "totalDeposits",
  })) as Hex;

  if (isZeroHandle(handle)) return 0n;

  const instance = await getFhevmInstance();
  const result = await instance.publicDecrypt([handle]);
  const value = readClearValue(
    result.clearValues as Record<string, unknown>,
    handle,
  );
  if (value === undefined) {
    throw new Error("Unexpected publicDecrypt result for vault TVL");
  }
  return value;
}
