"use client";

import Link from "next/link";
import { useVaultDirectory } from "@/components/VaultDirectoryProvider";
import { usePrizePoolData } from "@/hooks/usePrizePoolData";
import { useVaultTvl } from "@/hooks/useVaultTvl";
import { formatCompactAmount } from "@/lib/format";
import {
  bannerWarnClass,
  btnClass,
  cardClass,
  ledeClass,
  sectionTitleClass,
  statCardClass,
  statGridClass,
  statLabelClass,
  statNoteClass,
  statUnitClass,
  statValueClass,
} from "@/lib/uiClasses";

function Amount({
  value,
  loading,
  unit,
}: {
  value?: bigint;
  loading?: boolean;
  unit: string;
}) {
  return (
    <p className={statValueClass}>
      {loading || value === undefined ? "…" : formatCompactAmount(value)}
      {value !== undefined ? (
        <span className={statUnitClass}>{unit}</span>
      ) : null}
    </p>
  );
}

export function PublicPoolOverview() {
  const tvl = useVaultTvl();
  const pool = usePrizePoolData();
  const { selected } = useVaultDirectory();
  const assetLabel = selected?.label ?? "token";
  const hasBuiltInFaucet = Boolean(selected);

  return (
    <>
      {hasBuiltInFaucet ? (
        <section className={`${cardClass} border-mint/30 bg-mint/[0.04]`}>
          <p className="m-0 font-mono text-[0.68rem] tracking-[0.18em] text-mint">
            START HERE
          </p>
          <div className="mt-3 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <h1 className="m-0 font-dm-sans text-[clamp(1.6rem,4vw,2.35rem)] font-medium tracking-tight text-ink">
                Get test {assetLabel}, then save privately
              </h1>
              <p className={`${ledeClass} mt-2 max-w-2xl`}>
                The faucet mints the selected wrapper&apos;s public test asset
                and wraps it confidentially. Your principal remains withdrawable
                at any time.
              </p>
            </div>
            <Link
              className={`${btnClass} shrink-0 text-center`}
              href="/dashboard/faucet"
            >
              Open {assetLabel} faucet
            </Link>
          </div>
        </section>
      ) : null}

      <section className={cardClass} aria-labelledby="public-pool-title">
        <h2 id="public-pool-title" className={sectionTitleClass}>
          Public pool accounting
        </h2>
        <p className={`${ledeClass} mt-2`}>
          Principal and sponsor-funded mock yield are separate. These figures
          are aggregate and do not reveal any saver&apos;s position.
        </p>

        <div className={statGridClass}>
          <article className={statCardClass}>
            <h3 className={statLabelClass}>Principal TVL</h3>
            <Amount
              value={tvl.data}
              loading={tvl.isLoading}
              unit={assetLabel}
            />
            <p className={statNoteClass}>
              Saver principal held by the vault; never prize funding.
            </p>
          </article>
          <article className={statCardClass}>
            <h3 className={statLabelClass}>Available prize liquidity</h3>
            <Amount
              value={pool.data?.availableLiquidity}
              loading={pool.isLoading}
              unit={assetLabel}
            />
            <p className={statNoteClass}>
              Unallocated sponsor-funded mock yield.
            </p>
          </article>
          <article className={statCardClass}>
            <h3 className={statLabelClass}>Reserve</h3>
            <Amount
              value={pool.data?.reserveLiquidity}
              loading={pool.isLoading}
              unit={assetLabel}
            />
            <p className={statNoteClass}>
              Prize-liquidity backstop, separate from principal.
            </p>
          </article>
        </div>

        {!pool.configured ? (
          <p className={bannerWarnClass}>
            Multi-tier prize accounting is unavailable because no active
            registered vault is selected.
          </p>
        ) : pool.isError ? (
          <p className={bannerWarnClass}>
            Prize accounting could not be loaded. Try again shortly.
          </p>
        ) : (
          <div className="mt-6">
            <h3 className="m-0 font-dm-sans text-base font-medium text-ink">
              Active tier allocations
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {pool.data?.tiers.map((tier) => (
                <article
                  key={tier.id}
                  className="rounded-lg border border-edge bg-base p-4"
                >
                  <p className={statLabelClass}>
                    {tier.name} · {tier.slots} slot{tier.slots === 1 ? "" : "s"}
                  </p>
                  <Amount value={tier.allocation} unit={assetLabel} />
                  <p className={statNoteClass}>
                    {formatCompactAmount(tier.prizePerSlot)} {assetLabel} per
                    slot
                  </p>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
