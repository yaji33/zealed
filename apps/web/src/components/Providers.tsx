"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { AppLoadingOverlay } from "@/components/AppLoadingOverlay";
import { getWagmiConfig } from "@/lib/wagmi.config";

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  const [config] = useState(() => getWagmiConfig());
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <AppLoadingOverlay />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
