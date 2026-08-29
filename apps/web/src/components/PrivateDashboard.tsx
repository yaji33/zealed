"use client";

import ArrowDownwardOutlined from "@mui/icons-material/ArrowDownwardOutlined";
import ArrowUpwardOutlined from "@mui/icons-material/ArrowUpwardOutlined";
import RedeemOutlined from "@mui/icons-material/RedeemOutlined";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { addresses, contractsConfigured, OPERATOR_UNTIL } from "@/lib/config";
import { drawManagerAbi, erc7984Abi, ticketEngineAbi, vaultAbi } from "@/lib/abi/zealed";
import { useFhevm } from "@/lib/fhe";
import { DRAW_CHECK_GAS } from "@/lib/draw";
import { formatUnits, parseUnits } from "@/lib/format";
import { waitForOkTx } from "@/lib/waitForTx";
import { noticeFromWalletError } from "@/lib/walletError";
import { DrawCyclePanel } from "@/components/DrawCyclePanel";
import {
  bannerClass,
  bannerOkClass,
  bannerWarnClass,
  btnClass,
  btnSecondaryClass,
  actionCardClass,
  actionPanelClass,
  actionTabActiveClass,
  actionTabClass,
  actionTabListClass,
  fieldClass,
  ledeClass,
  monoClass,
  sectionTitleClass,
  statCardClass,
  statGridClass,
  statLabelClass,
  statNoteClass,
  statUnitClass,
  statValueClass,
} from "@/lib/uiClasses";
import type { Hex } from "viem";

type Status = { kind: "idle" | "ok" | "err" | "cancel"; text: string };
type ActionTab = "deposit" | "withdraw" | "claim";
type TabIcon = typeof ArrowDownwardOutlined;

const ACTION_TABS: { id: ActionTab; label: string; Icon: TabIcon }[] = [
  { id: "deposit", label: "Deposit", Icon: ArrowDownwardOutlined },
  { id: "withdraw", label: "Withdraw", Icon: ArrowUpwardOutlined },
  { id: "claim", label: "Claim", Icon: RedeemOutlined },
];

export function PrivateDashboard() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
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
  /** Off by default. build-brief §9 selective disclosure. */
  const [revealWinEnabled, setRevealWinEnabled] = useState(false);
  const [userTab, setUserTab] = useState<ActionTab | null>(null);

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
    query: { enabled: Boolean(draw), refetchInterval: 12_000 },
  });

  const { data: revealed } = useReadContract({
    address: draw,
    abi: drawManagerAbi,
    functionName: "revealed",
    query: { enabled: Boolean(draw), refetchInterval: 12_000 },
  });

  const { data: hasChecked, refetch: refetchChecked } = useReadContract({
    address: draw,
    abi: drawManagerAbi,
    functionName: "hasChecked",
    args: drawId !== undefined && address ? [drawId, address] : undefined,
    query: { enabled: Boolean(draw && address && drawId !== undefined) },
  });

  const { data: alreadyWinRevealed, refetch: refetchWinRevealed } = useReadContract({
    address: draw,
    abi: drawManagerAbi,
    functionName: "winRevealed",
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

  useEffect(() => {
    setPrize(null);
  }, [drawId]);

  const working = Boolean(busy) || txPending || txConfirming;

  const canDeposit = Boolean(isOperator && configured && isConnected);
  const vaultApproved = Boolean(isOperator);

  const privateReady = useMemo(
    () => isConnected && configured,
    [isConnected, configured],
  );

  const defaultReady =
    !draw ||
    (revealed !== undefined &&
      (!address || drawId === undefined || hasChecked !== undefined));
  const uncheckedSettledDraw = revealed === true && hasChecked === false;
  const defaultTab: ActionTab = uncheckedSettledDraw ? "claim" : "deposit";
  const activeTab: ActionTab | null = userTab ?? (defaultReady ? defaultTab : null);

  const positionDecrypted = balance !== null;

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
    if (!vault) return;
    await withBusy("Encrypting + depositing…", async () => {
      const amount = parseUnits(depositAmount, 6);
      const { handle, inputProof } = await fhe.encryptUint64(vault, amount);
      await writeContractAsync({
        address: vault,
        abi: vaultAbi,
        functionName: "deposit",
        args: [handle, inputProof],
      });
      setBalance(null);
      setTwab(null);
      setWeight(null);
      setStatus({ kind: "ok", text: "Deposit submitted. Decrypt your balance to refresh." });
    });
  }

  async function onWithdraw() {
    if (!vault) return;
    await withBusy("Encrypting + withdrawing…", async () => {
      const amount = parseUnits(withdrawAmount, 6);
      const { handle, inputProof } = await fhe.encryptUint64(vault, amount);
      await writeContractAsync({
        address: vault,
        abi: vaultAbi,
        functionName: "withdraw",
        args: [handle, inputProof],
      });
      setBalance(null);
      setTwab(null);
      setWeight(null);
      setStatus({
        kind: "ok",
        text: "Withdraw submitted. No lockup, even during a draw.",
      });
    });
  }

  async function onDecryptPosition() {
    if (!configured) {
      setStatus({ kind: "err", text: "Contract addresses are not configured." });
      return;
    }
    if (!vault || !tickets) {
      setStatus({ kind: "err", text: "Vault or ticket engine address is missing." });
      return;
    }
    if (!address) {
      setStatus({ kind: "err", text: "Connect a wallet first." });
      return;
    }

    await withBusy("Decrypting position…", async () => {
      const balHandle = (await readHandle(vault, "getBalance")) as Hex;
      const twabHandle = (await readHandle(vault, "getTwab")) as Hex;

      const toDecrypt: { handle: Hex; contractAddress: `0x${string}` }[] = [
        { handle: balHandle, contractAddress: vault },
        { handle: twabHandle, contractAddress: vault },
      ];

      let weightHandle: Hex | undefined;
      if (ticketIndex && ticketIndex > 0n) {
        const { createPublicClient, http } = await import("viem");
        const { activeChain } = await import("@/lib/wagmi.config");
        const client = createPublicClient({
          chain: activeChain,
          transport: http(process.env.NEXT_PUBLIC_RPC_URL),
        });
        weightHandle = (await client.readContract({
          address: tickets,
          abi: ticketEngineAbi,
          functionName: "getWeight",
          args: [ticketIndex],
          account: address,
        })) as Hex;
        toDecrypt.push({ handle: weightHandle, contractAddress: tickets });
      }

      // Relayer user-decrypt: one EIP-712 permit, then FHE decrypt of all handles.
      const decrypted = await fhe.userDecryptMany(toDecrypt);
      const bal = decrypted[balHandle] ?? 0n;
      const tw = decrypted[twabHandle] ?? 0n;
      setBalance(bal);
      setTwab(tw);
      setWeight(weightHandle ? (decrypted[weightHandle] ?? 0n) : 0n);

      if (bal === 0n && tw === 0n) {
        setStatus({
          kind: "ok",
          text: "Position unsealed. Balance is zero. Deposit to get tickets for the next draw.",
        });
      } else {
        setStatus({ kind: "ok", text: "Position unsealed on this device only." });
      }
    });
  }

  async function readHandle(contract: `0x${string}`, fn: "getBalance" | "getTwab"): Promise<Hex> {
    const { createPublicClient, http } = await import("viem");
    const { activeChain } = await import("@/lib/wagmi.config");
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

  async function decryptPendingPrize(): Promise<bigint> {
    if (!draw) throw new Error("Draw manager is not configured.");
    if (!publicClient) throw new Error("RPC client is not ready.");
    const handle = (await publicClient.readContract({
      address: draw,
      abi: drawManagerAbi,
      functionName: "getPendingPrize",
      account: address,
    })) as Hex;
    const value = await fhe.userDecryptEuint64(handle, draw);
    setPrize(value);
    return value;
  }

  async function onCheckIfWon() {
    if (!draw || drawId === undefined || !publicClient || !address) return;
    await withBusy("Checking draw…", async () => {
      const hash = await writeContractAsync({
        address: draw,
        abi: drawManagerAbi,
        functionName: "checkIfWon",
        args: [drawId],
        gas: DRAW_CHECK_GAS,
      });
      await waitForOkTx(publicClient, hash);
      await refetchChecked();
      setBusy("Reading prize…");
      const value = await decryptPendingPrize();
      setStatus({
        kind: "ok",
        text:
          value > 0n
            ? "You won this draw. The amount is only readable on this device."
            : "You did not win this draw. Your principal is unchanged.",
      });
    });
  }

  async function onDecryptPrize() {
    await withBusy("Reading prize…", async () => {
      const value = await decryptPendingPrize();
      setStatus({
        kind: "ok",
        text:
          value > 0n
            ? "You won this draw. The amount is only readable on this device."
            : "You did not win this draw. Your principal is unchanged.",
      });
    });
  }

  async function onRevealWin() {
    if (!draw || drawId === undefined || !address) return;
    await withBusy("Publishing win (tier only)…", async () => {
      const fheInstance = fhe.instance ?? (await fhe.initIfNeeded());
      const { createPublicClient, http } = await import("viem");
      const { activeChain } = await import("@/lib/wagmi.config");
      const client = createPublicClient({
        chain: activeChain,
        transport: http(process.env.NEXT_PUBLIC_RPC_URL),
      });
      const handle = (await client.readContract({
        address: draw,
        abi: drawManagerAbi,
        functionName: "getWonFlag",
        args: [drawId, address],
      })) as Hex;

      if (!handle || /^0x0+$/.test(handle)) {
        throw new Error("No win flag. Call Check if I won first.");
      }

      const decrypted = await fheInstance.publicDecrypt([handle]);
      const clear = decrypted.clearValues[handle] as unknown;
      const won = clear === true || clear === 1n || clear === 1 || clear === "true" || clear === "1";
      if (!won) {
        throw new Error("Win flag is false. Only winners can publish.");
      }

      await writeContractAsync({
        address: draw,
        abi: drawManagerAbi,
        functionName: "revealWin",
        args: [drawId, true, decrypted.decryptionProof as Hex],
      });
      await refetchWinRevealed();
      setStatus({
        kind: "ok",
        text: "Published WinRevealed (tier only). Prize amount was not disclosed.",
      });
    });
  }

  if (!isConnected) {
    return null;
  }

  const statusBannerClass =
    status.kind === "err"
      ? bannerWarnClass
      : status.kind === "ok"
        ? bannerOkClass
        : bannerClass;

  function selectTab(next: ActionTab) {
    setUserTab(next);
  }

  function onTabListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!activeTab) return;
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const index = ACTION_TABS.findIndex((tab) => tab.id === activeTab);
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = ACTION_TABS[(index + delta + ACTION_TABS.length) % ACTION_TABS.length];
    selectTab(next.id);
    event.currentTarget.querySelector<HTMLButtonElement>(`#action-tab-${next.id}`)?.focus();
  }

  return (
    <section>
      <div className="relative">
        <h2 className={sectionTitleClass}>Your confidential position</h2>
        <p className={`${ledeClass} mt-2`}>
          Unseal with your wallet. Nothing here is readable without your signature.
        </p>
      </div>

      {!configured && (
        <p className={bannerWarnClass}>
          Set contract addresses in <code>.env.local</code> first.
        </p>
      )}
      {fhe.error && <p className={bannerWarnClass}>Could not start encryption: {fhe.error}</p>}

      <div className={statGridClass}>
        <article className={statCardClass}>
          <h3 className={statLabelClass}>Balance</h3>
          <p className={statValueClass}>
            {balance === null ? (
              "••••"
            ) : (
              <>
                {formatUnits(balance)}
                <span className={statUnitClass}>cUSDC</span>
              </>
            )}
          </p>
        </article>
        <article className={statCardClass}>
          <h3 className={statLabelClass}>TWAB</h3>
          <p className={statValueClass}>
            {twab === null ? "••••" : formatUnits(twab)}
          </p>
        </article>
        <article className={statCardClass}>
          <h3 className={statLabelClass}>Ticket weight</h3>
          <p className={statValueClass}>
            {weight === null ? "••••" : weight.toString()}
          </p>
        </article>
        <article className={statCardClass}>
          <h3 className={statLabelClass}>Pending prize</h3>
          <p className={statValueClass}>
            {prize === null ? "••••" : formatUnits(prize)}
            {prize !== null ? <span className={statUnitClass}>cUSDC</span> : null}
          </p>
        </article>
      </div>

      <div className="relative my-3 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          className={btnClass}
          disabled={!privateReady || working || positionDecrypted}
          onClick={() => void onDecryptPosition()}
        >
          {busy === "Decrypting position…"
            ? "Decrypting…"
            : positionDecrypted
              ? "Decrypted"
              : "Decrypt position"}
        </button>
      </div>
      {(busy || status.text) && (
        <p className={`${statusBannerClass} mt-0 mb-4`}>{busy ?? status.text}</p>
      )}

      <div className={actionCardClass}>
        <div
          role="tablist"
          aria-label="Position actions"
          className={actionTabListClass}
          onKeyDown={onTabListKeyDown}
        >
          {ACTION_TABS.map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`action-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`action-panel-${tab.id}`}
                tabIndex={selected || (activeTab === null && tab.id === "deposit") ? 0 : -1}
                className={`${actionTabClass} ${selected ? actionTabActiveClass : ""}`}
                onClick={() => selectTab(tab.id)}
              >
                <tab.Icon
                  aria-hidden="true"
                  className="shrink-0"
                  htmlColor="currentColor"
                  style={{ fontSize: 17 }}
                />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === null && (
          <div className={actionPanelClass}>
            <p className="!mb-0">Loading…</p>
          </div>
        )}

        <div
          id="action-panel-deposit"
          role="tabpanel"
          aria-labelledby="action-tab-deposit"
          hidden={activeTab !== "deposit"}
          className={`${actionPanelClass} ${activeTab === "deposit" ? "" : "hidden"}`}
        >
          {vaultApproved ? (
            <>
              <div className="mb-4 flex h-5 items-center gap-2 whitespace-nowrap text-[0.82rem] leading-none text-muted">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-ok" aria-hidden="true">
                  <path
                    d="M3.5 8.5 6.5 11.5 12.5 4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Vault approved
              </div>
              <p>Your amount is encrypted before it reaches the contract.</p>
              <label className={fieldClass}>
                <span>Amount (cUSDC)</span>
                <input
                  className={monoClass}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  inputMode="decimal"
                />
              </label>
              <button
                type="button"
                className={btnClass}
                disabled={!canDeposit || working}
                onClick={() => void onDeposit()}
              >
                Deposit
              </button>
            </>
          ) : (
            <>
              <h3>Approve the vault</h3>
              <p>Allow the vault to move your cUSDC before you deposit.</p>
              <button
                type="button"
                className={btnSecondaryClass}
                disabled={!configured || !isConnected || working || isOperator === undefined}
                onClick={() => void onSetOperator()}
              >
                Approve vault
              </button>
            </>
          )}
        </div>

        <div
          id="action-panel-withdraw"
          role="tabpanel"
          aria-labelledby="action-tab-withdraw"
          hidden={activeTab !== "withdraw"}
          className={`${actionPanelClass} ${activeTab === "withdraw" ? "" : "hidden"}`}
        >
          <p>No lockup. You can withdraw anytime, including during a draw.</p>
          <label className={fieldClass}>
            <span>Amount (cUSDC)</span>
            <input
              className={monoClass}
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <button
            type="button"
            className={btnClass}
            disabled={!privateReady || working}
            onClick={() => void onWithdraw()}
          >
            Withdraw
          </button>
        </div>

        <div
          id="action-panel-claim"
          role="tabpanel"
          aria-labelledby="action-tab-claim"
          hidden={activeTab !== "claim"}
          className={`relative flex flex-col gap-6 p-5 ${activeTab === "claim" ? "" : "hidden"}`}
        >
          <DrawCyclePanel />
          {revealed ? (
            <div className="flex flex-col gap-4 border-t border-line pt-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="m-0 font-mono text-[0.68rem] tracking-[0.18em] text-ember/75">
                    THIS DRAW
                  </p>
                  <p className="m-0 mt-2 font-dm-sans text-[1.15rem] font-medium text-ink">
                    {hasChecked && prize !== null
                      ? prize > 0n
                        ? `You won draw #${drawId?.toString() ?? ""}`
                        : `No prize on draw #${drawId?.toString() ?? ""}`
                      : ticketIndex === 0n
                        ? "Deposit to get a ticket"
                        : `Draw #${drawId?.toString() ?? "…"} sealed`}
                  </p>
                </div>
                {!hasChecked && ticketIndex !== undefined && ticketIndex > 0n ? (
                  <button
                    type="button"
                    className={btnClass}
                    disabled={
                      !configured ||
                      !revealed ||
                      working ||
                      drawId === undefined ||
                      !ticketIndex
                    }
                    onClick={() => void onCheckIfWon()}
                  >
                    See if I won
                  </button>
                ) : hasChecked && prize === null ? (
                  <button
                    type="button"
                    className={btnClass}
                    disabled={!privateReady || working}
                    onClick={() => void onDecryptPrize()}
                  >
                    Reveal result
                  </button>
                ) : null}
              </div>
              {hasChecked && prize !== null && prize > 0n ? (
                alreadyWinRevealed ? (
                  <p className="m-0 text-[0.88rem] text-muted">Win published (tier only)</p>
                ) : (
                  <label className="m-0 flex items-center gap-3 text-[0.88rem] text-muted">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 shrink-0 accent-mint"
                      checked={revealWinEnabled}
                      onChange={(e) => setRevealWinEnabled(e.target.checked)}
                    />
                    <span>Publish win (tier only)</span>
                    <button
                      type="button"
                      className={btnSecondaryClass}
                      disabled={!revealWinEnabled || !configured || working || drawId === undefined}
                      onClick={() => void onRevealWin()}
                    >
                      Publish
                    </button>
                  </label>
                )
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

    </section>
  );
}
