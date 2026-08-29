import type { Hex } from "viem";

export function isZeroHandle(handle: Hex | string | undefined): boolean {
  return !handle || /^0x0+$/i.test(handle);
}

export function cleartextToBigint(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") return BigInt(value);
  throw new Error("Unexpected publicDecrypt result");
}

export function readClearValue(clearValues: Record<string, unknown>, handle: Hex): bigint | undefined {
  const value =
    clearValues[handle] ??
    clearValues[handle.toLowerCase()] ??
    clearValues[handle.toUpperCase()];
  if (value === undefined) return undefined;
  return cleartextToBigint(value);
}
