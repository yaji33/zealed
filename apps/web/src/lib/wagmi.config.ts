import { http, type Config } from "wagmi";
import { createConfig } from "@privy-io/wagmi";
import { sepolia } from "wagmi/chains";
import { activeChain } from "@/lib/chain";

export { activeChain };

let wagmiConfig: Config | undefined;

export function getWagmiConfig(): Config {
  if (!wagmiConfig) {
    wagmiConfig = createConfig({
      chains: [sepolia],
      ssr: true,
      transports: {
        [sepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
      },
    });
  }
  return wagmiConfig;
}
