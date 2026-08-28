"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useConfig, useWalletClient } from "wagmi";
import { getWalletClient } from "@wagmi/core";
import { bytesToHex, type Address, type Hex, type WalletClient } from "viem";
import type { FhevmInstance } from "@zama-fhe/relayer-sdk/web";
import { getFhevmInstance, warmRelayerSdk } from "@/lib/relayerSdk";

type EncryptResult = {
  handle: Hex;
  inputProof: Hex;
};

/** Prefetch Relayer SDK + WASM without touching the wallet provider. */
export async function warmFheSdk(): Promise<void> {
  await warmRelayerSdk();
}

function toHex(value: Uint8Array | Hex): Hex {
  if (typeof value === "string") return value;
  return bytesToHex(value);
}

function isZeroHandle(handle: Hex): boolean {
  return !handle || /^0x0+$/i.test(handle);
}

function formatFheError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Failed to init Relayer SDK";
  if (/unwrap_throw/i.test(message)) {
    return "Encryption WASM failed to start (often a double-init race). Hard-refresh the page and try Decrypt again.";
  }
  return message;
}

export function useFhevm() {
  const { address, isConnected, connector } = useAccount();
  const config = useConfig();
  const { data: walletClient } = useWalletClient();
  const [instance, setInstance] = useState<FhevmInstance | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected) {
      setInstance(null);
      setError(null);
    }
  }, [isConnected]);

  const ensureInstance = useCallback(async (): Promise<FhevmInstance> => {
    if (!isConnected || !address) {
      throw new Error("Wallet not connected");
    }
    if (instance) return instance;

    try {
      setError(null);
      const inst = await getFhevmInstance();
      setInstance(inst);
      return inst;
    } catch (err) {
      const message = formatFheError(err);
      setError(message);
      throw new Error(message, { cause: err });
    }
  }, [address, instance, isConnected]);

  const resolveWalletClient = useCallback(async (): Promise<WalletClient> => {
    if (walletClient) return walletClient;

    const fromConfig = await getWalletClient(config, {
      account: address,
      connector,
    });
    if (fromConfig) return fromConfig;

    throw new Error("Wallet client not available. Disconnect and connect again.");
  }, [address, config, connector, walletClient]);

  const encryptUint64 = useCallback(
    async (contractAddress: Address, amount: bigint): Promise<EncryptResult> => {
      const inst = await ensureInstance();
      if (!address) throw new Error("Wallet not connected");
      const input = inst.createEncryptedInput(contractAddress, address);
      input.add64(amount);
      const encrypted = await input.encrypt();
      return {
        handle: toHex(encrypted.handles[0]),
        inputProof: toHex(encrypted.inputProof),
      };
    },
    [address, ensureInstance],
  );

  const userDecryptMany = useCallback(
    async (
      items: { handle: Hex; contractAddress: Address }[],
    ): Promise<Record<string, bigint>> => {
      if (!address) throw new Error("Wallet not connected");

      const actionable = items.filter((item) => !isZeroHandle(item.handle));
      const out: Record<string, bigint> = {};
      for (const item of items) {
        if (isZeroHandle(item.handle)) out[item.handle] = 0n;
      }
      if (actionable.length === 0) return out;

      const inst = await ensureInstance();
      const client = await resolveWalletClient();

      const contracts = [...new Set(actionable.map((item) => item.contractAddress))];
      const keypair = inst.generateKeypair();
      const startTimestamp = Math.floor(Date.now() / 1000);
      const durationDays = 7;
      const eip712 = inst.createEIP712(
        keypair.publicKey,
        contracts,
        startTimestamp,
        durationDays,
      );
      const signature = await signUserDecryptPermit(client, address, eip712);

      const results = await inst.userDecrypt(
        actionable.map((item) => ({
          handle: item.handle,
          contractAddress: item.contractAddress,
        })),
        keypair.privateKey,
        keypair.publicKey,
        signature.replace(/^0x/, ""),
        contracts,
        address,
        startTimestamp,
        durationDays,
      );

      for (const item of actionable) {
        const value = results[item.handle];
        if (typeof value === "bigint") out[item.handle] = value;
        else if (typeof value === "number") out[item.handle] = BigInt(value);
        else if (typeof value === "string") out[item.handle] = BigInt(value);
        else throw new Error("Unexpected decrypt result type");
      }
      return out;
    },
    [address, ensureInstance, resolveWalletClient],
  );

  const userDecryptEuint64 = useCallback(
    async (handle: Hex, contractAddress: Address): Promise<bigint> => {
      const results = await userDecryptMany([{ handle, contractAddress }]);
      return results[handle] ?? 0n;
    },
    [userDecryptMany],
  );

  return {
    instance,
    ready: Boolean(instance),
    error,
    initIfNeeded: ensureInstance,
    encryptUint64,
    userDecryptEuint64,
    userDecryptMany,
  };
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
    types: rest as Record<string, { name: string; type: string }[]>,
    primaryType: eip712.primaryType,
    message: eip712.message,
  });
}
