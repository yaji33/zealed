import { http, createConfig, createStorage, cookieStorage } from "wagmi";
import { sepolia, hardhat } from "wagmi/chains";
import { injected } from "@wagmi/core";
import type { Address } from "viem";

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "11155111");

export const activeChain = chainId === hardhat.id ? hardhat : sepolia;

export const wagmiConfig = createConfig({
  chains: [activeChain],
  connectors: [injected()],
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
    [hardhat.id]: http("http://127.0.0.1:8545"),
  },
});

function readAddress(key: string): Address | undefined {
  const value = process.env[key];
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) return undefined;
  return value as Address;
}

export const addresses = {
  vault: readAddress("NEXT_PUBLIC_VAULT_ADDRESS"),
  ticketEngine: readAddress("NEXT_PUBLIC_TICKET_ENGINE_ADDRESS"),
  drawManager: readAddress("NEXT_PUBLIC_DRAW_MANAGER_ADDRESS"),
  asset: readAddress("NEXT_PUBLIC_ASSET_ADDRESS"),
} as const;

/** Far-future operator expiry used by vault tests (2^48 - 1), fits uint48 / safe integer. */
export const OPERATOR_UNTIL = Number(2n ** 48n - 1n);

export function contractsConfigured(): boolean {
  return Boolean(addresses.vault && addresses.ticketEngine && addresses.drawManager && addresses.asset);
}
