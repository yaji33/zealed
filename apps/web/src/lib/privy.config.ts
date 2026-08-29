import type { PrivyClientConfig } from "@privy-io/react-auth";
import { sepolia } from "wagmi/chains";

export const privyWalletList = [
  "metamask",
  "detected_ethereum_wallets",
  "wallet_connect_qr",
] as const satisfies NonNullable<
  NonNullable<PrivyClientConfig["appearance"]>["walletList"]
>;

export const privyConfig: PrivyClientConfig = {
  loginMethods: ["wallet"],
  embeddedWallets: {
    ethereum: {
      createOnLogin: "off",
    },
    solana: {
      createOnLogin: "off",
    },
  },
  defaultChain: sepolia,
  supportedChains: [sepolia],
  appearance: {
    theme: "dark",
    accentColor: "#FF5A33",
    showWalletLoginFirst: true,
    walletChainType: "ethereum-only",
    walletList: [...privyWalletList],
  },
};
