"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { ExplorerTxLink } from "@/components/ExplorerTxLink";
import { useVaultDirectory } from "@/components/VaultDirectoryProvider";
import { useDrawCycle } from "@/hooks/useDrawCycle";
import { drawManagerAbi } from "@/lib/abi/zealed";
import { formatCountdown } from "@/lib/format";
import { waitForOkTx } from "@/lib/waitForTx";
import { noticeFromWalletError } from "@/lib/walletError";
import {
  bannerClass,
  bannerOkClass,
  bannerWarnClass,
  btnSecondaryClass,
  ledeClass,
  monoClass,
} from "@/lib/uiClasses";

type Status = { kind: "idle" | "ok" | "err" | "cancel"; text: string };

const PHASE_COPY = {
  loading: "Loading draw state…",
  open: "Savings continue to accrue eligibility until this period closes.",
  "ready-to-close": "The interval has ended. Anyone can close the draw.",
  "awaiting-award":
    "The snapshot is sealed and awaiting its public aggregate proof.",
  claiming: "Awarded slots can be checked and claimed before the deadline.",
  reconciliation:
    "The claim window ended. Unused liquidity is being reconciled.",
} as const;

export function DrawClock({ align = "end" }: { align?: "start" | "end" }) {
  const cycle = useDrawCycle();
  const { selected } = useVaultDirectory();
  if (!selected) return null;
  const value =
    cycle.phase === "open" || cycle.phase === "claiming"
      ? formatCountdown(cycle.secondsRemaining)
      : cycle.phase.replaceAll("-", " ");
  return (
    <div className={align === "end" ? "text-right" : "text-left"}>
      <p className="m-0 font-mono text-[0.68rem] tracking-[0.14em] text-muted">
        {cycle.clockLabel}
      </p>
      <p
        className={`m-0 mt-1 font-mono text-lg tabular-nums capitalize text-ink ${monoClass}`}
      >
        {value}
      </p>
    </div>
  );
}

export function DrawCyclePanel() {
  const { selected } = useVaultDirectory();
  const configured = Boolean(selected);
  const { address } = useAccount();
  const client = usePublicClient();
  const cycle = useDrawCycle();
  const { writeContractAsync, data: txHash } = useWriteContract();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "" });
  const draw = selected?.drawManager;

  async function closeDraw() {
    if (!draw || !client || !address) return;
    setBusy(true);
    setStatus({ kind: "idle", text: "" });
    try {
      const hash = await writeContractAsync({
        address: draw,
        abi: drawManagerAbi,
        functionName: "closeDraw",
      });
      await waitForOkTx(client, hash);
      await cycle.refetch();
      setStatus({
        kind: "ok",
        text: "Draw closed. The eligibility snapshot is sealed.",
      });
    } catch (error) {
      const notice = noticeFromWalletError(error, "Could not close the draw.");
      setStatus({ kind: notice.kind, text: notice.text });
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <div>
        <p className="m-0 font-mono text-[0.68rem] tracking-[0.18em] text-ember/75">
          DRAW LIFECYCLE
        </p>
        <p className={`${ledeClass} mt-2`}>
          Multi-tier draw state is not configured yet.
        </p>
      </div>
    );
  }

  return (
    <div className="m-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="m-0 font-mono text-[0.68rem] tracking-[0.18em] text-ember/75">
            DRAW LIFECYCLE
          </p>
          <p className="m-0 mt-2 font-dm-sans text-xl font-medium text-ink">
            Draw #{cycle.drawId?.toString() ?? "…"}
          </p>
          <p className={`${ledeClass} mt-2 max-w-xl`}>
            {PHASE_COPY[cycle.phase]}
          </p>
        </div>
        <DrawClock />
      </div>

      {cycle.phase === "ready-to-close" ? (
        <button
          type="button"
          className={`${btnSecondaryClass} mt-4`}
          disabled={!address || busy}
          onClick={() => void closeDraw()}
        >
          {busy ? "Closing draw…" : "Close draw"}
        </button>
      ) : null}
      {cycle.phase === "awaiting-award" ? (
        <p className={bannerClass}>
          Awarding requires the aggregate score proof; no user position is
          decrypted.
        </p>
      ) : null}
      {status.kind !== "idle" ? (
        <p
          className={
            status.kind === "ok"
              ? bannerOkClass
              : status.kind === "cancel"
                ? bannerClass
                : bannerWarnClass
          }
        >
          {status.text}
        </p>
      ) : null}
      <div className="mt-3">
        <ExplorerTxLink hash={txHash} />
      </div>
    </div>
  );
}
