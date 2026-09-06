"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import BlurOnIcon from "@mui/icons-material/BlurOn";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import LockIcon from "@mui/icons-material/Lock";
import SearchIcon from "@mui/icons-material/Search";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import { useAccount } from "wagmi";
import { AppIcon } from "@/components/AppIcon";
import { EmptyState } from "@/components/EmptyState";
import { HeroBanner } from "@/components/HeroBanner";
import { StatusNotice } from "@/components/StatusNotice";
import { TokenIcon } from "@/components/TokenIcon";
import { useVaultDirectory } from "@/components/VaultDirectoryProvider";
import { useConnectWallet } from "@/hooks/useConnectWallet";
import {
  useVaultMarketData,
  type VaultMarketRow,
} from "@/hooks/useVaultMarketData";
import { formatCompactAmount } from "@/lib/format";
import {
  btnClass,
  btnSecondaryClass,
  cardClass,
  chainPillClass,
  dataTableClass,
} from "@/lib/uiClasses";
import { FAUCET_PATH, prizeVaultName, vaultWorkspacePath } from "@/lib/vaultPath";
import { wrapperSymbolFor } from "@/lib/wrapperMeta";
import { noticeFromWalletError } from "@/lib/walletError";

export function VaultsDirectory() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { connectWallet, canConnect, isPending, error } = useConnectWallet();
  const { selectVault, isError, registryConfigured } = useVaultDirectory();
  const { rows, isLoading } = useVaultMarketData();
  const [query, setQuery] = useState("");
  const connectNotice = error
    ? noticeFromWalletError(error, "Wallet connection failed.")
    : null;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => {
      const symbol = wrapperSymbolFor(row.system.asset, row.system.label);
      return (
        row.system.label.toLowerCase().includes(needle) ||
        row.system.slug.toLowerCase().includes(needle) ||
        symbol.toLowerCase().includes(needle) ||
        prizeVaultName(row.system.label).toLowerCase().includes(needle)
      );
    });
  }, [query, rows]);

  function openVault(row: VaultMarketRow) {
    selectVault(row.system.id);
    router.push(vaultWorkspacePath(row.system.slug));
  }

  const searching = query.trim().length > 0;
  const emptyBody = searching
    ? "Try another name, slug, or asset symbol."
    : registryConfigured
      ? "The registry has no active vaults to list right now."
      : "Vault discovery is not configured in this environment.";

  return (
    <div className="flex flex-col gap-6">
      <HeroBanner
        icon={<AppIcon icon={BlurOnIcon} size={22} />}
        headline="Save. Win privately."
        line="Deposits stay encrypted. Prizes come from a separate sponsor pool."
        cta={
          isConnected ? (
            <Link className={`${btnClass} min-h-11`} href={FAUCET_PATH}>
              <AppIcon icon={WaterDropIcon} size={16} />
              Get tokens
            </Link>
          ) : (
            <button
              type="button"
              className={`${btnClass} min-h-11`}
              disabled={isPending || !canConnect}
              onClick={() => void connectWallet()}
            >
              <AppIcon icon={AccountBalanceWalletIcon} size={16} />
              {isPending ? "Connecting…" : "Connect wallet"}
            </button>
          )
        }
      />

      {connectNotice && !isConnected ? (
        <StatusNotice kind={connectNotice.kind === "cancel" ? "cancel" : "err"}>
          {connectNotice.text}
        </StatusNotice>
      ) : null}

      <section className={cardClass} aria-labelledby="directory-stats-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p
              id="directory-stats-title"
              className="m-0 font-mono text-[0.68rem] tracking-[0.18em] text-muted"
            >
              MARKET
            </p>
            <h2 className="m-0 mt-2 font-dm-sans text-[1.35rem] font-medium text-ink">
              Confidential vaults
            </h2>
          </div>
          <dl className="m-0 flex flex-wrap gap-6">
            <div>
              <dt className="m-0 font-mono text-[0.65rem] tracking-[0.14em] text-muted">
                VAULTS
              </dt>
              <dd className="m-0 mt-1 font-dm-sans text-2xl font-semibold tabular-nums">
                {isLoading ? "…" : rows.length}
              </dd>
            </div>
            <div>
              <dt className="m-0 font-mono text-[0.65rem] tracking-[0.14em] text-muted">
                CHAIN
              </dt>
              <dd className="m-0 mt-1 font-dm-sans text-2xl font-semibold">
                Sepolia
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section aria-labelledby="prizes-building-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2
            id="prizes-building-title"
            className="m-0 font-dm-sans text-base font-medium text-ink"
          >
            Prizes building
          </h2>
        </div>
        {isLoading && rows.length === 0 ? (
          <p className="m-0 text-sm text-muted">Loading prize liquidity…</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            eyebrow="PRIZES"
            title={searching ? "No matching prizes" : "No prizes building"}
            body={emptyBody}
            className="mb-0 py-8"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((row) => (
              <Link
                key={row.system.id}
                href={vaultWorkspacePath(row.system.slug)}
                className="rounded-lg border border-edge bg-surface p-4 text-left hover:border-mint/40"
                onClick={() => selectVault(row.system.id)}
              >
                <p className="m-0 flex items-center gap-2 text-sm text-muted">
                  <AppIcon icon={EmojiEventsIcon} size={16} className="text-ember" />
                  {prizeVaultName(row.system.label)}
                </p>
                <p className="m-0 mt-2 font-dm-sans text-xl font-semibold tabular-nums text-ink">
                  {row.availablePrizeLiquidity === undefined
                    ? "…"
                    : formatCompactAmount(
                        row.availablePrizeLiquidity,
                        row.decimals,
                      )}{" "}
                  <span className="text-sm font-medium text-muted">
                    {row.system.label}
                  </span>
                </p>
                <p className="m-0 mt-1 text-xs text-muted">
                  Available prize liquidity
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className={cardClass} aria-labelledby="vaults-table-title">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2
            id="vaults-table-title"
            className="m-0 font-dm-sans text-[1.35rem] font-medium text-ink"
          >
            Vaults
          </h2>
          <label className="relative m-0 w-full min-w-0 text-[0.85rem] text-muted sm:max-w-xs sm:min-w-56">
            <span className="sr-only">Search vaults</span>
            <span className="relative block">
              <AppIcon
                icon={SearchIcon}
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                className="w-full rounded-lg border border-line/40 bg-base py-[0.65rem] pl-9 pr-3 font-inherit text-ink"
                placeholder="Search vaults"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </span>
          </label>
        </div>

        {isError && registryConfigured ? (
          <StatusNotice kind="err">
            Vault discovery is temporarily unavailable.
          </StatusNotice>
        ) : null}

        {isLoading && rows.length === 0 ? (
          <p className="m-0 text-muted">Loading confidential vaults…</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            eyebrow="VAULTS"
            title={searching ? "No vaults match that search." : "No confidential vaults yet."}
            body={emptyBody}
            action={
              searching ? (
                <button
                  type="button"
                  className={btnSecondaryClass}
                  onClick={() => setQuery("")}
                >
                  Clear search
                </button>
              ) : null
            }
            className="mb-0 py-8"
          />
        ) : (
          <>
            <div className="grid gap-3 md:hidden">
              {filtered.map((row) => {
                const symbol = wrapperSymbolFor(row.system.asset, row.system.label);
                return (
                  <Link
                    key={row.system.id}
                    href={vaultWorkspacePath(row.system.slug)}
                    className="rounded-lg border border-edge bg-base p-4 hover:border-mint/40"
                    onClick={() => selectVault(row.system.id)}
                  >
                    <div className="flex items-center gap-3">
                      <TokenIcon
                        asset={row.system.asset}
                        label={row.system.label}
                        size={36}
                      />
                      <div className="min-w-0">
                        <p className="m-0 font-medium text-ink">
                          {prizeVaultName(row.system.label)}
                        </p>
                        <p className="m-0 mt-0.5 text-xs text-muted">{symbol}</p>
                      </div>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="m-0 text-xs text-muted">Principal TVL</dt>
                        <dd className="m-0 mt-1 font-medium tabular-nums text-ink">
                          {row.principalTvl === undefined
                            ? "…"
                            : `${formatCompactAmount(row.principalTvl, row.decimals)} ${row.system.label}`}
                        </dd>
                      </div>
                      <div>
                        <dt className="m-0 text-xs text-muted">
                          Available prize liquidity
                        </dt>
                        <dd className="m-0 mt-1 tabular-nums text-ink">
                          {row.availablePrizeLiquidity === undefined
                            ? "…"
                            : `${formatCompactAmount(row.availablePrizeLiquidity, row.decimals)} ${row.system.label}`}
                        </dd>
                      </div>
                    </dl>
                    {isConnected ? (
                      <p className="mt-3 mb-0 inline-flex items-center gap-1.5 text-xs text-muted">
                        <AppIcon icon={LockIcon} size={14} />
                        ••••
                      </p>
                    ) : null}
                  </Link>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className={dataTableClass}>
                <thead>
                  <tr>
                    <th scope="col">Vault</th>
                    <th scope="col">Asset</th>
                    <th scope="col">Chain</th>
                    <th scope="col">Principal TVL</th>
                    <th scope="col">Available prize liquidity</th>
                    {isConnected ? <th scope="col">You</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const symbol = wrapperSymbolFor(
                      row.system.asset,
                      row.system.label,
                    );
                    return (
                      <tr
                        key={row.system.id}
                        className="cursor-pointer hover:bg-mint/[0.04]"
                        onClick={() => openVault(row)}
                      >
                        <td>
                          <div className="flex items-center gap-3">
                            <TokenIcon
                              asset={row.system.asset}
                              label={row.system.label}
                              size={36}
                            />
                            <span className="font-medium text-ink">
                              <Link
                                href={vaultWorkspacePath(row.system.slug)}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  selectVault(row.system.id);
                                }}
                              >
                                {prizeVaultName(row.system.label)}
                              </Link>
                            </span>
                          </div>
                        </td>
                        <td className="text-muted">{symbol}</td>
                        <td>
                          <span className={chainPillClass}>Sepolia</span>
                        </td>
                        <td className="font-medium tabular-nums text-ink">
                          {row.principalTvl === undefined
                            ? "…"
                            : `${formatCompactAmount(row.principalTvl, row.decimals)} ${row.system.label}`}
                        </td>
                        <td className="tabular-nums text-ink">
                          {row.availablePrizeLiquidity === undefined
                            ? "…"
                            : `${formatCompactAmount(row.availablePrizeLiquidity, row.decimals)} ${row.system.label}`}
                        </td>
                        {isConnected ? (
                          <td className="text-muted">
                            <span className="inline-flex items-center gap-1.5">
                              <AppIcon icon={LockIcon} size={14} />
                              ••••
                            </span>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        <p className="mt-4 text-xs text-muted">
          Principal TVL and available prize liquidity are public aggregates.
          Individual balances stay encrypted.
        </p>
        {!isConnected ? (
          <p className="mt-3">
            <button
              type="button"
              className={btnSecondaryClass}
              disabled={isPending || !canConnect}
              onClick={() => void connectWallet()}
            >
              <AppIcon icon={AccountBalanceWalletIcon} size={16} />
              Connect to save
            </button>
          </p>
        ) : null}
      </section>
    </div>
  );
}
