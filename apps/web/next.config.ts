import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const wagmiConnectors = path.join(appDir, "src/lib/wagmiConnectors.ts");
const cdpSdkStub = path.join(appDir, "src/lib/cdpSdkStub.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["viem", "@tanstack/react-query", "@mui/icons-material"],
  },
  turbopack: {
    resolveAlias: {
      "wagmi/connectors": "./src/lib/wagmiConnectors.ts",
      "@wagmi/connectors": "./src/lib/wagmiConnectors.ts",
      "@coinbase/cdp-sdk": "./src/lib/cdpSdkStub.ts",
    },
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...(config.resolve.fallback ?? {}),
      fs: false,
      path: false,
      crypto: false,
    };
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "wagmi/connectors": wagmiConnectors,
      "@wagmi/connectors": wagmiConnectors,
      "@coinbase/cdp-sdk": cdpSdkStub,
    };
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
