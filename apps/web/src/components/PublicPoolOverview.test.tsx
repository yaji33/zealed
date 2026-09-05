import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PublicPoolOverview } from "@/components/PublicPoolOverview";

vi.mock("@/components/VaultDirectoryProvider", () => ({
  useVaultDirectory: () => ({
    selected: {
      label: "cUSDC",
      asset: "0x0000000000000000000000000000000000000001",
    },
  }),
}));

vi.mock("@/lib/addresses", () => ({
  addresses: { asset: "0x0000000000000000000000000000000000000001" },
}));

vi.mock("@/hooks/useVaultTvl", () => ({
  useVaultTvl: () => ({ data: 340_000_000n, isLoading: false }),
}));

vi.mock("@/hooks/usePrizePoolData", () => ({
  usePrizePoolData: () => ({
    configured: true,
    isLoading: false,
    isError: false,
    data: {
      availableLiquidity: 12_000_000n,
      reserveLiquidity: 3_000_000n,
      activeDrawId: 4n,
      activeClaimDeadline: 0n,
      tiers: [
        {
          id: 0,
          name: "Grand",
          slots: 1,
          share: 5_000n,
          prizePerSlot: 5_000_000n,
          allocation: 5_000_000n,
        },
        {
          id: 1,
          name: "Standard",
          slots: 2,
          share: 3_000n,
          prizePerSlot: 1_500_000n,
          allocation: 3_000_000n,
        },
        {
          id: 2,
          name: "Community",
          slots: 4,
          share: 1_500n,
          prizePerSlot: 375_000n,
          allocation: 1_500_000n,
        },
      ],
    },
  }),
}));

describe("PublicPoolOverview", () => {
  it("keeps principal, available prizes, reserve, and tiers separately labelled", () => {
    render(<PublicPoolOverview />);
    expect(
      screen.getByRole("heading", { name: "Principal TVL" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Available prize liquidity" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Reserve" })).toBeVisible();
    expect(screen.getByText(/Grand · 1 slot/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Open cUSDC faucet" })).toHaveAttribute(
      "href",
      "/dashboard/faucet",
    );
    expect(screen.queryByText("START HERE")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Mint test cUSDC, then save/i })).toBeVisible();
  });
});
