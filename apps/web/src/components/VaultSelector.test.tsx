import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VaultSelector } from "@/components/VaultSelector";

const mocks = vi.hoisted(() => ({
  selectVault: vi.fn(),
  cusdcId: "0x6375736463000000000000000000000000000000000000000000000000000000",
  cusdtId: "0x6375736474000000000000000000000000000000000000000000000000000000",
}));

vi.mock("@/components/VaultDirectoryProvider", () => ({
  useVaultDirectory: () => ({
    systems: [
      { id: mocks.cusdcId, label: "cUSDC", active: true },
      { id: mocks.cusdtId, label: "cUSDT", active: true },
    ],
    selected: { id: mocks.cusdcId, label: "cUSDC", active: true },
    selectVault: mocks.selectVault,
    registryConfigured: true,
    isLoading: false,
    isError: false,
  }),
}));

describe("VaultSelector", () => {
  it("presents active curated vaults and changes the selected bundle", async () => {
    const user = userEvent.setup();
    render(<VaultSelector />);

    const selector = screen.getByRole("combobox", { name: "Save with" });
    expect(screen.getAllByRole("option")).toHaveLength(2);
    await user.selectOptions(selector, mocks.cusdtId);
    expect(mocks.selectVault).toHaveBeenCalledWith(mocks.cusdtId);
  });
});
