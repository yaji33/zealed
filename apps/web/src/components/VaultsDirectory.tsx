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
import { HeroBanner } from "@/components/HeroBanner";
import { useVaultDirectory } from "@/components/VaultDirectoryProvider";
import { useConnectWallet } from "@/hooks/useConnectWallet";
import {
  useVaultMarketData,
  type VaultMarketRow,
} from "@/hooks/useVaultMarketData";
import { formatCompactAmount } from "@/lib/format";
import {
  bannerWarnClass,
  btnClass,
  btnSecondaryClass,
  cardClass,
  chainPillClass,
  dataTableClass,
} from "@/lib/uiClasses";
import { FAUCET_PATH, prizeVaultName, vaultWorkspacePath } from "@/lib/vaultPath";
import {
  wrapperAccentFor,
  wrapperSymbolFor,
} from "@/lib/wrapperMeta";

export function VaultsDirectory() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { connectWallet, canConnect, isPending } = useConnectWallet();
  const { selectVault, isError, registryConfigured } = useVaultDirectory();
  const { rows, isLoading } = useVaultMarketData();
  const [query, setQuery] = useState("");

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

  return (
    <div className="flex flex-col gap-6">
      <HeroBanner
        icon={<AppIcon icon={BlurOnIcon} size={22} />}
        headline="Save. Win privately."
        line="Deposits stay encrypted. Prizes come from a separate sponsor pool."
        cta={
          isConnected ? (
            <Link className={btnClass} href={FAUCET_PATH}>
              <AppIcon icon={WaterDropIcon} size={16} />
              Get tokens
            </Link>
          ) : (
            <button
              type="button"
              className={btnClass}
              disabled={isPending || !canConnect}
              onClick={() => void connectWallet()}
            >
              <AppIcon icon={AccountBalanceWalletIcon} size={16} />
              {isPending ? "Connecting…" : "Connect wallet"}
            </button>
          )
        }
      />

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
      </section>

      <section className={cardClass} aria-labelledby="vaults-table-title">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2
            id="vaults-table-title"
            className="m-0 font-dm-sans text-[1.35rem] font-medium text-ink"
          >
            Vaults
          </h2>
          <label className="relative m-0 min-w-56 text-[0.85rem] text-muted sm:max-w-xs">
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
          <p className={bannerWarnClass}>
            Vault discovery is temporarily unavailable.
          </p>
        ) : null}

        <div className="overflow-x-auto">
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
              {isLoading && rows.length === 0 ? (
                <tr>
                  <td colSpan={isConnected ? 6 : 5} className="text-muted">
                    Loading confidential vaults…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={isConnected ? 6 : 5} className="text-muted">
                    No vaults match that search.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
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
                          <span
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[0.7rem] font-semibold text-void"
                            style={{
                              background: wrapperAccentFor(row.system.asset),
                            }}
                          >
                            {row.system.label.slice(0, 2)}
                          </span>
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
                })
              )}
            </tbody>
          </table>
        </div>
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
