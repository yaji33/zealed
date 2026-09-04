"use client";

import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { DotMatrixChart } from "@/components/DotMatrixChart";
import { DrawClock } from "@/components/DrawCyclePanel";
import { useVaultDirectory } from "@/components/VaultDirectoryProvider";
import { usePrizePoolData } from "@/hooks/usePrizePoolData";
import { useVaultTvl } from "@/hooks/useVaultTvl";
import { useVaultTvlHistory } from "@/hooks/useVaultTvlHistory";
import { formatCompactAmount, formatUnits } from "@/lib/format";
import {
  actionTabActiveClass,
  actionTabClass,
  cardClass,
  ledeClass,
} from "@/lib/uiClasses";

type View = "principal" | "prizes";
const VIEWS: { id: View; label: string }[] = [
  { id: "principal", label: "Principal TVL history" },
  { id: "prizes", label: "Current prize accounting" },
];

function axisLabel(timestamp?: number): string {
  if (!timestamp) return "";
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function VaultChart() {
  const { selected } = useVaultDirectory();
  const configured = Boolean(selected);
  const assetLabel = selected?.label ?? "token";
  const [view, setView] = useState<View>("principal");
  const tvl = useVaultTvl();
  const history = useVaultTvlHistory();
  const pool = usePrizePoolData();

  const tvlSeries = useMemo(() => {
    const points = [...(history.data ?? [])];
    if (tvl.data !== undefined) {
      const last = points[points.length - 1];
      if (!last || last.value !== tvl.data) {
        points.push({
          blockNumber: last ? last.blockNumber + 1n : 0n,
          timestamp: Math.floor(Date.now() / 1000),
          value: tvl.data,
        });
      }
    }
    return points;
  }, [history.data, tvl.data]);
  const chartPoints = tvlSeries.map((point) => ({
    value: Number(formatUnits(point.value)),
  }));
  const max = tvlSeries.reduce(
    (value, point) => (point.value > value ? point.value : value),
    0n,
  );
  const firstDate = axisLabel(tvlSeries[0]?.timestamp);
  const lastDate = axisLabel(tvlSeries[tvlSeries.length - 1]?.timestamp);
  const xLeft = tvlSeries.length > 1 && firstDate !== lastDate ? firstDate : "";
  const xRight = lastDate || (tvlSeries.length ? "Now" : "");

  function onTabsKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = view === "principal" ? "prizes" : "principal";
    setView(next);
    event.currentTarget
      .querySelector<HTMLButtonElement>(`#accounting-tab-${next}`)
      ?.focus();
  }

  return (
    <section
      className={`${cardClass} mb-0 p-0 sm:p-0`}
      aria-labelledby="accounting-visual-title"
    >
      <div className="px-6 pt-6 sm:px-8 sm:pt-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="m-0 font-mono text-[0.68rem] tracking-[0.18em] text-ember/75">
              ACCOUNTING
            </p>
            <h2
              id="accounting-visual-title"
              className="m-0 mt-2 font-dm-sans text-[1.35rem] font-medium text-ink"
            >
              Principal and prizes, kept separate
            </h2>
          </div>
          <DrawClock />
        </div>
        <p className={`${ledeClass} mt-2 max-w-2xl`}>
          Principal history uses only vault deposits. Prize figures show only
          current sponsor-funded mock-yield accounting and are never plotted on
          the principal scale.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Accounting views"
        className="mt-5 flex gap-7 border-b border-line px-6 sm:px-8"
        onKeyDown={onTabsKeyDown}
      >
        {VIEWS.map((item) => (
          <button
            key={item.id}
            id={`accounting-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={view === item.id}
            aria-controls={`accounting-panel-${item.id}`}
            tabIndex={view === item.id ? 0 : -1}
            className={`${actionTabClass} ${view === item.id ? actionTabActiveClass : ""}`}
            onClick={() => setView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        id="accounting-panel-principal"
        role="tabpanel"
        aria-labelledby="accounting-tab-principal"
        hidden={view !== "principal"}
        className={
          view === "principal" ? "px-6 pb-6 pt-6 sm:px-8 sm:pb-8" : "hidden"
        }
      >
        {!configured ? (
          <QuietState text="Set vault addresses to load principal history." />
        ) : history.isLoading || tvl.isLoading ? (
          <QuietState text="Loading principal TVL history…" />
        ) : tvl.isError || history.isError ? (
          <QuietState text="Principal TVL history could not be loaded." />
        ) : chartPoints.some((point) => point.value > 0) ? (
          <>
            <ChartFrame
              yMax={`${formatCompactAmount(max)} ${assetLabel}`}
              xLeft={xLeft}
              xRight={xRight}
            >
              <div aria-hidden="true">
                <DotMatrixChart points={chartPoints} mode="area" />
              </div>
            </ChartFrame>
            <div className="sr-only">
              <h3>Principal TVL history data</h3>
              <ul>
                {tvlSeries.map((point) => (
                  <li key={`${point.blockNumber}-${point.timestamp}`}>
                    {axisLabel(point.timestamp) || "Current"}:{" "}
                    {formatUnits(point.value)} {assetLabel}
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <QuietState text="No principal deposits are available to chart yet." />
        )}
      </div>

      <div
        id="accounting-panel-prizes"
        role="tabpanel"
        aria-labelledby="accounting-tab-prizes"
        hidden={view !== "prizes"}
        className={
          view === "prizes" ? "px-6 pb-6 pt-6 sm:px-8 sm:pb-8" : "hidden"
        }
      >
        {!pool.configured ? (
          <QuietState text="Prize accounting is unavailable until a verified PrizePool is configured." />
        ) : pool.isLoading ? (
          <QuietState text="Loading current prize accounting…" />
        ) : pool.isError || !pool.data ? (
          <QuietState text="Current prize accounting could not be loaded." />
        ) : (
          <dl className="m-0 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <AccountingValue
              label="Available prize liquidity"
              value={pool.data.availableLiquidity}
              unit={assetLabel}
            />
            <AccountingValue
              label="Reserve"
              value={pool.data.reserveLiquidity}
              unit={assetLabel}
            />
            {pool.data.tiers.map((tier) => (
              <AccountingValue
                key={tier.id}
                label={`${tier.name} allocation (${tier.slots} slot${tier.slots === 1 ? "" : "s"})`}
                value={tier.allocation}
                unit={assetLabel}
                note={`${formatUnits(tier.prizePerSlot)} ${assetLabel} per slot`}
              />
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}

function AccountingValue({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: bigint;
  unit: string;
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-edge bg-base p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mb-0 ml-0 mt-2 font-dm-sans text-xl font-medium tabular-nums text-ink">
        {formatCompactAmount(value)}{" "}
        <span className="text-xs text-muted">{unit}</span>
      </dd>
      {note ? <dd className="m-0 mt-1 text-xs text-muted">{note}</dd> : null}
    </div>
  );
}

function ChartFrame({
  yMax,
  xLeft,
  xRight,
  children,
}: {
  yMax: string;
  xLeft: string;
  xRight: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-[200px] shrink-0 flex-col justify-between py-0.5 text-right font-mono text-[0.68rem] text-muted">
        <span>{yMax}</span>
        <span>0</span>
      </div>
      <div className="min-w-0 flex-1">
        {children}
        {xLeft || xRight ? (
          <div className="mt-3 flex justify-between font-mono text-[0.72rem] text-muted">
            <span>{xLeft}</span>
            <span>{xRight}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function QuietState({ text }: { text: string }) {
  return (
    <p className="m-0 py-12 text-center text-[0.92rem] leading-relaxed text-muted">
      {text}
    </p>
  );
}
