import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("landing exposes the product and app entry point", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /save.*win/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /launch app/i }).first()).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const blocking = accessibility.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
  expect(blocking).toEqual([]);
});

test("disconnected dashboard keeps public vaults and onboarding visible", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: /save\. win privately/i })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("columnheader", { name: "Principal TVL" })).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Available prize liquidity" }),
  ).toBeVisible();
  await expect(page.getByText("Prize cUSDC").first()).toBeVisible();
  await expect(page.getByText("Prize cUSDT").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Connect/i }).first()).toBeVisible();
  await page.getByRole("link", { name: "Prize cUSDC" }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/cusdc/, { timeout: 15_000 });
  await expect(
    page.getByRole("heading", { name: /Mint test cUSDC, then save/i }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /Public pool accounting/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open cUSDC faucet/i })).toBeVisible();
  const vaultSelect = page.getByRole("combobox", { name: "Save with" });
  await expect(vaultSelect).toBeVisible();
  await vaultSelect.click();
  const usdtOption = page.getByRole("option", { name: "cUSDT" });
  await expect(usdtOption).toBeVisible();
  const triggerBox = await vaultSelect.boundingBox();
  const menuBox = await usdtOption.boundingBox();
  expect(triggerBox && menuBox).toBeTruthy();
  if (triggerBox && menuBox) {
    expect(menuBox.y).toBeGreaterThan(triggerBox.y + triggerBox.height);
  }
});

test("faucet route redirects into the dashboard flow", async ({ page }) => {
  await page.goto("/faucet", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/dashboard\/faucet$/);
});
