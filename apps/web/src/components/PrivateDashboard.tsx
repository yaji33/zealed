"use client";

import { useMemo, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { addresses, contractsConfigured, OPERATOR_UNTIL } from "@/lib/config";
import { drawManagerAbi, erc7984Abi, ticketEngineAbi, vaultAbi } from "@/lib/abi/zealed";
import { useFhevm } from "@/lib/fhe";
import { formatUnits, parseUnits } from "@/lib/format";
import type { Hex } from "viem";

type Status = { kind: "idle" | "ok" | "err"; text: string };

export function PrivateDashboard() {
  const { address, isConnected } = useAccount();
  const configured = contractsConfigured();
  const fhe = useFhevm();
  const { writeContractAsync, data: txHash, isPending: txPending } = useWriteContract();
  const { isLoading: txConfirming } = useWaitForTransactionReceipt({ hash: txHash });

  const [depositAmount, setDepositAmount] = useState("1");
  const [withdrawAmount, setWithdrawAmount] = useState("0.5");
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "" });
  const [balance, setBalance] = useState<bigint | null>(null);
  const [twab, setTwab] = useState<bigint | null>(null);
  const [weight, setWeight] = useState<bigint | null>(null);
  const [prize, setPrize] = useState<bigint | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const vault = addresses.vault;
  const asset = addresses.asset;
  const tickets = addresses.ticketEngine;
  const draw = addresses.drawManager;

  const { data: isOperator, refetch: refetchOperator } = useReadContract({
    address: asset,
    abi: erc7984Abi,
    functionName: "isOperator",
    args: address && vault ? [address, vault] : undefined,
    query: { enabled: Boolean(address && asset && vault) },
  });

  const { data: drawId } = useReadContract({
    address: draw,
    abi: drawManagerAbi,
    functionName: "drawId",
    query: { enabled: Boolean(draw) },
  });

  const { data: revealed } = useReadContract({
    address: draw,
    abi: drawManagerAbi,
    functionName: "revealed",
    query: { enabled: Boolean(draw) },
  });

  const { data: hasChecked, refetch: refetchChecked } = useReadContract({
    address: draw,
    abi: drawManagerAbi,
    functionName: "hasChecked",
    args: drawId !== undefined && address ? [drawId, address] : undefined,
    query: { enabled: Boolean(draw && address && drawId !== undefined) },
  });

  const { data: ticketIndex } = useReadContract({
    address: tickets,
    abi: ticketEngineAbi,
    functionName: "indexOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(tickets && address) },
  });

  const working = Boolean(busy) || txPending || txConfirming;

  const canDeposit = Boolean(isOperator && fhe.ready && configured && isConnected);

  const privateReady = useMemo(
    () => isConnected && configured && fhe.ready,
    [isConnected, configured, fhe.ready],
  );

  async function withBusy(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setStatus({ kind: "idle", text: "" });
    try {
      await fn();
    } catch (err) {
      setStatus({
        kind: "err",
        text: err instanceof Error ? err.message : "Transaction failed",
      });
    } finally {
      setBusy(null);
    }
  }

  async function onSetOperator() {
    if (!asset || !vault) return;
    await withBusy("Approving vault operator…", async () => {
      await writeContractAsync({
        address: asset,
        abi: erc7984Abi,
        functionName: "setOperator",
        args: [vault, OPERATOR_UNTIL],
      });
      await refetchOperator();
      setStatus({
        kind: "ok",
        text: "Vault is now an operator on your cUSDC. You can deposit.",
      });
    });
  }

  async function onDeposit() {
    if (!vault || !fhe.ready) return;
    await withBusy("Encrypting + depositing…", async () => {
      const amount = parseUnits(depositAmount, 6);
      const { handle, inputProof } = await fhe.encryptUint64(vault, amount);
      await writeContractAsync({
        address: vault,
        abi: vaultAbi,
        functionName: "deposit",
        args: [handle, inputProof],
      });
      setStatus({ kind: "ok", text: "Deposit submitted. Decrypt your balance to refresh." });
    });
  }

  async function onWithdraw() {
    if (!vault || !fhe.ready) return;
    await withBusy("Encrypting + withdrawing…", async () => {
      const amount = parseUnits(withdrawAmount, 6);
      const { handle, inputProof } = await fhe.encryptUint64(vault, amount);
      await writeContractAsync({
        address: vault,
        abi: vaultAbi,
        functionName: "withdraw",
        args: [handle, inputProof],
      });
      setStatus({
        kind: "ok",
        text: "Withdraw submitted (no lockup — works even during an active draw).",
      });
    });
  }

  async function onDecryptPosition() {
    if (!vault || !tickets || !address || !fhe.ready) return;
    await withBusy("User-decrypt (EIP-712 permit)…", async () => {
      const balHandle = (await readHandle(vault, "getBalance")) as Hex;
      const twabHandle = (await readHandle(vault, "getTwab")) as Hex;
      const bal = await fhe.userDecryptEuint64(balHandle, vault);
      const tw = await fhe.userDecryptEuint64(twabHandle, vault);
      setBalance(bal);
      setTwab(tw);

      if (ticketIndex && ticketIndex > 0n) {
        const { createPublicClient, http } = await import("viem");
        const { activeChain } = await import("@/lib/config");
        const client = createPublicClient({
          chain: activeChain,
          transport: http(process.env.NEXT_PUBLIC_RPC_URL),
        });
        const weightHandle = (await client.readContract({
          address: tickets,
          abi: ticketEngineAbi,
          functionName: "getWeight",
          args: [ticketIndex],
          account: address,
        })) as Hex;
        const w = await fhe.userDecryptEuint64(weightHandle, tickets);
        setWeight(w);
      } else {
        setWeight(0n);
      }

      setStatus({ kind: "ok", text: "Position decrypted client-side only." });
    });
  }

  async function readHandle(contract: `0x${string}`, fn: "getBalance" | "getTwab"): Promise<Hex> {
    const { createPublicClient, http } = await import("viem");
    const { activeChain } = await import("@/lib/config");
    const client = createPublicClient({
      chain: activeChain,
      transport: http(process.env.NEXT_PUBLIC_RPC_URL),
    });
    return (await client.readContract({
      address: contract,
      abi: vaultAbi,
      functionName: fn,
      account: address,
    })) as Hex;
  }

  async function onCheckIfWon() {
    if (!draw || drawId === undefined) return;
    await withBusy("Checking draw…", async () => {
      await writeContractAsync({
        address: draw,
        abi: drawManagerAbi,
        functionName: "checkIfWon",
        args: [drawId],
      });
      await refetchChecked();
      setStatus({
        kind: "ok",
        text: "checkIfWon mined. Decrypt your pending prize to see the result (zero if you lost).",
      });
    });
  }

  async function onDecryptPrize() {
    if (!draw || !fhe.ready) return;
    await withBusy("Decrypting pending prize…", async () => {
      const { createPublicClient, http } = await import("viem");
      const { activeChain } = await import("@/lib/config");
      const client = createPublicClient({
        chain: activeChain,
        transport: http(process.env.NEXT_PUBLIC_RPC_URL),
      });
      const handle = (await client.readContract({
        address: draw,
        abi: drawManagerAbi,
        functionName: "getPendingPrize",
        account: address,
      })) as Hex;
      const value = await fhe.userDecryptEuint64(handle, draw);
      setPrize(value);
      setStatus({
        kind: "ok",
        text:
          value === 0n
            ? "Encrypted zero — you did not win this draw (or have not checked)."
            : "Prize decrypted. Amount stays private to this wallet.",
      });
    });
  }

  if (!isConnected) {
    return (
      <section className="panel">
        <p className="eyebrow private-tag">Private</p>
        <h2>Wallet required</h2>
        <p className="lede">Connect to decrypt your position and run deposit / withdraw / check flows.</p>
      </section>
    );
  }

  return (
    <section className="panel private-panel">
      <div className="panel-head">
        <p className="eyebrow private-tag">Private</p>
        <h2>Your confidential position</h2>
        <p className="lede">
          Decryption uses the Relayer SDK user-decrypt / EIP-712 permit flow — client-side only. Nothing
          here is readable without your signature.
        </p>
      </div>

      {!configured && (
        <p className="banner warn">Configure contract addresses in <code>.env.local</code> first.</p>
      )}
      {fhe.error && <p className="banner warn">FHE init: {fhe.error}</p>}

      <div className="stat-grid">
        <article className="stat private-surface">
          <h3>Balance</h3>
          <p className="stat-value mono">{balance === null ? "••••" : `${formatUnits(balance)} cUSDC`}</p>
        </article>
        <article className="stat private-surface">
          <h3>TWAB</h3>
          <p className="stat-value mono">{twab === null ? "••••" : formatUnits(twab)}</p>
        </article>
        <article className="stat private-surface">
          <h3>Ticket weight</h3>
          <p className="stat-value mono">{weight === null ? "••••" : weight.toString()}</p>
        </article>
        <article className="stat private-surface">
          <h3>Pending prize</h3>
          <p className="stat-value mono">{prize === null ? "••••" : formatUnits(prize)}</p>
        </article>
      </div>

      <div className="actions">
        <button type="button" className="btn" disabled={!privateReady || working} onClick={() => void onDecryptPosition()}>
          Decrypt position
        </button>
      </div>

      <div className="flow-card">
        <h3>1. Approve vault operator</h3>
        <p>
          Explicit step on the cUSDC asset — same shape as ERC-20 <code>approve</code>. Required before the
          vault can pull a deposit.
        </p>
        <p className="mono small">
          Status:{" "}
          {isOperator === undefined ? "…" : isOperator ? "Vault is operator" : "Not approved"}
        </p>
        <button
          type="button"
          className="btn secondary"
          disabled={!configured || !isConnected || working || Boolean(isOperator)}
          onClick={() => void onSetOperator()}
        >
          {isOperator ? "Operator set" : "setOperator(vault, …)"}
        </button>
      </div>

      <div className="flow-card">
        <h3>2. Deposit</h3>
        <p>Encrypts the amount for the vault, then calls <code>deposit</code>. Blocked until operator is set.</p>
        <label className="field">
          <span>Amount (cUSDC)</span>
          <input
            className="mono"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <button type="button" className="btn" disabled={!canDeposit || working} onClick={() => void onDeposit()}>
          Deposit
        </button>
      </div>

      <div className="flow-card">
        <h3>3. Withdraw</h3>
        <p>No lockup — available regardless of draw / freeze state. Oversized requests transfer encrypted zero.</p>
        <label className="field">
          <span>Amount (cUSDC)</span>
          <input
            className="mono"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <button
          type="button"
          className="btn"
          disabled={!privateReady || working}
          onClick={() => void onWithdraw()}
        >
          Withdraw
        </button>
      </div>

      <div className="flow-card">
        <h3>4. Check draw + claim (decrypt prize)</h3>
        <p>
          Pull-based <code>checkIfWon</code> for draw{" "}
          <span className="mono">#{drawId?.toString() ?? "—"}</span>. Revealed:{" "}
          {revealed ? "yes" : "no"}. Already checked: {hasChecked ? "yes" : "no"}.
        </p>
        <div className="row">
          <button
            type="button"
            className="btn"
            disabled={!configured || !revealed || Boolean(hasChecked) || working || drawId === undefined}
            onClick={() => void onCheckIfWon()}
          >
            checkIfWon()
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={!privateReady || working}
            onClick={() => void onDecryptPrize()}
          >
            Decrypt pending prize
          </button>
        </div>
        <p className="stat-note">
          There is no separate on-chain prize transfer yet — “claim” means decrypting your ACL-gated pending
          prize handle client-side.
        </p>
      </div>

      {(busy || status.text) && (
        <p className={`banner ${status.kind === "err" ? "warn" : status.kind === "ok" ? "ok" : ""}`}>
          {busy ?? status.text}
        </p>
      )}
    </section>
  );
}
