"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { bytesToHex, type Address, type Hex, type PublicClient } from "viem";
import { useDrawCycle } from "@/hooks/useDrawCycle";
import { usePublicDrawData } from "@/hooks/usePublicDrawData";
import { drawManagerAbi, ticketEngineAbi } from "@/lib/abi/zealed";
import { addresses, contractsConfigured } from "@/lib/config";
import { DEMO_PRIZE_PLAIN, DRAW_REVEAL_SLACK_BLOCKS, DRAW_SETTLE_GAS } from "@/lib/draw";
import { formatCountdown, formatUnits } from "@/lib/format";
import { getFhevmInstance } from "@/lib/relayerSdk";
import { isZeroHandle, readClearValue } from "@/lib/publicDecrypt";
import { noticeFromWalletError, decodedRevertNotice } from "@/lib/walletError";
import {
  bannerClass,
  bannerOkClass,
  bannerWarnClass,
  btnSecondaryClass,
  ledeClass,
  monoClass,
} from "@/lib/uiClasses";

type Status = { kind: "idle" | "ok" | "err" | "cancel"; text: string };

function proofToHex(value: Uint8Array | string): Hex {
  if (typeof value === "string") return (value.startsWith("0x") ? value : `0x${value}`) as Hex;
  return bytesToHex(value);
}

async function resolveDrawGas(
  client: PublicClient,
  account: Address,
  request: {
    address: Address;
    functionName: "commitDraw" | "revealDraw";
    args: readonly unknown[];
  },
): Promise<bigint> {
  try {
    const estimated = await client.estimateContractGas({
      address: request.address,
      abi: drawManagerAbi,
      functionName: request.functionName,
      args: request.args as never,
      account,
    });
    const padded = estimated + estimated / 4n;
    if (padded > DRAW_SETTLE_GAS) return DRAW_SETTLE_GAS;
    if (padded < 300_000n) return 300_000n;
    return padded;
  } catch {
    return DRAW_SETTLE_GAS;
  }
}

async function assertCanPayGas(client: PublicClient, account: Address, gas: bigint): Promise<void> {
  const [balance, gasPrice] = await Promise.all([
    client.getBalance({ address: account }),
    client.getGasPrice(),
  ]);
  if (balance < gas * gasPrice) {
    throw new Error("Not enough Sepolia ETH to cover gas.");
  }
}

async function waitForOk(client: PublicClient, hash: Hex, replay?: () => Promise<unknown>): Promise<void> {
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status === "success") return;
  if (replay) await replay();
  throw new Error("The transaction reverted.");
}

export function DrawClock({ align = "end" }: { align?: "start" | "end" }) {
  const { phase, secondsRemaining, clockLabel } = useDrawCycle();
  const configured = contractsConfigured();

  if (!configured) return null;

  const value =
    phase === "loading"
      ? "…"
      : phase === "missed"
        ? "missed"
        : formatCountdown(secondsRemaining);

  return (
    <div className={align === "end" ? "text-right" : "text-left"}>
      <p className="m-0 font-mono text-[0.68rem] tracking-[0.14em] text-muted">{clockLabel}</p>
      <p className={`m-0 mt-1 font-mono text-lg tabular-nums text-ink ${monoClass}`}>{value}</p>
    </div>
  );
}

export function DrawCyclePanel() {
  const configured = contractsConfigured();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const cycle = useDrawCycle();
  const { prizeAmountPlain } = usePublicDrawData();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "" });

  const draw = addresses.drawManager;
  const tickets = addresses.ticketEngine;
  const working = Boolean(busy);

  const nextPrize =
    prizeAmountPlain && prizeAmountPlain > 0n ? prizeAmountPlain : DEMO_PRIZE_PLAIN;

  const caption =
    cycle.phase === "interval"
      ? `${formatUnits(nextPrize)} cUSDC this cycle`
      : cycle.phase === "open"
        ? "Waiting on the keeper"
        : cycle.phase === "awaiting-reveal"
          ? "Reveal delay"
          : cycle.phase === "settle"
            ? "Waiting on the keeper"
            : cycle.phase === "missed"
              ? "Reveal window missed"
              : "Loading";

  const clockValue =
    cycle.phase === "loading"
      ? "…"
      : cycle.phase === "missed"
        ? "missed"
        : formatCountdown(cycle.secondsRemaining);

  async function withBusy(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setStatus({ kind: "idle", text: "" });
    try {
      await fn();
    } catch (err) {
      const notice = noticeFromWalletError(err, "Transaction failed");
      setStatus({ kind: notice.kind, text: notice.text });
    } finally {
      setBusy(null);
    }
  }

  async function onStartDraw() {
    if (!draw || !publicClient || !address) return;
    await withBusy("Completing draw…", async () => {
      const latest = await publicClient.getBlockNumber();
      const target = latest + cycle.minRevealDelay + DRAW_REVEAL_SLACK_BLOCKS;
      const args = [target, DEMO_PRIZE_PLAIN] as const;
      try {
        await publicClient.simulateContract({
          address: draw,
          abi: drawManagerAbi,
          functionName: "commitDraw",
          args,
          account: address,
        });
      } catch (err) {
        if (decodedRevertNotice(err)) throw err;
      }
      const gas = await resolveDrawGas(publicClient, address, {
        address: draw,
        functionName: "commitDraw",
        args,
      });
      await assertCanPayGas(publicClient, address, gas);
      const hash = await writeContractAsync({
        address: draw,
        abi: drawManagerAbi,
        functionName: "commitDraw",
        args,
        gas,
      });
      await waitForOk(publicClient, hash, async () => {
        await publicClient.simulateContract({
          address: draw,
          abi: drawManagerAbi,
          functionName: "commitDraw",
          args,
          account: address,
        });
      });
      await cycle.refetch();
      setStatus({ kind: "ok", text: "Draw is in progress. The timer is the reveal delay." });
    });
  }

  async function onSettleDraw() {
    if (!draw || !tickets || !publicClient || !address) return;
    await withBusy("Finalizing draw…", async () => {
      const handle = (await publicClient.readContract({
        address: tickets,
        abi: ticketEngineAbi,
        functionName: "totalTickets",
      })) as Hex;

      if (isZeroHandle(handle)) {
        throw new Error("The pool has no tickets yet. Deposit before settling.");
      }

      setBusy("Decrypting ticket total…");
      const instance = await getFhevmInstance();
      const pub = await instance.publicDecrypt([handle]);
      const total = readClearValue(pub.clearValues as Record<string, unknown>, handle);
      if (total === undefined || total === 0n) {
        throw new Error("The pool has no tickets yet. Deposit before settling.");
      }
      if (total > 0xffff_ffff_ffff_ffffn) {
        throw new Error("Ticket total is too large to settle.");
      }

      setBusy("Finalizing draw…");
      const proof = proofToHex(pub.decryptionProof as Uint8Array | string);
      const args = [total, proof] as const;
      try {
        await publicClient.simulateContract({
          address: draw,
          abi: drawManagerAbi,
          functionName: "revealDraw",
          args,
          account: address,
        });
      } catch (err) {
        if (decodedRevertNotice(err)) throw err;
      }
      const gas = await resolveDrawGas(publicClient, address, {
        address: draw,
        functionName: "revealDraw",
        args,
      });
      await assertCanPayGas(publicClient, address, gas);
      const hash = await writeContractAsync({
        address: draw,
        abi: drawManagerAbi,
        functionName: "revealDraw",
        args,
        gas,
      });
      await waitForOk(publicClient, hash, async () => {
        await publicClient.simulateContract({
          address: draw,
          abi: drawManagerAbi,
          functionName: "revealDraw",
          args,
          account: address,
        });
      });
      await cycle.refetch();
      setStatus({ kind: "ok", text: "Draw settled." });
    });
  }

  if (!configured) return null;

  const canStart = cycle.phase === "open" && Boolean(address) && !working;
  const canSettle = cycle.phase === "settle" && Boolean(address) && !working;

  return (
    <div className="m-0 [&_p]:!mb-0">
      <p className="m-0 font-mono text-[0.68rem] tracking-[0.18em] text-ember/75">NEXT DRAW</p>
      <p className="m-0 mt-2 font-mono text-[2rem] font-medium tabular-nums tracking-tight text-ink">
        {clockValue}
      </p>
      <p className={`${ledeClass} mt-2`}>{busy ?? caption}</p>
      {cycle.phase === "open" || cycle.phase === "settle" ? (
        <div className="mt-4">
          <button
            type="button"
            className={btnSecondaryClass}
            disabled={cycle.phase === "open" ? !canStart : !canSettle}
            onClick={() => void (cycle.phase === "open" ? onStartDraw() : onSettleDraw())}
          >
            Complete draw
          </button>
        </div>
      ) : null}
      {status.kind !== "idle" && (
        <p
          className={
            status.kind === "ok" ? bannerOkClass : status.kind === "cancel" ? bannerClass : bannerWarnClass
          }
        >
          {status.text}
        </p>
      )}
    </div>
  );
}
