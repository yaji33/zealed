import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VaultSelector } from "@/components/VaultSelector";

const mocks = vi.hoisted(() => ({
  selectVault: vi.fn(),
  push: vi.fn(),
  pathname: "/dashboard/cusdc",
  cusdcId: "0x6375736463000000000000000000000000000000000000000000000000000000",
  cusdtId: "0x6375736474000000000000000000000000000000000000000000000000000000",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => mocks.pathname,
}));

vi.mock("@/components/VaultDirectoryProvider", () => ({
  useVaultDirectory: () => ({
    systems: [
      { id: mocks.cusdcId, slug: "cusdc", label: "cUSDC", asset: "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639", active: true },
      { id: mocks.cusdtId, slug: "cusdt", label: "cUSDT", asset: "0x4E7B06D78965594eB5EF5414c357ca21E1554491", active: true },
    ],
    selected: {
      id: mocks.cusdcId,
      slug: "cusdc",
      label: "cUSDC",
      asset: "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639",
      active: true,
    },
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
    await user.click(selector);
    await user.click(await screen.findByRole("option", { name: "cUSDT" }));
    expect(mocks.selectVault).toHaveBeenCalledWith(mocks.cusdtId);
    expect(mocks.push).toHaveBeenCalledWith("/dashboard/cusdt");
  });
});
