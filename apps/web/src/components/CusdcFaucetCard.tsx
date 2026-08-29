"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { useWrappedCusdc, wrappedCusdcQueryKey } from "@/hooks/useWrappedCusdc";
import { addresses, faucetConfigured } from "@/lib/addresses";
import { erc7984Abi, underlyingErc20Abi } from "@/lib/abi/zealed";
import { formatUnits, parseUnits } from "@/lib/format";
import { noticeFromWalletError, type AppNotice } from "@/lib/walletError";
import {
  bannerClass,
  bannerOkClass,
  bannerWarnClass,
  btnClass,
  btnSecondaryClass,
  cardClass,
  fieldClass,
  ledeClass,
  monoClass,
  sectionTitleClass,
  statLabelClass,
  statNoteClass,
  statValueClass,
  statUnitClass,
} from "@/lib/uiClasses";

/** Default faucet size in cUSDC units (6 decimals). Under Zama's 1M public mint cap. */
const DEFAULT_CUSDC_UNITS = 10_000_000n; // 10 cUSDC

type FaucetStep = "mint" | "approve" | "wrap";
type StepState = "complete" | "current" | "locked";

/**
 * Mint mock USDC → approve cUSDCMock wrapper → wrap to cUSDC.
 * Addresses from smoke-sepolia.ts / Zama Sepolia protocol-apps docs.
 */
export function CusdcFaucetCard() {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();
  const underlying = addresses.underlying;
  const wrapper = addresses.asset;
  const configured = faucetConfigured();

  const [wrapInput, setWrapInput] = useState("10");
  const [activeStep, setActiveStep] = useState<FaucetStep | null>(null);
  const [stepNotice, setStepNotice] = useState<AppNotice | null>(null);
  const [stepOk, setStepOk] = useState<string | null>(null);
  const [confirmedAllowance, setConfirmedAllowance] = useState(0n);
  const [confirmedWrapped, setConfirmedWrapped] = useState(0n);
  const pendingApproveAmount = useRef(0n);
  const pendingWrapAmount = useRef(0n);
  const handledTx = useRef<`0x${string}` | undefined>(undefined);

  const { writeContractAsync, data: txHash, isPending: txPending, reset } = useWriteContract();
  const { isLoading: txConfirming, isSuccess: txSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });
  const working = txPending || txConfirming;
  const minting = activeStep === "mint" && working;

  const { data: rate } = useReadContract({
    address: wrapper,
    abi: erc7984Abi,
    functionName: "rate",
    query: { enabled: Boolean(wrapper) },
  });

  const { data: underlyingBalance, refetch: refetchUnderlyingBalance } = useReadContract({
    address: underlying,
    abi: underlyingErc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(underlying && address) },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: underlying,
    abi: underlyingErc20Abi,
    functionName: "allowance",
    args: address && wrapper ? [address, wrapper] : undefined,
    query: { enabled: Boolean(underlying && wrapper && address) },
  });

  const {
    wrappedCusdc,
    isLoading: wrappedLoading,
    refetch: refetchWrapped,
  } = useWrappedCusdc();

  const mintAmount = useMemo(() => {
    const r = rate ?? 1n;
    return DEFAULT_CUSDC_UNITS * r;
  }, [rate]);

  const wrapAmount = useMemo(() => {
    try {
      return parseUnits(wrapInput || "0", 6);
    } catch {
      return 0n;
    }
  }, [wrapInput]);

  const hasUnderlying = (underlyingBalance ?? 0n) > 0n;
  const displayWrapped = wrappedCusdc > confirmedWrapped ? wrappedCusdc : confirmedWrapped;
  const hasWrapped = displayWrapped > 0n;
  const wrapOpen = hasUnderlying || activeStep === "wrap";
  const effectiveAllowance =
    (allowance ?? 0n) > confirmedAllowance ? (allowance ?? 0n) : confirmedAllowance;
  const approvedEnough = wrapAmount > 0n && effectiveAllowance >= wrapAmount;
  const minted = hasUnderlying || hasWrapped;

  useEffect(() => {
    setConfirmedAllowance(0n);
    setConfirmedWrapped(0n);
    handledTx.current = undefined;
  }, [address]);

  useEffect(() => {
    if (!approvedEnough) setStepOk((text) => (text === "Wrapper approved." ? null : text));
  }, [approvedEnough]);

  const mintState: StepState =
    activeStep === "mint" ? "current" : minted ? "complete" : "current";
  const approveState: StepState =
    activeStep === "approve"
      ? "current"
      : !hasUnderlying
        ? hasWrapped
          ? "complete"
          : "locked"
        : approvedEnough
          ? "complete"
          : "current";
  const wrapState: StepState =
    activeStep === "wrap"
      ? "current"
      : hasWrapped && !hasUnderlying
        ? "complete"
        : !wrapOpen
          ? "locked"
          : approvedEnough
            ? "current"
            : "locked";

  useEffect(() => {
    if (!txSuccess || !activeStep || !txHash) return;
    if (handledTx.current === txHash) return;
    handledTx.current = txHash;
    const step = activeStep;
    void (async () => {
      if (step === "mint") {
        const balanceResult = await refetchUnderlyingBalance();
        await refetchAllowance();
        const bal = (balanceResult.data as bigint | undefined) ?? 0n;
        setWrapInput(formatUnits(bal > 0n ? bal : mintAmount, 6));
        setStepOk(`Minted ${formatUnits(mintAmount, 6)} USDC.`);
      } else if (step === "approve") {
        await refetchAllowance();
        setConfirmedAllowance((prev) =>
          pendingApproveAmount.current > prev ? pendingApproveAmount.current : prev,
        );
        setStepOk("Wrapper approved.");
      } else if (step === "wrap") {
        const added = pendingWrapAmount.current;
        const divisor = rate && rate > 0n ? rate : 1n;
        setConfirmedWrapped((prev) => prev + added / divisor);
        queryClient.setQueryData(
          wrappedCusdcQueryKey(address),
          (old: bigint | undefined) => (old ?? 0n) + added,
        );
        setWrapInput("10");
        setStepOk("Wrapped to cUSDC. Approve the vault, then deposit.");
        void refetchUnderlyingBalance();
        void refetchAllowance();
        void refetchWrapped();
      }
      setActiveStep(null);
      reset();
    })();
  }, [
    txSuccess,
    txHash,
    activeStep,
    address,
    mintAmount,
    rate,
    queryClient,
    refetchUnderlyingBalance,
    refetchAllowance,
    refetchWrapped,
    reset,
  ]);

  if (!isConnected) return null;

  function labelFor(step: FaucetStep, idle: string): string {
    if (activeStep !== step || !working) return idle;
    if (txPending) return "Confirm in wallet…";
    return "Waiting for confirmation…";
  }

  async function onMint() {
    if (!underlying || !address) return;
    setStepNotice(null);
    setStepOk(null);
    setActiveStep("mint");
    try {
      await writeContractAsync({
        address: underlying,
        abi: underlyingErc20Abi,
        functionName: "mint",
        args: [address, mintAmount],
      });
    } catch (err) {
      setActiveStep(null);
      setStepNotice(noticeFromWalletError(err, "Mint failed"));
    }
  }

  async function onApprove() {
    if (!underlying || !wrapper) return;
    const amount =
      (underlyingBalance ?? 0n) > wrapAmount
        ? (underlyingBalance ?? 0n)
        : wrapAmount > 0n
          ? wrapAmount
          : mintAmount;
    if (amount <= 0n) return;
    pendingApproveAmount.current = amount;
    setStepNotice(null);
    setStepOk(null);
    setActiveStep("approve");
    try {
      await writeContractAsync({
        address: underlying,
        abi: underlyingErc20Abi,
        functionName: "approve",
        args: [wrapper, amount],
      });
    } catch (err) {
      setActiveStep(null);
      setStepNotice(noticeFromWalletError(err, "Approve failed"));
    }
  }

  async function onWrap() {
    if (!wrapper || !address || wrapAmount <= 0n) return;
    pendingWrapAmount.current = wrapAmount;
    setStepNotice(null);
    setStepOk(null);
    setActiveStep("wrap");
    try {
      await writeContractAsync({
        address: wrapper,
        abi: erc7984Abi,
        functionName: "wrap",
        args: [address, wrapAmount],
      });
    } catch (err) {
      setActiveStep(null);
      setStepNotice(noticeFromWalletError(err, "Wrap failed"));
    }
  }

  const flowLine = flowStatus({
    working,
    activeStep,
    mintState,
    approveState,
    wrapState,
  });

  const wrappedDisplay =
    !configured || (wrappedLoading && displayWrapped === 0n) ? "…" : null;

  return (
    <section className={cardClass}>
      <h2 className={sectionTitleClass}>Get cUSDC</h2>
      <p className={`${ledeClass} mt-2`}>
        Mint test USDC and wrap it into cUSDC, so you can deposit.
      </p>

      {!configured && (
        <p className={bannerWarnClass}>
          Set the wrapper and underlying addresses in <code>.env.local</code> first.
        </p>
      )}

      <div className="relative mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-stretch lg:gap-12">
        <ol className="relative m-0 list-none p-0">
          <FaucetStepRow
            index={1}
            title="Mint USDC"
            state={mintState}
            connectNext={approveState !== "locked" || mintState === "complete"}
          >
            <p>Public mint on the Zama Sepolia mock USDC.</p>
            <p className={`${monoClass} text-[0.85rem]`}>
              Balance:{" "}
              {underlyingBalance === undefined
                ? "…"
                : `${formatUnits(underlyingBalance, 6)} USDC`}
            </p>
            <button
              type="button"
              className={mintState === "complete" ? btnSecondaryClass : btnClass}
              disabled={working || !configured}
              onClick={() => void onMint()}
            >
              {labelFor("mint", mintState === "complete" ? "Mint more" : "Mint USDC")}
            </button>
            {minting && (
              <p className="sr-only" aria-live="polite">
                Minting USDC
              </p>
            )}
          </FaucetStepRow>

          <FaucetStepRow
            index={2}
            title="Approve"
            state={approveState}
            interactive={minted}
            connectNext={wrapOpen || wrapState === "complete"}
          >
            <p>
              {approveState === "locked"
                ? "Unlocks after you mint."
                : "Allow the wrapper to pull the USDC you minted."}
            </p>
            <p className={`${monoClass} text-[0.85rem]`}>
              Status:{" "}
              {allowance === undefined ? "…" : approvedEnough ? "Approved" : "Not approved"}
            </p>
            <button
              type="button"
              className={btnSecondaryClass}
              disabled={working || approveState === "locked" || approvedEnough || !configured}
              onClick={() => void onApprove()}
            >
              {approvedEnough ? "Approved" : labelFor("approve", "Approve wrapper")}
            </button>
          </FaucetStepRow>

          <FaucetStepRow
            index={3}
            title="Wrap to cUSDC"
            state={wrapState}
            interactive={wrapOpen}
            connectNext={false}
          >
            <p>
              {wrapState === "locked"
                ? "Unlocks after you mint."
                : wrapState === "complete"
                  ? "Ready when you mint more USDC."
                  : "Convert approved USDC into confidential cUSDC."}
            </p>
            <p className={`${monoClass} text-[0.85rem]`}>
              Status: {hasWrapped ? "Wrapped" : "Not wrapped yet"}
            </p>
            <label className={fieldClass}>
              <span>Amount (USDC)</span>
              <input
                className={monoClass}
                value={wrapInput}
                onChange={(e) => setWrapInput(e.target.value)}
                inputMode="decimal"
                disabled={working || !wrapOpen}
              />
            </label>
            <button
              type="button"
              className={hasWrapped && !hasUnderlying ? btnSecondaryClass : btnClass}
              disabled={
                working ||
                !hasUnderlying ||
                !approvedEnough ||
                wrapAmount <= 0n ||
                !configured
              }
              onClick={() => void onWrap()}
            >
              {labelFor("wrap", hasWrapped ? "Wrap more" : "Wrap to cUSDC")}
            </button>
          </FaucetStepRow>
        </ol>

        <aside className="relative flex flex-col items-center justify-center rounded-lg border border-edge bg-base px-6 py-8 text-center">
          <p
            className="relative m-0 font-dm-sans text-[1.2rem] font-medium text-ink"
            aria-live="polite"
          >
            {flowLine}
          </p>
          <p className={`${statLabelClass} mt-8`}>Wrapped</p>
          <p className={statValueClass}>
            {wrappedDisplay ?? (
              <>
                {formatUnits(displayWrapped)}
                <span className={statUnitClass}>cUSDC</span>
              </>
            )}
          </p>
          <p className={statNoteClass}>Lifetime wrap for this wallet.</p>
        </aside>
      </div>

      {stepOk && <p className={bannerOkClass}>{stepOk}</p>}
      {stepNotice && (
        <p className={stepNotice.kind === "err" ? bannerWarnClass : bannerClass}>{stepNotice.text}</p>
      )}
    </section>
  );
}

function FaucetStepRow({
  index,
  title,
  state,
  connectNext,
  interactive = false,
  children,
}: {
  index: number;
  title: string;
  state: StepState;
  connectNext: boolean;
  interactive?: boolean;
  children: ReactNode;
}) {
  const dimmed = state === "locked" && !interactive;
  const current = state === "current";

  return (
    <li
      className={`relative flex gap-4 transition-opacity duration-300 ${
        dimmed ? "opacity-40" : "opacity-100"
      }`}
      aria-current={current ? "step" : undefined}
    >
      <div className="flex w-8 shrink-0 flex-col items-center">
        <StepMarker index={index} state={state} />
        {index < 3 && (
          <div className="relative mt-1.5 w-0.5 flex-1 min-h-[2.75rem] bg-line/30">
            <span
              className={`absolute inset-x-0 top-0 w-0.5 bg-mint transition-all duration-500 ${
                connectNext ? "h-full" : "h-0"
              }`}
              aria-hidden="true"
            />
          </div>
        )}
      </div>
      <div
        className={`min-w-0 flex-1 ${index < 3 ? "pb-9" : "pb-0"} [&_p]:relative [&_p]:mb-3 [&_p]:mt-0 [&_p]:text-[0.88rem] [&_p]:leading-relaxed [&_p]:text-muted`}
      >
        <h3 className="relative mb-1 mt-0.5 font-dm-sans text-[1.1rem] font-medium text-ink">
          {title}
        </h3>
        <fieldset disabled={dimmed} className="m-0 min-w-0 border-0 p-0">
          {children}
        </fieldset>
      </div>
    </li>
  );
}

function StepMarker({ index, state }: { index: number; state: StepState }) {
  if (state === "complete") {
    return (
      <span className="relative z-[1] grid h-8 w-8 place-items-center rounded-full bg-ok text-void">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            d="M3.5 8.5 6.5 11.5 12.5 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="sr-only">Step {index} complete</span>
      </span>
    );
  }

  if (state === "current") {
    return (
      <span className="relative z-[1] grid h-8 w-8 place-items-center rounded-full bg-mint font-mono text-[0.78rem] font-medium text-void shadow-[0_0_0_4px_rgba(184,245,230,0.14)]">
        {index}
        <span className="sr-only">Current step</span>
      </span>
    );
  }

  return (
    <span className="relative z-[1] grid h-8 w-8 place-items-center rounded-full border border-line/50 bg-base font-mono text-[0.78rem] text-muted">
      {index}
      <span className="sr-only">Step {index} locked</span>
    </span>
  );
}

function flowStatus({
  working,
  activeStep,
  mintState,
  approveState,
  wrapState,
}: {
  working: boolean;
  activeStep: FaucetStep | null;
  mintState: StepState;
  approveState: StepState;
  wrapState: StepState;
}): string {
  if (working && activeStep === "mint") return "Minting";
  if (working && activeStep === "approve") return "Waiting for approval";
  if (working && activeStep === "wrap") return "Wrapping";
  if (wrapState === "complete") return "Wrapped";
  if (wrapState === "current") return "Ready to wrap";
  if (approveState === "current") return "Waiting for approval";
  if (mintState === "current") return "Ready to mint";
  return "Ready to mint";
}
