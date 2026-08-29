import { BaseError, UserRejectedRequestError } from "viem";

export type AppNotice = {
  kind: "cancel" | "err";
  text: string;
};

const REVERT_COPY: Record<string, string> = {
  DrawIntervalNotElapsed: "The draw period is still running.",
  DrawPendingReveal: "A draw is already waiting to settle.",
  DrawAlreadyRevealed: "This draw is already settled.",
  DrawNotCommitted: "No draw is waiting to settle.",
  DrawNotRevealed: "This draw has not settled yet.",
  InvalidRevealBlock: "The reveal block was too close to the chain head. Retry Complete draw.",
  RevealTooEarly: "The reveal block is not in yet.",
  RevealTooLate: "The reveal window closed.",
  ZeroTotalTickets: "The pool has no tickets yet. Deposit before completing the draw.",
  ZeroPrize: "Prize cannot be zero.",
  AlreadyChecked: "You already checked this draw.",
  WrongDrawId: "That draw is not the current one.",
  NotRegistered: "Deposit first to get a ticket slot.",
  NotChecked: "Check this draw before publishing a win.",
  AlreadyWinRevealed: "You already published a win for this draw.",
  NotAWinner: "Only a win can be published.",
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
    if (short.includes("user rejected") || short.includes("user denied")) return true;
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
    if (!value || typeof value !== "object" || seen.has(value)) return undefined;
    seen.add(value);
    const rec = value as Record<string, unknown>;
    const data = rec.data;
    if (data && typeof data === "object") {
      const name = (data as { errorName?: unknown }).errorName;
      if (typeof name === "string" && name) return name;
    }
    if (typeof rec.errorName === "string" && rec.errorName) return rec.errorName;
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
      .find((part) => part && !/^docs:/i.test(part) && !/^version:/i.test(part) && !/^details:/i.test(part)) ??
    message.trim();
  return line.replace(/\s+(Docs|Version|Details):.*$/i, "").trim();
}

const REVERT_SELECTORS: Record<string, string> = {
  "0x09fe84b8": "InvalidRevealBlock",
  "0x433da9de": "DrawIntervalNotElapsed",
  "0x874e0c8a": "DrawPendingReveal",
  "0x88239121": "DrawAlreadyRevealed",
  "0x52c029a4": "DrawNotCommitted",
  "0xc3511f6e": "DrawNotRevealed",
  "0xc349402d": "RevealTooEarly",
  "0x21a0de6c": "RevealTooLate",
  "0xb3343be2": "ZeroTotalTickets",
  "0x7eac88d9": "ZeroPrize",
};

function selectorFromBlob(text: string): string | undefined {
  const match = text.match(/custom error:\s*(0x[0-9a-f]{8})\b/i);
  if (match?.[1]) return match[1].toLowerCase();
  const data = text.match(/\b(0x[0-9a-f]{8})[0-9a-f]*\b/i);
  if (data?.[1] && REVERT_SELECTORS[data[1].toLowerCase()]) return data[1].toLowerCase();
  return undefined;
}

function namedRevert(err: unknown): string | undefined {
  const fromAbi = revertErrorName(err);
  if (fromAbi && REVERT_COPY[fromAbi]) return fromAbi;
  const selector = selectorFromBlob(fullText(err));
  if (selector && REVERT_SELECTORS[selector]) return REVERT_SELECTORS[selector];
  return fromAbi;
}

function isEmptyRevertLine(line: string): boolean {
  return /reverted with the following reason:\s*$/i.test(line);
}

export function decodedRevertNotice(err: unknown): AppNotice | null {
  const revertName = namedRevert(err);
  if (revertName && REVERT_COPY[revertName]) {
    return { kind: "err", text: REVERT_COPY[revertName] };
  }
  return null;
}

export function noticeFromWalletError(err: unknown, fallback = "Something went wrong"): AppNotice {
  if (isUserRejected(err)) {
    return { kind: "cancel", text: "Transaction cancelled." };
  }

  const blob = fullText(err).toLowerCase();
  if (blob.includes("insufficient funds") || blob.includes("insufficient balance")) {
    return { kind: "err", text: "Not enough Sepolia ETH to cover gas." };
  }

  const revertName = namedRevert(err);
  if (revertName && REVERT_COPY[revertName]) {
    return { kind: "err", text: REVERT_COPY[revertName] };
  }

  if (err instanceof BaseError && err.shortMessage) {
    const line = firstUsefulLine(err.shortMessage);
    if (isEmptyRevertLine(line)) {
      return { kind: "err", text: revertName ? `Reverted: ${revertName}` : "The transaction reverted." };
    }
    return { kind: "err", text: line };
  }

  if (err instanceof Error && err.message) {
    return { kind: "err", text: firstUsefulLine(err.message) || fallback };
  }

  return { kind: "err", text: fallback };
}
