import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VaultsDirectory } from "@/components/VaultsDirectory";

const mocks = vi.hoisted(() => ({
  selectVault: vi.fn(),
  push: vi.fn(),
  isConnected: false,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ isConnected: mocks.isConnected }),
}));

vi.mock("@/hooks/useConnectWallet", () => ({
  useConnectWallet: () => ({
    connectWallet: vi.fn(),
    canConnect: true,
    isPending: false,
    error: null,
  }),
}));

vi.mock("@/components/VaultDirectoryProvider", () => ({
  useVaultDirectory: () => ({
    selectVault: mocks.selectVault,
    isError: false,
    registryConfigured: true,
  }),
}));

vi.mock("@/hooks/useVaultMarketData", () => ({
  useVaultMarketData: () => ({
    isLoading: false,
    isError: false,
    rows: [
      {
        system: {
          id: "0x6375736463000000000000000000000000000000000000000000000000000000",
          slug: "cusdc",
          label: "cUSDC",
          asset: "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639",
          active: true,
        },
        principalTvl: 1_500_000_000n,
        availablePrizeLiquidity: 45_000_000n,
        decimals: 6,
      },
      {
        system: {
          id: "0x6375736474000000000000000000000000000000000000000000000000000000",
          slug: "cusdt",
          label: "cUSDT",
          asset: "0x4E7B06D78965594eB5EF5414c357ca21E1554491",
          active: true,
        },
        principalTvl: 800_000_000n,
        availablePrizeLiquidity: 12_000_000n,
        decimals: 6,
      },
    ],
  }),
}));

describe("VaultsDirectory", () => {
  beforeEach(() => {
    mocks.selectVault.mockClear();
    mocks.push.mockClear();
    mocks.isConnected = false;
  });

  it("lists isolated vaults without a combined pool size column", async () => {
    const user = userEvent.setup();
    render(<VaultsDirectory />);

    expect(screen.getByRole("columnheader", { name: "Principal TVL" })).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "Available prize liquidity" }),
    ).toBeVisible();
    expect(screen.queryByRole("columnheader", { name: /pool size|saved/i })).not.toBeInTheDocument();
    expect(screen.getAllByText("Prize cUSDC").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Prize cUSDT").length).toBeGreaterThan(0);
    expect(screen.getAllByText("cUSDCMock").length).toBeGreaterThan(0);
    expect(screen.getAllByText("cUSDTMock").length).toBeGreaterThan(0);
    expect(screen.queryByText("START HERE")).not.toBeInTheDocument();

    const usdtLinks = screen.getAllByRole("link", { name: "Prize cUSDT" });
    expect(usdtLinks[0]).toHaveAttribute("href", "/dashboard/cusdt");
    await user.click(usdtLinks[0]);
    expect(mocks.selectVault).toHaveBeenCalled();
  });

  it("keeps connected positions sealed in the directory", () => {
    mocks.isConnected = true;
    render(<VaultsDirectory />);
    expect(screen.getByRole("columnheader", { name: "You" })).toBeVisible();
    expect(screen.getAllByText("••••").length).toBeGreaterThan(0);
  });

  it("shows an empty state when search matches no vaults", async () => {
    const user = userEvent.setup();
    render(<VaultsDirectory />);
    await user.type(screen.getByRole("textbox", { name: /search vaults/i }), "no-such-vault");
    expect(
      screen.getByRole("heading", { name: /no vaults match that search/i }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: /clear search/i }));
    expect(screen.getAllByText("Prize cUSDC").length).toBeGreaterThan(0);
  });
});
