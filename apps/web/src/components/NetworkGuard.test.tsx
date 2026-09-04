import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NetworkGuard } from "@/components/NetworkGuard";

const switchChain = vi.fn();
const wagmiState = {
  chainId: 1,
  isConnected: true,
  isPending: false,
  error: null as Error | null,
};

vi.mock("wagmi", () => ({
  useAccount: () => ({ chainId: wagmiState.chainId, isConnected: wagmiState.isConnected }),
  useSwitchChain: () => ({
    switchChain,
    isPending: wagmiState.isPending,
    error: wagmiState.error,
  }),
}));

describe("NetworkGuard", () => {
  beforeEach(() => {
    switchChain.mockClear();
    wagmiState.chainId = 1;
    wagmiState.isConnected = true;
  });

  it("blocks transaction controls on the wrong network", async () => {
    render(
      <NetworkGuard>
        <button type="button">Deposit</button>
      </NetworkGuard>,
    );

    expect(screen.queryByRole("button", { name: "Deposit" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Switch network" }));
    expect(switchChain).toHaveBeenCalledWith({ chainId: 11_155_111 });
  });

  it("renders children when disconnected", () => {
    wagmiState.isConnected = false;
    render(
      <NetworkGuard>
        <p>Public content</p>
      </NetworkGuard>,
    );
    expect(screen.getByText("Public content")).toBeVisible();
  });
});
