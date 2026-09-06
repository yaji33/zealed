import { describe, expect, it } from "vitest";
import { LANDING_FAQ } from "@/lib/landingContent";
import {
  landingJsonLd,
  routeMetadata,
  sitemapEntries,
  vaultPageMetadata,
} from "@/lib/seo";

describe("SEO helpers", () => {
  it("sets an absolute landing title and meta description", () => {
    const home = routeMetadata("home");
    expect(home.title).toEqual({ absolute: "Zealed — Save. Win privately." });
    expect(String(home.description)).toMatch(/encrypted/i);
    expect(home.alternates?.canonical).toBe("/");
  });

  it("titles known vault workspaces from the wrapper slug", () => {
    const meta = vaultPageMetadata("cusdc");
    expect(meta.title).toBe("Prize cUSDC");
    expect(String(meta.description)).toMatch(/sponsor-funded mock yield/i);
    expect(meta.alternates?.canonical).toBe("/dashboard/cusdc");
  });

  it("includes FAQ and HowTo graph nodes for answer engines", () => {
    const json = landingJsonLd();
    const graph = json["@graph"] as Array<Record<string, unknown>>;
    const faq = graph.find((node) => node["@type"] === "FAQPage");
    const howTo = graph.find((node) => node["@type"] === "HowTo");
    expect(faq).toBeDefined();
    expect(howTo).toBeDefined();
    expect(JSON.stringify(faq)).toContain(LANDING_FAQ[0].q);
    expect(JSON.stringify(howTo)).toContain("Deposit");
  });

  it("lists public routes in the sitemap", () => {
    const urls = sitemapEntries().map((entry) => entry.url);
    expect(urls.some((url) => url.endsWith("/dashboard"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/dashboard/faucet"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/dashboard/cusdc"))).toBe(true);
  });
});
