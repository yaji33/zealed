"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { bytesToHex, type Address, type Hex, type WalletClient } from "viem";
import type { FhevmInstance } from "@zama-fhe/relayer-sdk/web";

type EncryptResult = {
  handle: Hex;
  inputProof: Hex;
};

let sdkInitPromise: Promise<boolean> | null = null;

async function loadSdk() {
  const sdk = await import("@zama-fhe/relayer-sdk/web");
  if (!sdkInitPromise) {
    sdkInitPromise = sdk.initSDK();
  }
  await sdkInitPromise;
  return sdk;
}

function toHex(value: Uint8Array | Hex): Hex {
  if (typeof value === "string") return value;
  return bytesToHex(value);
}

export function useFhevm() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [instance, setInstance] = useState<FhevmInstance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!isConnected || typeof window === "undefined") {
        setInstance(null);
        setReady(false);
        return;
      }
      const ethereum = (window as Window & { ethereum?: unknown }).ethereum;
      if (!ethereum) {
        setInstance(null);
        setReady(false);
        setError("No injected wallet found");
        return;
      }
      try {
        setError(null);
        const sdk = await loadSdk();
        const inst = await sdk.createInstance({
          ...sdk.SepoliaConfig,
          network: ethereum as Parameters<typeof sdk.createInstance>[0]["network"],
        });
        if (!cancelled) {
          setInstance(inst);
          setReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setInstance(null);
          setReady(false);
          setError(err instanceof Error ? err.message : "Failed to init Relayer SDK");
        }
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [isConnected, address]);

  const encryptUint64 = useCallback(
    async (contractAddress: Address, amount: bigint): Promise<EncryptResult> => {
      if (!instance || !address) throw new Error("FHE instance not ready");
      const input = instance.createEncryptedInput(contractAddress, address);
      input.add64(amount);
      const encrypted = await input.encrypt();
      return {
        handle: toHex(encrypted.handles[0]),
        inputProof: toHex(encrypted.inputProof),
      };
    },
    [instance, address],
  );

  const userDecryptEuint64 = useCallback(
    async (handle: Hex, contractAddress: Address): Promise<bigint> => {
      if (!instance || !address || !walletClient) throw new Error("Wallet / FHE not ready");
      if (/^0x0+$/.test(handle)) return 0n;

      const keypair = instance.generateKeypair();
      const startTimestamp = Math.floor(Date.now() / 1000);
      const durationDays = 7;
      const eip712 = instance.createEIP712(keypair.publicKey, [contractAddress], startTimestamp, durationDays);
      const signature = await signUserDecryptPermit(walletClient, address, eip712);

      const results = await instance.userDecrypt(
        [{ handle, contractAddress }],
        keypair.privateKey,
        keypair.publicKey,
        signature.replace(/^0x/, ""),
        [contractAddress],
        address,
        startTimestamp,
        durationDays,
      );

      const value = results[handle];
      if (typeof value === "bigint") return value;
      if (typeof value === "number") return BigInt(value);
      if (typeof value === "string") return BigInt(value);
      throw new Error("Unexpected decrypt result type");
    },
    [instance, address, walletClient],
  );

  return { instance, ready, error, encryptUint64, userDecryptEuint64 };
}

async function signUserDecryptPermit(
  walletClient: WalletClient,
  account: Address,
  eip712: {
    domain: {
      name: string;
      version: string;
      chainId: number | bigint;
      verifyingContract: Address;
    };
    types: Record<string, readonly { name: string; type: string }[]>;
    message: Record<string, unknown>;
    primaryType: string;
  },
): Promise<Hex> {
  const { EIP712Domain: _ignored, ...rest } = eip712.types;
  void _ignored;

  return walletClient.signTypedData({
    account,
    domain: {
      name: eip712.domain.name,
      version: eip712.domain.version,
      chainId: Number(eip712.domain.chainId),
      verifyingContract: eip712.domain.verifyingContract,
    },
    // viem expects mutable arrays; SDK types are readonly.
    types: rest as Record<string, { name: string; type: string }[]>,
    primaryType: eip712.primaryType,
    message: eip712.message,
  });
}
