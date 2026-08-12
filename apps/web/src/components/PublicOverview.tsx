"use client";

import { usePublicDrawData } from "@/hooks/usePublicDrawData";
import { useVaultTvl } from "@/hooks/useVaultTvl";
import { contractsConfigured } from "@/lib/config";
import { formatTimestamp, formatUnits } from "@/lib/format";

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
    <section className="panel">
      <div className="panel-head">
        <p className="eyebrow public-tag">Public</p>
        <h2>Protocol aggregates</h2>
        <p className="lede">
          These figures are visible without a wallet. Individual balances, odds, and outcomes stay encrypted.
        </p>
      </div>

      {!configured && (
        <p className="banner warn">
          Contract addresses are not configured. Set <code>NEXT_PUBLIC_*</code> addresses in{" "}
          <code>.env.local</code> (see <code>.env.example</code>).
        </p>
      )}

      <div className="stat-grid">
        <article className="stat public-surface">
          <h3>Vault TVL</h3>
          <p className="stat-value mono">
            {!configured
              ? "—"
              : tvlLoading
                ? "…"
                : tvlError
                  ? "Unavailable"
                  : `${formatUnits(vaultTvl ?? 0n)} cUSDC`}
          </p>
          <p className="stat-note">
            Aggregate vault total via public self-relay decrypt. Per-user balances stay private.
          </p>
        </article>
        <article className="stat public-surface">
          <h3>Total yield generated</h3>
          <p className="stat-value mono">{formatUnits(totalYieldGenerated)} cUSDC</p>
          <p className="stat-note">Sum of settled draw prize amounts (yield → prizes).</p>
        </article>
        <article className="stat public-surface">
          <h3>Total prizes paid</h3>
          <p className="stat-value mono">{formatUnits(totalPrizesPaid)} cUSDC</p>
          <p className="stat-note">From on-chain <code>DrawRevealed</code> / committed prize sizes.</p>
        </article>
        <article className="stat public-surface">
          <h3>Public ticket supply</h3>
          <p className="stat-value mono">
            {revealed && totalTicketsPlain !== undefined ? totalTicketsPlain.toString() : "—"}
          </p>
          <p className="stat-note">
            Plaintext only after draw reveal (same disclosure class as TVL). Current draw{" "}
            {drawId !== undefined ? `#${drawId.toString()}` : "—"}.
          </p>
        </article>
      </div>

      <div className="table-wrap">
        <div className="panel-head tight">
          <h3>Draw history</h3>
          <p className="lede small">Draw number, time, settled — no individual winners or amounts per user.</p>
        </div>
        {historyLoading ? (
          <p className="muted">Loading draws…</p>
        ) : history.length === 0 ? (
          <p className="muted">No draws committed yet.</p>
        ) : (
          <table className="data-table">
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
                  <td className="mono">#{row.drawId.toString()}</td>
                  <td>{row.committedAt ? formatTimestamp(row.committedAt) : "—"}</td>
                  <td className="mono">{row.revealBlock.toString()}</td>
                  <td className="mono">{formatUnits(row.prizeAmount)}</td>
                  <td>
                    <span className={row.settled ? "pill ok" : "pill pending"}>
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
