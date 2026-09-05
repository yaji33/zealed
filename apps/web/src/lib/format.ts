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

/** Encrypted amounts are euint64; 100 whole 18-decimal units overflow that range. */
const EUINT64_MAX = 2n ** 64n - 1n;

/** Faucet mint/wrap default in human tokens. Cap 18-decimal underlyings. */
export function defaultFaucetAmount(underlyingDecimals: number): string {
  return underlyingDecimals > 6 ? "0.01" : "100";
}

/** Deposit field default. Matches a safe faucet mint on 18-decimal underlyings. */
export function defaultDepositAmount(underlyingDecimals: number): string {
  return underlyingDecimals > 6 ? "0.01" : "1";
}

export function isWithinEuint64(value: bigint): boolean {
  return value >= 0n && value <= EUINT64_MAX;
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

export function formatCompactAmount(value: bigint, decimals = 6): string {
  const n = Number(formatUnits(value, decimals));
  if (!Number.isFinite(n)) return formatUnits(value, decimals);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 100_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function formatTimestamp(seconds: number): string {
  if (!seconds) return "—";
  return new Date(seconds * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** HH:MM:SS for draw-cycle timers. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (v: number) => v.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}
