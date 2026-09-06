/** Official Sepolia mocks report 6 confidential decimals. */
export const CONFIDENTIAL_DECIMALS = 6;

/** Fallback per-draw budget: 20 tokens. The next award spends the entire synchronized pot. */
export const FALLBACK_DRAW_BUDGET_UNITS = 20_000_000n;

/**
 * Per-vault per-draw budgets. Live tier shares are immutable (5000/3000/1500 + 500 reserve),
 * so smaller prizes mean a smaller pot, not new shares. cWETH stays in ETH-scale units.
 */
export const DEFAULT_DRAW_BUDGET_UNITS: Record<string, bigint> = {
  cusdc: 20_000_000n,
  cusdt: 20_000_000n,
  cweth: 20_000n,
  czama: 20_000_000n,
  cxaut: 20_000_000n,
  cbron: 20_000_000n,
};

/** Refuse accidental lumps unless FORCE_PRIZE_LUMP=1. 100 tokens is the old one-shot default. */
export const MAX_UNFORCED_FUNDING_UNITS = 100_000_000n;

export type PrizeFundingEnv = {
  PRIZE_FUNDING_UNITS?: string;
  PRIZE_DRAW_BUDGET_UNITS?: string;
  FORCE_PRIZE_LUMP?: string;
};

export function parsePositiveUnits(raw: string): bigint {
  const value = BigInt(raw);
  if (value <= 0n || value > 2n ** 64n - 1n) {
    throw new Error("Invalid prize funding units.");
  }
  return value;
}

export function defaultDrawBudget(vaultId: string): bigint {
  return DEFAULT_DRAW_BUDGET_UNITS[vaultId] ?? FALLBACK_DRAW_BUDGET_UNITS;
}

/** Keeper drip size. Ignores PRIZE_FUNDING_UNITS so a leftover 10k lump env cannot refill every draw. */
export function drawBudgetForVault(vaultId: string, env: PrizeFundingEnv = process.env): bigint {
  const raw = env.PRIZE_DRAW_BUDGET_UNITS?.trim();
  if (raw) return parsePositiveUnits(raw);
  return defaultDrawBudget(vaultId);
}

export function fundingUnitsForVault(vaultId: string, env: PrizeFundingEnv = process.env): bigint {
  const raw = env.PRIZE_FUNDING_UNITS?.trim();
  if (raw) return parsePositiveUnits(raw);
  return defaultDrawBudget(vaultId);
}

export function assertFundingNotALump(fundingUnits: bigint, env: PrizeFundingEnv = process.env): void {
  if (fundingUnits <= MAX_UNFORCED_FUNDING_UNITS || env.FORCE_PRIZE_LUMP === "1") return;
  throw new Error(
    `Refusing ${fundingUnits} units. allocateDraw spends the entire synchronized pot on the next award, ` +
      `so a lump cannot sustain two weeks. Use the per-draw default or set FORCE_PRIZE_LUMP=1.`,
  );
}

export type TierPayoutPreview = {
  reserveAdded: bigint;
  perSlot: [bigint, bigint, bigint];
};

/** Mirrors PrizePool.allocateDraw integer division. */
export function previewAllocateDraw(
  available: bigint,
  shares: readonly [bigint, bigint, bigint],
  slots: readonly [bigint, bigint, bigint],
  reserveShares: bigint,
): TierPayoutPreview {
  let totalShares = reserveShares;
  for (const share of shares) totalShares += share;
  if (totalShares === 0n) {
    return { reserveAdded: 0n, perSlot: [0n, 0n, 0n] };
  }
  const reserveAdded = (available * reserveShares) / totalShares;
  const perSlot: [bigint, bigint, bigint] = [0n, 0n, 0n];
  for (let index = 0; index < 3; index += 1) {
    const tierLiquidity = (available * shares[index]) / totalShares;
    perSlot[index] = slots[index] === 0n ? 0n : tierLiquidity / slots[index];
  }
  return { reserveAdded, perSlot };
}

export function formatConfidentialTokens(units: bigint): string {
  const base = 10n ** BigInt(CONFIDENTIAL_DECIMALS);
  const whole = units / base;
  const frac = units % base;
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(CONFIDENTIAL_DECIMALS, "0").replace(/0+$/, "")}`;
}

export function activeDrawFundingError(
  vaultId: string,
  drawId: bigint,
  claimDeadline: bigint,
  suggestedUnits: bigint,
): string {
  return (
    `[${vaultId}] draw ${drawId} is still active (claim deadline unix ${claimDeadline}). ` +
    `PrizePool.prepareLiquidity reverts ActiveDraw. Wait for the keeper to finalize rollover, ` +
    `then fund a small per-draw budget (PRIZE_FUNDING_UNITS=${suggestedUnits}), not a lump. ` +
    `The entire funded amount is allocated on the next award.`
  );
}
