"use client";

import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import { useConnect } from "wagmi";
import { ResourceUnavailableRpcError, UserRejectedRequestError } from "viem";

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
  const { connectAsync, connectors, isPending, error, reset } = useConnect();
  const connector = connectors[0];
  const onDashboard = pathname.startsWith("/dashboard");
  const [localError, setLocalError] = useState<string | null>(null);

  const connectWallet = useCallback(async () => {
    if (!onDashboard || !connector) return;
    setLocalError(null);
    reset();

    try {
      await connectAsync({ connector });
    } catch (err) {
      const code = errorCode(err);

      // MetaMask: previous connect still open / not resolved (−32002).
      if (code === ResourceUnavailableRpcError.code || code === -32002) {
        setLocalError(
          "A wallet request is already pending. Open MetaMask, approve or reject it, then try again.",
        );
        return;
      }

      if (code === UserRejectedRequestError.code || code === 4001) {
        setLocalError("Connection cancelled in the wallet.");
        return;
      }

      setLocalError(errorMessage(err));
    }
  }, [connectAsync, connector, onDashboard, reset]);

  const displayError = localError ?? (error ? errorMessage(error) : null);

  return {
    connectWallet,
    canConnect: onDashboard && Boolean(connector),
    isPending,
    error: displayError ? ({ message: displayError } as Error) : null,
    connector,
  };
}
