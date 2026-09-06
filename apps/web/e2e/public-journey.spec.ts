import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("landing exposes the product and app entry point", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/save\.\s*win privately/i);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /encrypted/i,
  );
  await expect(page.getByRole("heading", { name: /save.*win/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /launch app/i }).first()).toBeVisible();
  const jsonLd = page.locator('script[type="application/ld+json"]');
  await expect(jsonLd).toHaveCount(1);
  const payload = JSON.parse((await jsonLd.textContent()) ?? "{}") as {
    "@graph"?: Array<{ "@type"?: string }>;
  };
  const types = new Set((payload["@graph"] ?? []).map((node) => node["@type"]));
  expect(types.has("FAQPage")).toBe(true);
  expect(types.has("HowTo")).toBe(true);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const blocking = accessibility.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
  expect(blocking).toEqual([]);
});

test("unknown routes render a 404 stage", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /this page is not here/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /open vaults/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /back home/i })).toBeVisible();
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

test("landing navigation is usable on a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /open menu/i })).toBeVisible();
  await page.getByRole("button", { name: /open menu/i }).click();
  await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: /launch app/i }),
  ).toBeVisible();
});
