"use client";

import { useEffect, useState } from "react";
import type { Hex } from "viem";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import { useVaultDirectory } from "@/components/VaultDirectoryProvider";
import { usePrizePoolData } from "@/hooks/usePrizePoolData";
import { drawManagerAbi } from "@/lib/abi/zealed";
import { useFhevm } from "@/lib/fhe";
import {
  bannerClass,
  bannerWarnClass,
  btnSecondaryClass,
} from "@/lib/uiClasses";
import { noticeFromWalletError } from "@/lib/walletError";

export function calculateTierChance(
  weight: bigint,
  totalScore: bigint,
  slots: number,
): number | null {
  if (weight < 0n || totalScore <= 0n || slots <= 0) return null;
  const perSlot = Math.min(1, Number(weight) / Number(totalScore));
  return 1 - (1 - perSlot) ** slots;
}

export function PrivateOddsPanel({ drawId }: { drawId: bigint }) {
  const { address } = useAccount();
  const client = usePublicClient();
  const fhe = useFhevm();
  const pool = usePrizePoolData();
  const { selected } = useVaultDirectory();
  const draw = selected?.drawManager;
  const [weight, setWeight] = useState<bigint | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWeight(null);
    setError(null);
    setBusy(false);
  }, [address, draw, drawId]);

  const { data: prepared } = useReadContract({
    address: draw,
    abi: drawManagerAbi,
    functionName: "rangePrepared",
    args: address ? [drawId, address] : undefined,
    query: { enabled: Boolean(draw && address) },
  });
  const { data: drawState } = useReadContract({
    address: draw,
    abi: drawManagerAbi,
    functionName: "draws",
    args: [drawId],
    query: { enabled: Boolean(draw) },
  });
  const totalScore = drawState?.[4] ?? 0n;

  async function decryptOdds() {
    if (!client || !draw) return;
    setBusy(true);
    setError(null);
    try {
      const handle = (await client.readContract({
        address: draw,
        abi: drawManagerAbi,
        functionName: "getDrawWeight",
        args: [drawId],
        account: address,
      })) as Hex;
      setWeight(await fhe.userDecryptEuint64(handle, draw));
    } catch (cause) {
      setError(
        noticeFromWalletError(cause, "Private odds could not be decrypted.")
          .text,
      );
    } finally {
      setBusy(false);
    }
  }

  if (!prepared) {
    return (
      <p className={bannerClass}>
        Check any prize slot to prepare your encrypted draw weight and private
        odds.
      </p>
    );
  }

  return (
    <section
      className="mt-5 rounded-lg border border-edge bg-base p-4"
      aria-labelledby="private-odds-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3
            id="private-odds-title"
            className="m-0 font-dm-sans text-base font-medium text-ink"
          >
            Your private odds
          </h3>
          <p className="mb-0 mt-1 text-sm text-muted">
            Your draw weight stays encrypted until you authorize local
            decryption.
          </p>
        </div>
        {weight === null ? (
          <button
            type="button"
            className={btnSecondaryClass}
            disabled={busy}
            onClick={() => void decryptOdds()}
          >
            {busy ? "Decrypting…" : "Decrypt odds"}
          </button>
        ) : null}
      </div>
      {weight !== null && totalScore > 0n ? (
        <ul className="mb-0 mt-4 grid list-none gap-2 p-0 sm:grid-cols-3">
          {pool.data?.tiers.map((tier) => {
            const tierChance =
              calculateTierChance(weight, totalScore, tier.slots) ?? 0;
            return (
              <li
                key={tier.id}
                className="rounded border border-line px-3 py-2 text-sm text-muted"
              >
                <span className="text-ink">{tier.name}</span>{" "}
                {(Math.min(1, tierChance) * 100).toLocaleString(undefined, {
                  maximumFractionDigits: 4,
                })}
                %
              </li>
            );
          })}
        </ul>
      ) : null}
      {error ? <p className={bannerWarnClass}>{error}</p> : null}
    </section>
  );
}
