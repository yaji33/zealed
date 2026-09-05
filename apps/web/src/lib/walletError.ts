import { BaseError, UserRejectedRequestError } from "viem";

export type AppNotice = {
  kind: "cancel" | "err";
  text: string;
};

const REVERT_COPY: Record<string, string> = {
  DrawIntervalNotElapsed: "The draw period is still running.",
  DrawNotClosed: "Close the draw before awarding it.",
  DrawAlreadyAwarded: "This draw is already awarded.",
  DrawNotAwarded: "This draw has not been awarded yet.",
  DrawExpired: "The claim window for this draw has ended.",
  DrawNotExpired: "The claim window is still open.",
  DrawNotReconciled: "Finish reconciling the previous draw first.",
  ZeroTotalScore: "No eligibility accrued in this period.",
  InvalidDraw: "That draw id is invalid.",
  InvalidTier: "That prize tier is not configured.",
  InvalidSlot: "That prize slot is not configured.",
  NotRegistered: "Deposit first to get a ticket slot.",
  AlreadyChecked: "You already checked this prize slot.",
  NotChecked: "Check this prize slot before claiming or revealing.",
  AlreadyClaimed: "You already claimed this prize slot.",
  AlreadyRevealed: "You already published a win for this slot.",
  RevealNotPrepared: "Prepare the win reveal before publishing it.",
  NotAWinner: "Only a win can be published.",
  ReconciliationNotPrepared: "Prepare reconciliation before finalizing it.",
  InsufficientPrizeLiquidity: "PrizePool needs more sponsor-funded liquidity.",
  ActiveDraw: "A draw is already using the prize pool.",
  NoActiveDraw: "There is no active prize allocation.",
  ClaimWindowOpen: "Wait until the claim window ends.",
  VaultMismatch: "TicketEngine is not wired to this vault.",
  AssetMismatch: "PrizePool and vault must share the same asset.",
};

function errorCode(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  if ("code" in err && typeof (err as { code: unknown }).code === "number") {
    return (err as { code: number }).code;
  }
  if ("cause" in err) return errorCode((err as { cause: unknown }).cause);
  return undefined;
}

function isUserRejected(err: unknown): boolean {
  if (err instanceof UserRejectedRequestError) return true;
  const code = errorCode(err);
  if (code === UserRejectedRequestError.code || code === 4001) return true;
  if (err instanceof BaseError) {
    const rejected = err.walk((e) => e instanceof UserRejectedRequestError);
    if (rejected) return true;
    const short = err.shortMessage.toLowerCase();
    if (short.includes("user rejected") || short.includes("user denied"))
      return true;
  }
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("user rejected") ||
    msg.includes("user denied") ||
    msg.includes("rejected the request")
  );
}

function fullText(err: unknown): string {
  if (err instanceof BaseError) return `${err.shortMessage}\n${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}

function revertErrorName(err: unknown): string | undefined {
  const seen = new Set<unknown>();
  const fromData = (value: unknown): string | undefined => {
    if (!value || typeof value !== "object" || seen.has(value))
      return undefined;
    seen.add(value);
    const rec = value as Record<string, unknown>;
    const data = rec.data;
    if (data && typeof data === "object") {
      const name = (data as { errorName?: unknown }).errorName;
      if (typeof name === "string" && name) return name;
    }
    if (typeof rec.errorName === "string" && rec.errorName)
      return rec.errorName;
    if ("cause" in rec) return fromData(rec.cause);
    return undefined;
  };

  if (err instanceof BaseError) {
    let found: string | undefined;
    err.walk((e) => {
      found = found ?? fromData(e);
      return false;
    });
    if (found) return found;
  }
  return fromData(err);
}

function firstUsefulLine(message: string): string {
  const line =
    message
      .split("\n")
      .map((part) => part.trim())
      .find(
        (part) =>
          part &&
          !/^docs:/i.test(part) &&
          !/^version:/i.test(part) &&
          !/^details:/i.test(part),
      ) ?? message.trim();
  return line.replace(/\s+(Docs|Version|Details):.*$/i, "").trim();
}

function isEmptyRevertLine(line: string): boolean {
  return /reverted with the following reason:\s*$/i.test(line);
}

function isEthGasShortage(blob: string): boolean {
  return (
    blob.includes("insufficient funds for gas") ||
    blob.includes("gas * price") ||
    blob.includes("intrinsic gas") ||
    blob.includes("maxfeepergas") ||
    (blob.includes("insufficient funds") && blob.includes("gas")) ||
    (blob.includes("insufficient funds") &&
      !blob.includes("token") &&
      !blob.includes("erc20") &&
      !blob.includes("transfer") &&
      !blob.includes("allowance"))
  );
}

function isTokenBalanceShortage(blob: string): boolean {
  return (
    blob.includes("transfer amount exceeds") ||
    blob.includes("erc20insufficientbalance") ||
    blob.includes("insufficient token") ||
    (blob.includes("insufficient balance") && !blob.includes("gas"))
  );
}

function isApprovalOrOperatorShortage(
  blob: string,
  revertName: string | undefined,
): boolean {
  if (
    revertName === "ERC20InsufficientAllowance" ||
    revertName === "UnauthorizedOperator"
  ) {
    return true;
  }
  return (
    blob.includes("insufficient allowance") ||
    blob.includes("erc20insufficientallowance") ||
    blob.includes("unauthorizedoperator") ||
    blob.includes("not an operator") ||
    blob.includes("not operator")
  );
}

function namedRevert(err: unknown): string | undefined {
  const fromAbi = revertErrorName(err);
  if (fromAbi && REVERT_COPY[fromAbi]) return fromAbi;
  return fromAbi;
}

export function decodedRevertNotice(err: unknown): AppNotice | null {
  const revertName = namedRevert(err);
  if (revertName && REVERT_COPY[revertName]) {
    return { kind: "err", text: REVERT_COPY[revertName] };
  }
  return null;
}

export function noticeFromWalletError(
  err: unknown,
  fallback = "Something went wrong",
): AppNotice {
  if (isUserRejected(err)) {
    return { kind: "cancel", text: "Transaction cancelled." };
  }

  const blob = fullText(err).toLowerCase();
  if (isApprovalOrOperatorShortage(blob, namedRevert(err))) {
    return {
      kind: "err",
      text: "Approve the token or grant operator permission first.",
    };
  }
  if (isTokenBalanceShortage(blob)) {
    return {
      kind: "err",
      text: "Not enough token balance for this amount.",
    };
  }
  if (isEthGasShortage(blob)) {
    return { kind: "err", text: "Not enough Sepolia ETH to cover gas." };
  }

  const revertName = namedRevert(err);
  if (revertName && REVERT_COPY[revertName]) {
    return { kind: "err", text: REVERT_COPY[revertName] };
  }

  if (err instanceof BaseError && err.shortMessage) {
    const line = firstUsefulLine(err.shortMessage);
    if (isEmptyRevertLine(line)) {
      return {
        kind: "err",
        text: revertName
          ? `Reverted: ${revertName}`
          : "The transaction reverted.",
      };
    }
    return { kind: "err", text: line };
  }

  return { kind: "err", text: fallback };
}
