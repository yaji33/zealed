"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { underlyingErc20Abi } from "@/lib/abi/zealed";

export function wrappedAssetQueryKey(
  underlying: Address | undefined,
  wrapper: Address | undefined,
  account: Address | undefined,
) {
  return ["wrapped-asset", underlying, wrapper, account] as const;
}

export function useWrappedAsset({
  account,
  underlying,
  wrapper,
  rate,
}: {
  account: Address | undefined;
  underlying: Address | undefined;
  wrapper: Address | undefined;
  rate: bigint | undefined;
}) {
  const publicClient = usePublicClient();
  const configured = Boolean(publicClient && underlying && wrapper && account);

  const query = useQuery({
    queryKey: wrappedAssetQueryKey(underlying, wrapper, account),
    enabled: configured,
    queryFn: async (): Promise<bigint> => {
      if (!publicClient || !underlying || !wrapper || !account) return 0n;
      const logs = await publicClient.getContractEvents({
        address: underlying,
        abi: underlyingErc20Abi,
        eventName: "Transfer",
        args: { from: account, to: wrapper },
        fromBlock: 0n,
        toBlock: "latest",
      });
      return logs.reduce((sum, log) => sum + (log.args.value ?? 0n), 0n);
    },
  });

  const underlyingWrapped = query.data ?? 0n;
  const divisor = rate && rate > 0n ? rate : 1n;
  return {
    wrappedAmount: underlyingWrapped / divisor,
    isLoading: query.isLoading,
    refetch: query.refetch,
    configured,
  };
}
