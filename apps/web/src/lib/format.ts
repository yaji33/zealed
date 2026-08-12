export function formatUnits(value: bigint, decimals = 6): string {
  const neg = value < 0n;
  const v = neg ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  const frac = v % base;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  const body = fracStr.length > 0 ? `${whole.toString()}.${fracStr}` : whole.toString();
  return neg ? `-${body}` : body;
}

export function parseUnits(input: string, decimals = 6): bigint {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Enter an amount");
  const [wholePart, fracPart = ""] = trimmed.split(".");
  if (!/^\d+$/.test(wholePart) || (fracPart && !/^\d+$/.test(fracPart))) {
    throw new Error("Invalid amount");
  }
  if (fracPart.length > decimals) throw new Error("Too many decimal places");
  const frac = fracPart.padEnd(decimals, "0");
  return BigInt(wholePart) * 10n ** BigInt(decimals) + BigInt(frac || "0");
}

export function formatTimestamp(seconds: number): string {
  if (!seconds) return "—";
  return new Date(seconds * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
