"use client";

import { useEffect, useState } from "react";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import SearchIcon from "@mui/icons-material/Search";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import type { Hex } from "viem";
import { AppIcon } from "@/components/AppIcon";
import { DrawCyclePanel } from "@/components/DrawCyclePanel";
import { ExplorerTxLink } from "@/components/ExplorerTxLink";
import { PrivateOddsPanel } from "@/components/PrivateOddsPanel";
import { useVaultDirectory } from "@/components/VaultDirectoryProvider";
import { type DrawCyclePhase, useDrawCycle } from "@/hooks/useDrawCycle";
import { usePrizePoolData } from "@/hooks/usePrizePoolData";
import { drawManagerAbi } from "@/lib/abi/zealed";
import { DRAW_CHECK_GAS, DRAW_CLAIM_GAS } from "@/lib/draw";
import { useFhevm } from "@/lib/fhe";
import { formatUnits } from "@/lib/format";
import { waitForOkTx } from "@/lib/waitForTx";
import { StatusNotice } from "@/components/StatusNotice";
import { noticeFromWalletError } from "@/lib/walletError";
import {
  bannerClass,
  bannerWarnClass,
  btnClass,
  btnSecondaryClass,
  ledeClass,
  sectionTitleClass,
} from "@/lib/uiClasses";

type Notice = { kind: "idle" | "ok" | "err" | "cancel"; text: string };

function emptyDrawCopy(phase: DrawCyclePhase): string {
  if (phase === "awaiting-award") {
    return "Draw closed. Award is pending. Prize slots appear after the keeper awards this draw.";
  }
  if (phase === "ready-to-close") {
    return "The draw interval ended. Close the draw or wait for the keeper, then wait for award.";
  }
  if (phase === "reconciliation") {
    return "The previous claim window ended. Slots return after the next close and award.";
  }
  return "No awarded draw yet. Eligibility is accruing. The keeper closes and awards on a 20-minute demo cadence.";
}

export function PrizeBoard() {
  const pool = usePrizePoolData();
  const { selected } = useVaultDirectory();
  const configured = Boolean(selected);
  const drawId = pool.data?.activeDrawId;
  const cycle = useDrawCycle();
  const assetLabel = selected?.label ?? "token";
  const emptyPrizes =
    pool.data !== undefined &&
    pool.data.tiers.every((tier) => tier.prizePerSlot === 0n);

  return (
    <section
      className="mt-8 border-t border-line pt-8"
      aria-labelledby="prize-board-title"
    >
      <h2 id="prize-board-title" className={sectionTitleClass}>
        Private prize board
      </h2>
      <p className={`${ledeClass} mt-2 max-w-2xl`}>
        Check one slot. Decrypt locally. Claim if you won.
      </p>
      <div className="mt-6 rounded-lg border border-edge bg-surface p-5">
        <DrawCyclePanel />
      </div>
      {!configured ? (
        <p className={bannerWarnClass}>
          Prize checks will appear after the multi-tier contracts are
          configured.
        </p>
      ) : pool.isLoading ? (
        <p className={bannerClass}>Loading prize slots…</p>
      ) : pool.isError || !pool.data ? (
        <p className={bannerWarnClass}>
          Prize slots could not be loaded. Try again shortly.
        </p>
      ) : drawId === undefined || drawId === 0n ? (
        <p className={bannerClass}>{emptyDrawCopy(cycle.phase)}</p>
      ) : (
        <div className="mt-6 space-y-6">
          {emptyPrizes ? (
            <p className={bannerWarnClass}>
              This awarded draw has no prize per slot. Available prize
              liquidity was empty at award. Checks still record an encrypted
              result; decrypt to confirm.
            </p>
          ) : null}
          <PrivateOddsPanel drawId={drawId} />
          {pool.data.tiers.map((tier) => (
            <section key={tier.id} aria-labelledby={`tier-${tier.id}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3
                  id={`tier-${tier.id}`}
                  className="m-0 font-dm-sans text-lg font-medium text-ink"
                >
                  {tier.name}
                </h3>
                <p className="m-0 text-sm text-muted">
                  {tier.slots} slot{tier.slots === 1 ? "" : "s"} ·{" "}
                  {formatUnits(tier.prizePerSlot)} {assetLabel} each
                </p>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: tier.slots }, (_, slot) => (
                  <PrizeSlotCard
                    key={slot}
                    drawId={drawId}
                    tier={tier.id}
                    tierName={tier.name}
                    slot={slot}
                    assetLabel={assetLabel}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function PrizeSlotCard({
  drawId,
  tier,
  tierName,
  slot,
  assetLabel,
}: {
  drawId: bigint;
  tier: number;
  tierName: string;
  slot: number;
  assetLabel: string;
}) {
  const { address } = useAccount();
  const client = usePublicClient();
  const fhe = useFhevm();
  const { selected } = useVaultDirectory();
  const draw = selected?.drawManager;
  const { writeContractAsync, data: txHash } = useWriteContract();
  const [busy, setBusy] = useState<string | null>(null);
  const [prize, setPrize] = useState<bigint | null>(null);
  const [notice, setNotice] = useState<Notice>({ kind: "idle", text: "" });

  const { data: checked, refetch: refetchChecked } = useReadContract({
    address: draw,
    abi: drawManagerAbi,
    functionName: "hasChecked",
    args: address ? [drawId, tier, slot, address] : undefined,
    query: { enabled: Boolean(draw && address), refetchInterval: 12_000 },
  });
  const { data: claimed, refetch: refetchClaimed } = useReadContract({
    address: draw,
    abi: drawManagerAbi,
    functionName: "hasClaimed",
    args: address ? [drawId, tier, slot, address] : undefined,
    query: { enabled: Boolean(draw && address), refetchInterval: 12_000 },
  });

  useEffect(() => {
    setPrize(null);
    setNotice({ kind: "idle", text: "" });
  }, [draw, drawId]);

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setNotice({ kind: "idle", text: "" });
    try {
      await action();
    } catch (error) {
      const safe = noticeFromWalletError(
        error,
        "Prize action could not be completed.",
      );
      setNotice({ kind: safe.kind, text: safe.text });
    } finally {
      setBusy(null);
    }
  }

  async function check() {
    if (!draw || !client) return;
    await run("Checking…", async () => {
      const hash = await writeContractAsync({
        address: draw,
        abi: drawManagerAbi,
        functionName: "checkPrize",
        args: [drawId, tier, slot],
        gas: DRAW_CHECK_GAS,
      });
      await waitForOkTx(client, hash);
      await refetchChecked();
      setNotice({
        kind: "ok",
        text: "Encrypted result recorded. Decrypt it with your wallet.",
      });
    });
  }

  async function decrypt() {
    if (!draw || !client || !address) return;
    await run("Decrypting…", async () => {
      const handle = (await client.readContract({
        address: draw,
        abi: drawManagerAbi,
        functionName: "getPendingPrize",
        args: [drawId, tier, slot],
        account: address,
      })) as Hex;
      const value = await fhe.userDecryptEuint64(handle, draw);
      setPrize(value);
      setNotice({
        kind: "ok",
        text:
          value > 0n
            ? `This slot awarded ${formatUnits(value)} ${assetLabel}. Claim it before the deadline.`
            : "No prize in this slot. Your principal is unchanged.",
      });
    });
  }

  async function claim() {
    if (!draw || !client) return;
    await run("Claiming…", async () => {
      const hash = await writeContractAsync({
        address: draw,
        abi: drawManagerAbi,
        functionName: "claim",
        args: [drawId, tier, slot],
        gas: DRAW_CLAIM_GAS,
      });
      await waitForOkTx(client, hash);
      await refetchClaimed();
      setNotice({ kind: "ok", text: "Confidential prize claim confirmed." });
    });
  }

  return (
    <article className="rounded-lg border border-edge bg-base p-4">
      <p className="m-0 font-mono text-[0.68rem] tracking-[0.15em] text-muted">
        {tierName.toUpperCase()} · SLOT {slot + 1}
      </p>
      <p className="mb-4 mt-3 text-sm text-muted" aria-live="polite">
        {claimed
          ? "Claimed"
          : prize !== null
            ? prize > 0n
              ? "Winning result"
              : "Checked · no prize"
            : checked
              ? "Encrypted result ready"
              : "Not checked"}
      </p>
      {!checked ? (
        <button
          type="button"
          className={btnSecondaryClass}
          disabled={Boolean(busy)}
          onClick={() => void check()}
        >
          <AppIcon icon={SearchIcon} size={16} />
          {busy ?? "Check slot"}
        </button>
      ) : prize === null ? (
        <button
          type="button"
          className={btnClass}
          disabled={Boolean(busy)}
          onClick={() => void decrypt()}
        >
          <AppIcon icon={LockOpenIcon} size={16} />
          {busy ?? "Decrypt result"}
        </button>
      ) : prize > 0n && !claimed ? (
        <button
          type="button"
          className={btnClass}
          disabled={Boolean(busy)}
          onClick={() => void claim()}
        >
          <AppIcon icon={EmojiEventsIcon} size={16} />
          {busy ?? "Claim prize"}
        </button>
      ) : null}
      {notice.kind !== "idle" ? (
        <StatusNotice
          className="text-xs"
          kind={
            notice.kind === "ok"
              ? "ok"
              : notice.kind === "cancel"
                ? "cancel"
                : "err"
          }
        >
          {notice.text}
        </StatusNotice>
      ) : null}
      <div className="mt-3">
        <ExplorerTxLink hash={txHash} />
      </div>
    </article>
  );
}
