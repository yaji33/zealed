import { fallback, http, webSocket, type Config, type Transport } from "wagmi";
import { createConfig } from "@privy-io/wagmi";
import { sepolia } from "wagmi/chains";
import { activeChain } from "@/lib/chain";

export { activeChain };

let wagmiConfig: Config | undefined;

function sepoliaTransport(): Transport {
  const httpUrl = process.env.NEXT_PUBLIC_RPC_URL;
  const wsUrl = process.env.NEXT_PUBLIC_RPC_WS_URL;
  const httpTransport = http(httpUrl);

  // Optional WSS for eth_subscribe / faster block tips. Falls back to HTTP poll.
  if (wsUrl) {
    return fallback([webSocket(wsUrl), httpTransport]);
  }
  return httpTransport;
}

export function getWagmiConfig(): Config {
  if (!wagmiConfig) {
    wagmiConfig = createConfig({
      chains: [sepolia],
      ssr: true,
      transports: {
        [sepolia.id]: sepoliaTransport(),
      },
    });
  }
  return wagmiConfig;
}
