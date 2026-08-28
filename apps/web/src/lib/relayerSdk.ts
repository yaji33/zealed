import type { FhevmInstance } from "@zama-fhe/relayer-sdk/web";

type RelayerSdk = typeof import("@zama-fhe/relayer-sdk/web");

let sdkLoadPromise: Promise<RelayerSdk> | null = null;
let instancePromise: Promise<FhevmInstance> | null = null;

/** Single-flight WASM init — concurrent initSDK() races cause tfhe unwrap_throw. */
export async function getRelayerSdk(): Promise<RelayerSdk> {
  if (!sdkLoadPromise) {
    sdkLoadPromise = (async () => {
      const sdk = await import("@zama-fhe/relayer-sdk/web");
      await sdk.initSDK();
      return sdk;
    })().catch((err) => {
      sdkLoadPromise = null;
      throw err;
    });
  }
  return sdkLoadPromise;
}

export function sepoliaRpcUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_RPC_URL?.trim();
  return fromEnv || "https://ethereum-sepolia-rpc.publicnode.com";
}

/**
 * Shared FhevmInstance for publicDecrypt + userDecrypt.
 * Uses HTTP RPC for the host chain (signing stays on the wallet client).
 */
export async function getFhevmInstance(): Promise<FhevmInstance> {
  if (!instancePromise) {
    instancePromise = (async () => {
      const sdk = await getRelayerSdk();
      return sdk.createInstance({
        ...sdk.SepoliaConfig,
        network: sepoliaRpcUrl(),
      });
    })().catch((err) => {
      instancePromise = null;
      throw err;
    });
  }
  return instancePromise;
}

/** Prefetch WASM without creating an instance. */
export async function warmRelayerSdk(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await getRelayerSdk();
  } catch {
    // Best-effort; real errors surface on decrypt / TVL.
  }
}
