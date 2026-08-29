"use client";

import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { UserRejectedRequestError } from "viem";

function errorCode(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  if ("code" in err && typeof (err as { code: unknown }).code === "number") {
    return (err as { code: number }).code;
  }
  if ("cause" in err) return errorCode((err as { cause: unknown }).cause);
  return undefined;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Could not connect wallet";
}

export function useConnectWallet() {
  const pathname = usePathname();
  const { login, logout, ready } = usePrivy();
  const onDashboard = pathname.startsWith("/dashboard");
  const [localError, setLocalError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const connectWallet = useCallback(async () => {
    if (!onDashboard || !ready) return;
    setLocalError(null);
    setIsLoggingIn(true);
    try {
      await login();
    } catch (err) {
      const code = errorCode(err);
      if (code === UserRejectedRequestError.code || code === 4001) {
        setLocalError("Connection cancelled in the wallet.");
        return;
      }
      setLocalError(errorMessage(err));
    } finally {
      setIsLoggingIn(false);
    }
  }, [login, onDashboard, ready]);

  const disconnectWallet = useCallback(async () => {
    setLocalError(null);
    try {
      await logout();
    } catch (err) {
      setLocalError(errorMessage(err));
    }
  }, [logout]);

  return {
    connectWallet,
    disconnectWallet,
    canConnect: onDashboard && ready,
    isPending: !ready || isLoggingIn,
    ready,
    error: localError ? ({ message: localError } as Error) : null,
    connector: ready,
  };
}
