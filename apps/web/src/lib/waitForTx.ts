import type { Hex, PublicClient } from "viem";

export async function waitForOkTx(
  client: PublicClient,
  hash: Hex,
  replay?: () => Promise<unknown>,
): Promise<void> {
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status === "success") return;
  if (replay) await replay();
  throw new Error("The transaction reverted.");
}
