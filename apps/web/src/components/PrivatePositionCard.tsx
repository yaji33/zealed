"use client";

import { useEffect, useState } from "react";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import SouthWestIcon from "@mui/icons-material/SouthWest";
import NorthEastIcon from "@mui/icons-material/NorthEast";
import VerifiedIcon from "@mui/icons-material/Verified";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import type { Hex } from "viem";
import { AppIcon } from "@/components/AppIcon";
import { ExplorerTxLink } from "@/components/ExplorerTxLink";
import { useVaultDirectory } from "@/components/VaultDirectoryProvider";
import { useFhevm } from "@/lib/fhe";
import { OPERATOR_UNTIL } from "@/lib/config";
import { erc7984Abi, ticketEngineAbi, vaultAbi } from "@/lib/abi/zealed";
import { formatUnits, parseUnits } from "@/lib/format";
import { waitForOkTx } from "@/lib/waitForTx";
import { noticeFromWalletError } from "@/lib/walletError";
import {
  bannerClass,
  bannerOkClass,
  bannerWarnClass,
  btnClass,
  btnSecondaryClass,
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

type Notice = { kind: "idle" | "ok" | "err" | "cancel"; text: string };

export function PrivatePositionCard() {
  const { address } = useAccount();
  const client = usePublicClient();
  const fhe = useFhevm();
  const { writeContractAsync, data: txHash } = useWriteContract();
  const [amount, setAmount] = useState("1");
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>({ kind: "idle", text: "" });
  const [balance, setBalance] = useState<bigint | null>(null);
  const [twab, setTwab] = useState<bigint | null>(null);
  const [weight, setWeight] = useState<bigint | null>(null);
  const { selected } = useVaultDirectory();
  const vault = selected?.vault;
  const asset = selected?.asset;
  const ticketEngine = selected?.ticketEngine;
  const assetLabel = selected?.label ?? "confidential token";

  const { data: isOperator, refetch: refetchOperator } = useReadContract({
    address: asset,
    abi: erc7984Abi,
    functionName: "isOperator",
    args: address && vault ? [address, vault] : undefined,
    query: {
      enabled: Boolean(address && asset && vault),
      refetchInterval: 12_000,
    },
  });
  const { data: assetDecimals } = useReadContract({
    address: asset,
    abi: erc7984Abi,
    functionName: "decimals",
    query: { enabled: Boolean(asset) },
  });
  const { data: ticketIndex } = useReadContract({
    address: ticketEngine,
    abi: ticketEngineAbi,
    functionName: "indexOf",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address && ticketEngine),
      refetchInterval: 12_000,
    },
  });

  useEffect(() => {
    setBalance(null);
    setTwab(null);
    setWeight(null);
  }, [address, vault]);

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setNotice({ kind: "idle", text: "" });
    try {
      await action();
    } catch (error) {
      const safe = noticeFromWalletError(
        error,
        "The action could not be completed.",
      );
      setNotice({ kind: safe.kind, text: safe.text });
    } finally {
      setBusy(null);
    }
  }

  async function approveVault() {
    if (!asset || !vault || !client) return;
    await run("Approving vault…", async () => {
      const hash = await writeContractAsync({
        address: asset,
        abi: erc7984Abi,
        functionName: "setOperator",
        args: [vault, OPERATOR_UNTIL],
      });
      await waitForOkTx(client, hash);
      await refetchOperator();
      setNotice({
        kind: "ok",
        text: `Vault approved for confidential ${assetLabel} deposits.`,
      });
    });
  }

  async function submitAmount() {
    if (!vault || !client) return;
    await run(
      mode === "deposit" ? "Encrypting deposit…" : "Encrypting withdrawal…",
      async () => {
        const parsed = parseUnits(amount, assetDecimals ?? 6);
        if (parsed <= 0n) throw new Error("Enter an amount greater than zero.");
        const encrypted = await fhe.encryptUint64(vault, parsed);
        const hash = await writeContractAsync({
          address: vault,
          abi: vaultAbi,
          functionName: mode,
          args: [encrypted.handle, encrypted.inputProof],
        });
        await waitForOkTx(client, hash);
        setBalance(null);
        setTwab(null);
        setWeight(null);
        setNotice({
          kind: "ok",
          text:
            mode === "deposit"
              ? "Deposit confirmed. Decrypt your position to refresh it."
              : "Withdrawal confirmed. Principal is never locked by the draw cycle.",
        });
      },
    );
  }

  async function decryptPosition() {
    if (!vault || !ticketEngine || !client || !address) return;
    await run("Decrypting position…", async () => {
      const [balanceHandle, twabHandle] = await Promise.all([
        client.readContract({
          address: vault,
          abi: vaultAbi,
          functionName: "getBalance",
          account: address,
        }),
        client.readContract({
          address: vault,
          abi: vaultAbi,
          functionName: "getTwab",
          account: address,
        }),
      ]);
      const decryptItems: { handle: Hex; contractAddress: `0x${string}` }[] = [
        { handle: balanceHandle, contractAddress: vault },
        { handle: twabHandle, contractAddress: vault },
      ];
      let weightHandle: Hex | undefined;
      if (ticketIndex !== undefined && ticketIndex > 0n) {
        weightHandle = await client.readContract({
          address: ticketEngine,
          abi: ticketEngineAbi,
          functionName: "getWeight",
          args: [ticketIndex],
          account: address,
        });
        decryptItems.push({
          handle: weightHandle,
          contractAddress: ticketEngine,
        });
      }
      const result = await fhe.userDecryptMany(decryptItems);
      setBalance(result[balanceHandle] ?? 0n);
      setTwab(result[twabHandle] ?? 0n);
      setWeight(weightHandle ? (result[weightHandle] ?? 0n) : 0n);
      setNotice({
        kind: "ok",
        text: "Position decrypted locally for this wallet session.",
      });
    });
  }

  const configured = Boolean(selected);
  const noticeClass =
    notice.kind === "ok"
      ? bannerOkClass
      : notice.kind === "cancel"
        ? bannerClass
        : bannerWarnClass;

  return (
    <section aria-labelledby="position-title">
      <h2 id="position-title" className={sectionTitleClass}>
        Your private position
      </h2>
      <p className={`${ledeClass} mt-2`}>
        Your wallet decrypts this. Nobody else can.
      </p>
      <div className={statGridClass}>
        {[
          ["Balance", balance, assetLabel, assetDecimals ?? 6],
          ["TWAB", twab, assetLabel, assetDecimals ?? 6],
          ["Ticket weight", weight, "", 6],
        ].map(([label, value, unit, decimals]) => (
          <article key={String(label)} className={statCardClass}>
            <h3 className={statLabelClass}>{String(label)}</h3>
            <p className={statValueClass}>
              {value === null
                ? "••••"
                : formatUnits(value as bigint, decimals as number)}
              {value !== null && unit ? (
                <span className={statUnitClass}>{String(unit)}</span>
              ) : null}
            </p>
            <p className={statNoteClass}>
              {value === null ? "Encrypted" : "Decrypted on this device"}
            </p>
          </article>
        ))}
      </div>
      <button
        type="button"
        className={btnClass}
        disabled={!configured || Boolean(busy) || balance !== null}
        onClick={() => void decryptPosition()}
      >
        <AppIcon
          icon={balance !== null ? LockOpenIcon : LockIcon}
          size={16}
        />
        {busy === "Decrypting position…"
          ? "Decrypting…"
          : balance !== null
            ? "Position decrypted"
            : "Decrypt position"}
      </button>

      <div className="mt-6 rounded-lg border border-edge bg-surface p-5">
        <div
          className="mb-4 flex gap-2"
          role="group"
          aria-label="Position transaction"
        >
          {(["deposit", "withdraw"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={mode === item ? btnClass : btnSecondaryClass}
              aria-pressed={mode === item}
              onClick={() => setMode(item)}
            >
              <AppIcon
                icon={item === "deposit" ? SouthWestIcon : NorthEastIcon}
                size={16}
              />
              {item === "deposit" ? "Deposit" : "Withdraw"}
            </button>
          ))}
        </div>
        {mode === "deposit" && !isOperator ? (
          <>
            <p className={ledeClass}>Approve the vault before your first deposit.</p>
            <button
              type="button"
              className={`${btnSecondaryClass} mt-3`}
              disabled={
                !configured || Boolean(busy) || isOperator === undefined
              }
              onClick={() => void approveVault()}
            >
              <AppIcon icon={VerifiedIcon} size={16} />
              {busy === "Approving vault…" ? "Approving…" : "Approve vault"}
            </button>
          </>
        ) : (
          <>
            <p className={ledeClass}>
              {mode === "deposit"
                ? "The amount is encrypted before submission."
                : "Withdraw any time. Draws cannot block it."}
            </p>
            <label className={`${fieldClass} mt-4`}>
              <span>Amount ({assetLabel})</span>
              <input
                className={monoClass}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
              />
            </label>
            <button
              type="button"
              className={btnClass}
              disabled={!configured || Boolean(busy)}
              onClick={() => void submitAmount()}
            >
              <AppIcon
                icon={mode === "deposit" ? SouthWestIcon : NorthEastIcon}
                size={16}
              />
              {busy ??
                (mode === "deposit"
                  ? "Deposit privately"
                  : "Withdraw privately")}
            </button>
          </>
        )}
        {notice.kind !== "idle" ? (
          <p className={noticeClass}>{notice.text}</p>
        ) : null}
        <div className="mt-3">
          <ExplorerTxLink hash={txHash} />
        </div>
      </div>
    </section>
  );
}
