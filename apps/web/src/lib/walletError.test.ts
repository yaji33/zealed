import { describe, expect, it } from "vitest";
import { noticeFromWalletError } from "@/lib/walletError";

describe("noticeFromWalletError", () => {
  it("maps wallet rejection to quiet copy", () => {
    expect(noticeFromWalletError({ code: 4001 })).toEqual({
      kind: "cancel",
      text: "Transaction cancelled.",
    });
  });

  it("does not expose verbose library metadata", () => {
    const notice = noticeFromWalletError(
      new Error("RPC unavailable\nDocs: https://example.invalid\nVersion: 1.2.3"),
      "Wallet request failed.",
    );
    expect(notice).toEqual({ kind: "err", text: "Wallet request failed." });
  });

  it("maps insufficient gas without exposing raw RPC text", () => {
    expect(noticeFromWalletError(new Error("insufficient funds for gas * price"))).toEqual({
      kind: "err",
      text: "Not enough Sepolia ETH to cover gas.",
    });
  });
});
