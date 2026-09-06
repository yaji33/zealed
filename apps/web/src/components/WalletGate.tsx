"use client";

import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import { AppIcon } from "@/components/AppIcon";
import { StatusNotice } from "@/components/StatusNotice";
import { useConnectWallet } from "@/hooks/useConnectWallet";
import { btnClass, cardClass } from "@/lib/uiClasses";
import { noticeFromWalletError } from "@/lib/walletError";

export function WalletGate() {
  const { connectWallet, canConnect, isPending, error, ready } =
    useConnectWallet();

  return (
    <section className={`${cardClass} px-8 py-14 text-center sm:px-12`}>
      <p className="relative m-0 font-mono text-[0.68rem] tracking-[0.18em] text-ember/75">
        APP
      </p>
      <h1 className="relative mt-4 font-dm-sans text-[clamp(1.75rem,3.5vw,2.4rem)] font-medium tracking-tight text-ink">
        Connect to enter
      </h1>
      <p className="relative mx-auto mt-3 max-w-[26rem] text-[1rem] leading-relaxed text-muted">
        Your wallet decrypts this. Nobody else can.
      </p>
      <div className="relative mt-8 flex flex-col items-center gap-3">
        <button
          type="button"
          className={btnClass}
          disabled={isPending || !canConnect}
          onClick={() => void connectWallet()}
        >
          <AppIcon icon={AccountBalanceWalletIcon} size={18} />
          {isPending || !ready ? "Connecting…" : "Connect wallet"}
        </button>
        {error && (
          <StatusNotice kind="err" className="max-w-[28rem] text-center">
            {noticeFromWalletError(error, "Wallet connection failed.").text}
          </StatusNotice>
        )}
      </div>
    </section>
  );
}
