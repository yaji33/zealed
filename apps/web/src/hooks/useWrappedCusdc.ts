"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import { addresses, faucetConfigured } from "@/lib/addresses";
import { erc7984Abi, underlyingErc20Abi } from "@/lib/abi/zealed";

/**
 * Lifetime USDC sent from this wallet into the cUSDC wrapper (wraps are plaintext
 * Transfer events on the underlying mock). Converted to cUSDC via wrapper `rate()`.
 */
export function useWrappedCusdc() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const underlying = addresses.underlying;
  const wrapper = addresses.asset;
  const configured = faucetConfigured();

  const { data: rate } = useReadContract({
    address: wrapper,
    abi: erc7984Abi,
    functionName: "rate",
    query: { enabled: Boolean(wrapper) },
  });

  const query = useQuery({
    queryKey: ["wrapped-cusdc", underlying, wrapper, address],
    enabled: Boolean(configured && publicClient && underlying && wrapper && address),
    queryFn: async (): Promise<bigint> => {
      if (!publicClient || !underlying || !wrapper || !address) return 0n;

      const logs = await publicClient.getContractEvents({
        address: underlying,
        abi: underlyingErc20Abi,
        eventName: "Transfer",
        args: { from: address, to: wrapper },
        fromBlock: 0n,
        toBlock: "latest",
      });

      return logs.reduce((sum, log) => sum + (log.args.value ?? 0n), 0n);
    },
  });

  const underlyingWrapped = query.data ?? 0n;
  const divisor = rate && rate > 0n ? rate : 1n;
  const wrappedCusdc = underlyingWrapped / divisor;

  return {
    wrappedCusdc,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
