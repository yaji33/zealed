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

  it("maps token underbalance separately from Sepolia ETH gas", () => {
    expect(
      noticeFromWalletError(new Error("ERC20: transfer amount exceeds balance")),
    ).toEqual({
      kind: "err",
      text: "Not enough token balance for this amount.",
    });
    expect(
      noticeFromWalletError(new Error("insufficient balance for transfer")),
    ).toEqual({
      kind: "err",
      text: "Not enough token balance for this amount.",
    });
  });

  it("maps missing ERC-20 allowance and ERC-7984 operator permission", () => {
    expect(
      noticeFromWalletError(new Error("ERC20: insufficient allowance")),
    ).toEqual({
      kind: "err",
      text: "Approve the token or grant operator permission first.",
    });
    expect(
      noticeFromWalletError(new Error("UnauthorizedOperator")),
    ).toEqual({
      kind: "err",
      text: "Approve the token or grant operator permission first.",
    });
  });
});
