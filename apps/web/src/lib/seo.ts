import type { Metadata } from "next";
import { HOW_IT_WORKS_STEPS, LANDING_FAQ } from "@/lib/landingContent";
import { FAUCET_PATH, prizeVaultName, VAULTS_PATH } from "@/lib/vaultPath";
import { metaForSlug, ZAMA_SEPOLIA_WRAPPERS } from "@/lib/wrapperMeta";

export const SITE_NAME = "Zealed";
export const DEFAULT_TITLE = "Zealed — Confidential prize savings";
export const DEFAULT_DESCRIPTION =
  "Zealed is confidential prize savings on Zama fhEVM. Deposits stay encrypted, principal stays withdrawable, and prizes come from a separate sponsor pool.";

export const ROUTES = {
  home: {
    title: "Save. Win privately.",
    absoluteTitle: "Zealed — Save. Win privately.",
    description: DEFAULT_DESCRIPTION,
    path: "/",
  },
  vaults: {
    title: "Vaults",
    description:
      "Browse curated confidential prize vaults on Ethereum Sepolia. Principal TVL and available prize liquidity are public; your position stays encrypted.",
    path: VAULTS_PATH,
  },
  faucet: {
    title: "Faucet",
    description:
      "Mint official mock tokens on Ethereum Sepolia, wrap them to ERC-7984, and deposit into a Zealed confidential vault.",
    path: FAUCET_PATH,
  },
  notFound: {
    title: "Page not found",
    description:
      "This Zealed page does not exist. Open the vaults directory or return home.",
    path: "/404",
  },
} as const;

export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL?.trim().replace(/\/$/, "");
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3001";
}

export function canonicalUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalized, `${siteUrl()}/`).toString();
}

export function routeMetadata(
  route: Exclude<keyof typeof ROUTES, "notFound">,
): Metadata {
  const item = ROUTES[route];
  const title =
    "absoluteTitle" in item && item.absoluteTitle
      ? { absolute: item.absoluteTitle }
      : item.title;
  return {
    title,
    description: item.description,
    alternates: { canonical: item.path },
    openGraph: {
      title: "absoluteTitle" in item && item.absoluteTitle ? item.absoluteTitle : item.title,
      description: item.description,
      url: item.path,
    },
  };
}

export function vaultPageMetadata(slug: string): Metadata {
  const meta = metaForSlug(slug);
  const label = meta?.shortLabel ?? slug;
  const title = prizeVaultName(label);
  const description = `Save privately in ${title}. Principal stays withdrawable. Prizes are paid from sponsor-funded mock yield, never from your deposit.`;
  const path = `${VAULTS_PATH}/${encodeURIComponent(slug.toLowerCase())}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path },
  };
}

export function sitemapEntries(): { url: string; changeFrequency: "weekly"; priority: number }[] {
  const origin = siteUrl();
  return [
    { url: origin, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}${VAULTS_PATH}`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${origin}${FAUCET_PATH}`, changeFrequency: "weekly", priority: 0.8 },
    ...ZAMA_SEPOLIA_WRAPPERS.map((wrapper) => ({
      url: `${origin}${VAULTS_PATH}/${wrapper.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}

export function landingJsonLd(): Record<string, unknown> {
  const origin = siteUrl();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: SITE_NAME,
        url: origin,
        logo: `${origin}/favicon.svg`,
        description: DEFAULT_DESCRIPTION,
      },
      {
        "@type": "WebSite",
        name: SITE_NAME,
        url: origin,
        description: DEFAULT_DESCRIPTION,
        inLanguage: "en",
      },
      {
        "@type": "WebApplication",
        name: SITE_NAME,
        url: origin,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web",
        description: DEFAULT_DESCRIPTION,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      },
      {
        "@type": "HowTo",
        name: "How Zealed confidential prize savings works",
        description: DEFAULT_DESCRIPTION,
        step: HOW_IT_WORKS_STEPS.map((step, index) => ({
          "@type": "HowToStep",
          position: index + 1,
          name: step.title,
          text: step.body,
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: LANDING_FAQ.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.a,
          },
        })),
      },
    ],
  };
}
