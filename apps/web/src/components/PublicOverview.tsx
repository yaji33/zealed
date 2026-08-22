"use client";

import { usePublicDrawData } from "@/hooks/usePublicDrawData";
import { useVaultTvl } from "@/hooks/useVaultTvl";
import { contractsConfigured } from "@/lib/config";
import { formatTimestamp, formatUnits } from "@/lib/format";
import {
  bannerWarnClass,
  dataTableClass,
  eyebrowPublicClass,
  ledeClass,
  monoClass,
  panelClass,
  pillOkClass,
  pillPendingClass,
  statGridClass,
  statLabelClass,
  statNoteClass,
  statPublicClass,
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
    <section className={panelClass}>
      <div className="[&_h2]:mb-1 [&_h2]:mt-0.5 [&_h3]:mb-1 [&_h3]:mt-0.5">
        <p className={eyebrowPublicClass}>Public</p>
        <h2>Protocol aggregates</h2>
        <p className={ledeClass}>
          These figures are visible without a wallet. Individual balances, odds, and outcomes stay encrypted.
        </p>
      </div>

      {!configured && (
        <p className={bannerWarnClass}>
          Contract addresses are not configured. Set <code>NEXT_PUBLIC_*</code> addresses in{" "}
          <code>.env.local</code> (see <code>.env.example</code>).
        </p>
      )}

      <div className={statGridClass}>
        <article className={statPublicClass}>
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
          <p className={statNoteClass}>
            Aggregate vault total via public self-relay decrypt. Per-user balances stay private.
          </p>
        </article>
        <article className={statPublicClass}>
          <h3 className={statLabelClass}>Total yield generated</h3>
          <p className={`${statValueClass} ${monoClass}`}>
            {formatUnits(totalYieldGenerated)} cUSDC
          </p>
          <p className={statNoteClass}>Sum of settled draw prize amounts (yield → prizes).</p>
        </article>
        <article className={statPublicClass}>
          <h3 className={statLabelClass}>Total prizes paid</h3>
          <p className={`${statValueClass} ${monoClass}`}>
            {formatUnits(totalPrizesPaid)} cUSDC
          </p>
          <p className={statNoteClass}>
            From on-chain <code>DrawRevealed</code> / committed prize sizes.
          </p>
        </article>
        <article className={statPublicClass}>
          <h3 className={statLabelClass}>Public ticket supply</h3>
          <p className={`${statValueClass} ${monoClass}`}>
            {revealed && totalTicketsPlain !== undefined ? totalTicketsPlain.toString() : "—"}
          </p>
          <p className={statNoteClass}>
            Plaintext only after draw reveal (same disclosure class as TVL). Current draw{" "}
            {drawId !== undefined ? `#${drawId.toString()}` : "—"}.
          </p>
        </article>
      </div>

      <div className="mt-6 overflow-x-auto">
        <div className="mb-3 [&_h3]:mb-1 [&_h3]:mt-0.5">
          <h3>Draw history</h3>
          <p className={`${ledeClass} text-[0.92rem]`}>
            Draw number, time, settled — no individual winners or amounts per user.
          </p>
        </div>
        {historyLoading ? (
          <p className="text-muted">Loading draws…</p>
        ) : history.length === 0 ? (
          <p className="text-muted">No draws committed yet.</p>
        ) : (
          <table className={dataTableClass}>
            <thead>
              <tr>
                <th>Draw</th>
                <th>Committed</th>
                <th>Reveal block</th>
                <th>Prize (public)</th>
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
