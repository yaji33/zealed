import { hardhat, sepolia } from "wagmi/chains";

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "11155111");

export const activeChain = chainId === hardhat.id ? hardhat : sepolia;
