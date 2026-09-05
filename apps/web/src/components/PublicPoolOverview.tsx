"use client";

import Link from "next/link";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import { AppIcon } from "@/components/AppIcon";
import { HeroBanner } from "@/components/HeroBanner";
import { useVaultDirectory } from "@/components/VaultDirectoryProvider";
import { usePrizePoolData } from "@/hooks/usePrizePoolData";
import { useVaultTvl } from "@/hooks/useVaultTvl";
import { FAUCET_PATH } from "@/lib/vaultPath";
import { formatCompactAmount } from "@/lib/format";
import { wrapperDecimalsFor } from "@/lib/wrapperMeta";
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
  decimals,
}: {
  value?: bigint;
  loading?: boolean;
  unit: string;
  decimals: number;
}) {
  return (
    <p className={statValueClass}>
      {loading || value === undefined
        ? "…"
        : formatCompactAmount(value, decimals)}
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
  const decimals = wrapperDecimalsFor(selected?.asset);
  const hasBuiltInFaucet = Boolean(selected);

  return (
    <>
      {hasBuiltInFaucet ? (
        <HeroBanner
          icon={<AppIcon icon={WaterDropIcon} size={22} />}
          headline={`Mint test ${assetLabel}, then save.`}
          line="Principal stays withdrawable."
          cta={
            <Link className={btnClass} href={FAUCET_PATH}>
              <AppIcon icon={WaterDropIcon} size={16} />
              Open {assetLabel} faucet
            </Link>
          }
        />
      ) : null}

      <section className={cardClass} aria-labelledby="public-pool-title">
        <h2 id="public-pool-title" className={sectionTitleClass}>
          Public pool accounting
        </h2>
        <p className={`${ledeClass} mt-2`}>
          Principal and sponsor-funded mock yield stay separate.
        </p>

        <div className={statGridClass}>
          <article className={statCardClass}>
            <h3 className={statLabelClass}>Principal TVL</h3>
            <Amount
              value={tvl.data}
              loading={tvl.isLoading}
              unit={assetLabel}
              decimals={decimals}
            />
            <p className={statNoteClass}>Saver principal. Never prize funding.</p>
          </article>
          <article className={statCardClass}>
            <h3 className={statLabelClass}>Available prize liquidity</h3>
            <Amount
              value={pool.data?.availableLiquidity}
              loading={pool.isLoading}
              unit={assetLabel}
              decimals={decimals}
            />
            <p className={statNoteClass}>Unallocated sponsor-funded mock yield.</p>
          </article>
          <article className={statCardClass}>
            <h3 className={statLabelClass}>Reserve</h3>
            <Amount
              value={pool.data?.reserveLiquidity}
              loading={pool.isLoading}
              unit={assetLabel}
              decimals={decimals}
            />
            <p className={statNoteClass}>Prize-liquidity backstop.</p>
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
                  <Amount
                    value={tier.allocation}
                    unit={assetLabel}
                    decimals={decimals}
                  />
                  <p className={statNoteClass}>
                    {formatCompactAmount(tier.prizePerSlot, decimals)} {assetLabel}{" "}
                    per slot
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
