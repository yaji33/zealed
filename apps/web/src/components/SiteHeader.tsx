"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import { useAccount } from "wagmi";
import { AppIcon } from "@/components/AppIcon";
import { useConnectWallet } from "@/hooks/useConnectWallet";
import { FAUCET_PATH, VAULTS_PATH } from "@/lib/vaultPath";

const btnMint =
  "inline-flex cursor-pointer appearance-none items-center justify-center gap-2 rounded bg-mint px-[1.15rem] py-[0.55rem] font-medium text-void disabled:cursor-not-allowed disabled:opacity-45";

const btnWallet =
  "inline-flex cursor-pointer appearance-none items-center justify-center gap-2 rounded bg-mint/15 px-[1.15rem] py-[0.55rem] font-mono text-[0.85rem] font-medium text-ink disabled:cursor-not-allowed disabled:opacity-45";

function navLinkClass(active: boolean): string {
  return `inline-flex items-center gap-1.5 text-ink ${active ? "text-mint" : "hover:text-mint"}`;
}

export function SiteHeader() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { connectWallet, disconnectWallet, canConnect, isPending, error } =
    useConnectWallet();
  const faucetActive =
    pathname === FAUCET_PATH || pathname.startsWith(`${FAUCET_PATH}/`);
  const vaultsActive = pathname === VAULTS_PATH || pathname.startsWith(`${VAULTS_PATH}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-line/30 bg-base/70 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-2 px-4 py-5 font-dm-sans max-[760px]:px-4">
        <div className="flex items-center justify-between">
          <Link href={VAULTS_PATH} className="text-2xl font-bold tracking-tight text-ink">
            Zealed
          </Link>
          <nav
            aria-label="Primary"
            className="flex items-center gap-[1.4rem] text-[0.85rem] max-[760px]:gap-4"
          >
            <Link
              href={VAULTS_PATH}
              className={navLinkClass(vaultsActive && !faucetActive)}
              aria-current={vaultsActive && !faucetActive ? "page" : undefined}
            >
              <AppIcon icon={AccountBalanceIcon} size={16} />
              Vaults
            </Link>
            <Link
              href={FAUCET_PATH}
              className={navLinkClass(faucetActive)}
              aria-current={faucetActive ? "page" : undefined}
            >
              <AppIcon icon={WaterDropIcon} size={16} />
              Faucet
            </Link>
            <span className="text-ink/55" aria-hidden="true">
              |
            </span>
            {isConnected && address ? (
              <WalletChip address={address} onDisconnect={disconnectWallet} />
            ) : (
              <button
                type="button"
                className={btnMint}
                disabled={isPending || !canConnect}
                onClick={() => void connectWallet()}
              >
                <AppIcon icon={AccountBalanceWalletIcon} size={16} />
                {isPending ? "Connecting…" : "Connect"}
              </button>
            )}
          </nav>
        </div>
        {error && !isConnected && (
          <p className="m-0 text-right text-[0.8rem] text-danger">{error.message}</p>
        )}
      </div>
    </header>
  );
}

function WalletChip({
  address,
  onDisconnect,
}: {
  address: string;
  onDisconnect: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const label = shorten(address);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={btnWallet}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <AppIcon icon={AccountBalanceWalletIcon} size={14} />
        {label}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 min-w-[11.5rem] rounded border border-line bg-surface py-1"
        >
          <p className="m-0 px-3 py-2 font-mono text-[0.8rem] text-muted">{label}</p>
          <button
            type="button"
            role="menuitem"
            className="w-full cursor-pointer appearance-none border-0 bg-transparent px-3 py-2 text-left font-dm-sans text-[0.85rem] font-medium text-ink hover:text-ember"
            onClick={() => {
              setOpen(false);
              onDisconnect();
            }}
          >
            Disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
}

function shorten(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
