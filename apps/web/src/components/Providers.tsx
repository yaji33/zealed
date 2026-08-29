"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider as PrivyWagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { AppLoadingOverlay } from "@/components/AppLoadingOverlay";
import { privyConfig } from "@/lib/privy.config";
import { getWagmiConfig } from "@/lib/wagmi.config";

function subscribe() {
  return () => {};
}

function useIsClient() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

export function Providers({
  children,
  appId,
  clientId,
}: {
  children: ReactNode;
  appId: string;
  clientId: string;
}) {
  const isClient = useIsClient();
  const [config] = useState(() => getWagmiConfig());
  const [queryClient] = useState(() => new QueryClient());

  if (!isClient) {
    return (
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config} reconnectOnMount={false}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    );
  }

  return (
    <PrivyProvider appId={appId} clientId={clientId} config={privyConfig}>
      <QueryClientProvider client={queryClient}>
        <PrivyWagmiProvider config={config} reconnectOnMount={false}>
          <AppLoadingOverlay />
          {children}
        </PrivyWagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
