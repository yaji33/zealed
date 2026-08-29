"use client";

import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { DotMatrixChart } from "@/components/DotMatrixChart";
import { useDrawCycle } from "@/hooks/useDrawCycle";
import { usePublicDrawData } from "@/hooks/usePublicDrawData";
import { useVaultTvl } from "@/hooks/useVaultTvl";
import { useVaultTvlHistory } from "@/hooks/useVaultTvlHistory";
import { contractsConfigured } from "@/lib/config";
import { formatCompactAmount, formatCountdown, formatUnits } from "@/lib/format";
import {
  actionTabActiveClass,
  actionTabClass,
  cardClass,
  ledeClass,
} from "@/lib/uiClasses";

type ChartTab = "tvl" | "prize";

const TABS: { id: ChartTab; label: string }[] = [
  { id: "tvl", label: "TVL" },
  { id: "prize", label: "Prize per draw" },
];

function axisLabel(timestamp?: number): string {
  if (!timestamp) return "";
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function displayAmount(value: bigint): number {
  return Number(formatUnits(value));
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[6.5rem] text-right">
      <p className="m-0 font-mono text-[0.68rem] tracking-[0.18em] text-muted">{label}</p>
      <p className="m-0 mt-2 font-dm-sans text-[1.35rem] font-medium tabular-nums tracking-tight text-ink">
        {value}
      </p>
    </div>
  );
}

export function VaultChart() {
  const configured = contractsConfigured();
  const [tab, setTab] = useState<ChartTab>("tvl");
  const { data: tvl, isLoading: tvlLoading, isError: tvlError } = useVaultTvl();
  const history = useVaultTvlHistory();
  const draws = usePublicDrawData();
  const { phase, secondsRemaining, clockLabel } = useDrawCycle();

  const tvlSeries = useMemo(() => {
    const hist = [...(history.data ?? [])];
    if (tvl !== undefined) {
      const last = hist[hist.length - 1];
      if (!last || last.value !== tvl) {
        hist.push({
          blockNumber: last ? last.blockNumber + 1n : 0n,
          timestamp: Math.floor(Date.now() / 1000),
          value: tvl,
        });
      }
    }
    return hist;
  }, [history.data, tvl]);

  const tvlPoints = useMemo(
    () => tvlSeries.map((point) => ({ value: displayAmount(point.value) })),
    [tvlSeries],
  );

  const prizeRows = useMemo(() => {
    return (draws.history ?? [])
      .filter((row) => row.settled)
      .sort((a, b) => Number(a.drawId - b.drawId));
  }, [draws.history]);

  const prizePoints = useMemo(
    () =>
      prizeRows.map((row) => ({
        value: displayAmount(row.prizeAmount),
        label: `#${row.drawId.toString()}`,
        caption: `${formatCompactAmount(row.prizeAmount)} cUSDC`,
      })),
    [prizeRows],
  );

  const tvlMax = tvlSeries.reduce((max, point) => (point.value > max ? point.value : max), 0n);
  const prizeMax = prizeRows.reduce((max, row) => (row.prizeAmount > max ? row.prizeAmount : max), 0n);

  const tvlReady = tvlPoints.some((point) => point.value > 0);
  const prizeReady = prizePoints.length >= 1;
  const firstTvl = tvlSeries[0];
  const lastTvl = tvlSeries[tvlSeries.length - 1];

  const clockValue =
    phase === "loading" ? "…" : phase === "missed" ? "missed" : formatCountdown(secondsRemaining);

  const headline =
    !configured || tvlLoading ? "…" : tvlError ? "Unavailable" : `${formatCompactAmount(tvl ?? 0n)} cUSDC`;

  const title = tab === "tvl" ? "Vault TVL" : "Prize per draw";
  const prizeAllEqual =
    prizeRows.length > 1 && prizeRows.every((row) => row.prizeAmount === prizeRows[0]?.prizeAmount);
  const lede =
    tab === "tvl"
      ? "How much cUSDC is in the vault. Taller columns mean a larger public pool."
      : prizeAllEqual
        ? `Each block is one settled draw. All paid ${formatCompactAmount(prizeMax)} cUSDC, so the bars are the same height.`
        : "Each block is one settled draw. Height is that draw's public prize, relative to the largest on this chart.";

  function onTabListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const index = TABS.findIndex((item) => item.id === tab);
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = TABS[(index + delta + TABS.length) % TABS.length];
    if (next) setTab(next.id);
  }

  const startDate = axisLabel(firstTvl?.timestamp);
  const endDate = axisLabel(lastTvl?.timestamp);
  const tvlXLeft = tvlSeries.length <= 1 || startDate === endDate ? "" : startDate;
  const tvlXRight = tvlSeries.length <= 1 ? "Now" : endDate || "Now";

  return (
    <section className={`${cardClass} mb-0 p-0 sm:p-0`}>
      <div className="px-6 pt-6 sm:px-8 sm:pt-8">
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <p className="m-0 font-mono text-[0.68rem] tracking-[0.18em] text-ember/75">POOL</p>
            <h2 className="m-0 mt-2 font-dm-sans text-[1.35rem] font-medium tracking-tight text-ink">
              {title}
            </h2>
          </div>
          {configured ? (
            <div className="flex shrink-0 items-start gap-8">
              <HeaderStat label={clockLabel} value={clockValue} />
              <HeaderStat label="TVL" value={headline} />
            </div>
          ) : null}
        </div>
        <p className={`${ledeClass} mt-2 max-w-xl text-[0.88rem]`}>{lede}</p>
      </div>

      <div
        role="tablist"
        aria-label="Pool charts"
        className="relative m-0 mt-5 flex list-none items-end gap-7 border-b border-line px-6 sm:px-8"
        onKeyDown={onTabListKeyDown}
      >
        {TABS.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`chart-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`chart-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              className={`${actionTabClass} ${selected ? actionTabActiveClass : ""}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        id="chart-panel-tvl"
        role="tabpanel"
        aria-labelledby="chart-tab-tvl"
        hidden={tab !== "tvl"}
        className={tab === "tvl" ? "px-6 pb-6 pt-6 sm:px-8 sm:pb-8" : "hidden"}
      >
        {!configured ? (
          <QuietState text="Set contract addresses to load vault history." />
        ) : tvlReady ? (
          <ChartFrame
            yMax={`${formatCompactAmount(tvlMax)} cUSDC`}
            xLeft={tvlXLeft}
            xRight={tvlXRight}
          >
            <DotMatrixChart points={tvlPoints} mode="area" />
          </ChartFrame>
        ) : history.isLoading || tvlLoading ? (
          <QuietState text="Loading pool data…" />
        ) : (
          <QuietState text="Not enough vault history to plot yet." />
        )}
      </div>

      <div
        id="chart-panel-prize"
        role="tabpanel"
        aria-labelledby="chart-tab-prize"
        hidden={tab !== "prize"}
        className={tab === "prize" ? "px-6 pb-6 pt-6 sm:px-8 sm:pb-8" : "hidden"}
      >
        {!configured ? (
          <QuietState text="Set contract addresses to load draw history." />
        ) : prizeReady ? (
          <ChartFrame
            yMax={`${formatCompactAmount(prizeMax)} cUSDC`}
            xLeft=""
            xRight=""
          >
            <DotMatrixChart points={prizePoints} mode="bars" />
          </ChartFrame>
        ) : draws.historyLoading ? (
          <QuietState text="Loading draw history…" />
        ) : draws.historyError ? (
          <QuietState text="Could not load draw history." />
        ) : (
          <QuietState text="No settled draws yet." />
        )}
      </div>
    </section>
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
      <div className="flex h-[200px] shrink-0 flex-col justify-between py-0.5 text-right font-mono text-[0.68rem] tabular-nums leading-none text-muted whitespace-nowrap">
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
    <p className="m-0 py-16 text-center text-[0.92rem] leading-relaxed text-muted">{text}</p>
  );
}
