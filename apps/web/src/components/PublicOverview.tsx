"use client";

import { usePublicDrawData } from "@/hooks/usePublicDrawData";
import { useVaultTvl } from "@/hooks/useVaultTvl";
import { contractsConfigured } from "@/lib/config";
import { formatTimestamp, formatUnits } from "@/lib/format";
import {
  bannerWarnClass,
  cardClass,
  cardHighlightClass,
  dataTableClass,
  ledeClass,
  monoClass,
  pillOkClass,
  pillPendingClass,
  sectionTitleClass,
  statCardClass,
  statGridClass,
  statLabelClass,
  statNoteClass,
  statValueClass,
} from "@/lib/uiClasses";

export function PublicOverview() {
  const configured = contractsConfigured();
  const {
    history,
    historyLoading,
    totalPrizesPaid,
    totalYieldGenerated,
    totalTicketsPlain,
    revealed,
    drawId,
  } = usePublicDrawData();
  const { data: vaultTvl, isLoading: tvlLoading, isError: tvlError } = useVaultTvl();

  return (
    <section className={cardClass}>
      <div className={cardHighlightClass} aria-hidden="true" />
      <div className="relative">
        <h2 className={sectionTitleClass}>Protocol aggregates</h2>
        <p className={`${ledeClass} mt-2`}>
          Visible without a wallet. Individual balances and outcomes stay sealed.
        </p>
      </div>

      {!configured && (
        <p className={bannerWarnClass}>
          Set contract addresses in <code>.env.local</code> first.
        </p>
      )}

      <div className={statGridClass}>
        <article className={statCardClass}>
          <div className={cardHighlightClass} aria-hidden="true" />
          <h3 className={statLabelClass}>Vault TVL</h3>
          <p className={`${statValueClass} ${monoClass}`}>
            {!configured
              ? "—"
              : tvlLoading
                ? "…"
                : tvlError
                  ? "Unavailable"
                  : `${formatUnits(vaultTvl ?? 0n)} cUSDC`}
          </p>
          <p className={statNoteClass}>Pool total. Per-user balances stay private.</p>
        </article>
        <article className={statCardClass}>
          <div className={cardHighlightClass} aria-hidden="true" />
          <h3 className={statLabelClass}>Total yield generated</h3>
          <p className={`${statValueClass} ${monoClass}`}>
            {formatUnits(totalYieldGenerated)} cUSDC
          </p>
          <p className={statNoteClass}>Yield that funded settled prizes.</p>
        </article>
        <article className={statCardClass}>
          <div className={cardHighlightClass} aria-hidden="true" />
          <h3 className={statLabelClass}>Total prizes paid</h3>
          <p className={`${statValueClass} ${monoClass}`}>
            {formatUnits(totalPrizesPaid)} cUSDC
          </p>
          <p className={statNoteClass}>Sum of public prize sizes from settled draws.</p>
        </article>
        <article className={statCardClass}>
          <div className={cardHighlightClass} aria-hidden="true" />
          <h3 className={statLabelClass}>Ticket supply</h3>
          <p className={`${statValueClass} ${monoClass}`}>
            {revealed && totalTicketsPlain !== undefined ? totalTicketsPlain.toString() : "—"}
          </p>
          <p className={statNoteClass}>
            Public after reveal. Draw {drawId !== undefined ? `#${drawId.toString()}` : "—"}.
          </p>
        </article>
      </div>

      <div className="relative mt-6 overflow-x-auto">
        <h3 className="m-0 font-fraunces text-[1.1rem] font-medium text-ink">Draw history</h3>
        <p className={`${ledeClass} mt-1 text-[0.88rem]`}>
          Draw number, time, and whether it settled. No individual results.
        </p>
        {historyLoading ? (
          <p className="mt-4 text-muted">Loading draws…</p>
        ) : history.length === 0 ? (
          <p className="mt-4 text-muted">No draws committed yet.</p>
        ) : (
          <table className={`${dataTableClass} mt-4`}>
            <thead>
              <tr>
                <th>Draw</th>
                <th>Committed</th>
                <th>Reveal block</th>
                <th>Prize</th>
                <th>Settled</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.drawId.toString()}>
                  <td className={monoClass}>#{row.drawId.toString()}</td>
                  <td>{row.committedAt ? formatTimestamp(row.committedAt) : "—"}</td>
                  <td className={monoClass}>{row.revealBlock.toString()}</td>
                  <td className={monoClass}>{formatUnits(row.prizeAmount)}</td>
                  <td>
                    <span className={row.settled ? pillOkClass : pillPendingClass}>
                      {row.settled ? "Yes" : "No"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
