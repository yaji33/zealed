"use client";

import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useDisconnect } from "wagmi";
import { privyWalletList } from "@/lib/privy.config";
import { noticeFromWalletError } from "@/lib/walletError";

export function useConnectWallet() {
  const pathname = usePathname();
  const { connectWallet: privyConnectWallet, ready } = usePrivy();
  const { disconnect } = useDisconnect();
  const onDashboard = pathname.startsWith("/dashboard");
  const [localError, setLocalError] = useState<string | null>(null);

  const connectWallet = useCallback(() => {
    if (!onDashboard || !ready) return;
    setLocalError(null);
    privyConnectWallet({ walletList: [...privyWalletList] });
  }, [onDashboard, privyConnectWallet, ready]);

  const disconnectWallet = useCallback(() => {
    setLocalError(null);
    try {
      disconnect();
    } catch (err) {
      setLocalError(noticeFromWalletError(err, "Could not disconnect wallet").text);
    }
  }, [disconnect]);

  return {
    connectWallet,
    disconnectWallet,
    canConnect: onDashboard && ready,
    isPending: !ready,
    ready,
    error: localError ? ({ message: localError } as Error) : null,
    connector: ready,
  };
}
