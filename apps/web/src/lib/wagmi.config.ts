import { injected } from "@wagmi/core";
import { createConfig, http, type Config } from "wagmi";
import { hardhat, sepolia } from "wagmi/chains";

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "11155111");

export const activeChain = chainId === hardhat.id ? hardhat : sepolia;

let wagmiConfig: Config | undefined;

export function getWagmiConfig(): Config {
  if (!wagmiConfig) {
    wagmiConfig = createConfig({
      chains: [activeChain],

      connectors: [injected({ shimDisconnect: false })],
      ssr: true,
      transports: {
        [sepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
        [hardhat.id]: http("http://127.0.0.1:8545"),
      },
    });
  }
  return wagmiConfig;
}
