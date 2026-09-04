import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("landing exposes the product and app entry point", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /save together/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /launch app/i }).first()).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const blocking = accessibility.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
  expect(blocking).toEqual([]);
});

test("disconnected dashboard keeps public pool data and onboarding visible", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await expect(page.getByRole("combobox", { name: /Save with/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("option", { name: "cUSDC" })).toBeAttached();
  await expect(page.getByRole("option", { name: "cUSDT" })).toBeAttached();
  await expect(page.getByRole("link", { name: /Open cUSDC faucet/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /Public pool accounting/i })).toBeVisible();
  await expect(page.getByText(/Connect wallet|Checking wallet|Connect to enter/i).first()).toBeVisible({
    timeout: 30_000,
  });
});

test("faucet route redirects into the dashboard flow", async ({ page }) => {
  await page.goto("/faucet", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/dashboard\/faucet$/);
});
