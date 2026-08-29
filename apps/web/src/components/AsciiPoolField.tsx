"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDrawCycle } from "@/hooks/useDrawCycle";
import { usePublicDrawData } from "@/hooks/usePublicDrawData";
import { useVaultTvl } from "@/hooks/useVaultTvl";
import { contractsConfigured } from "@/lib/config";
import { formatCountdown, formatUnits } from "@/lib/format";

const COLS = 96;
const ROWS = 18;
const SEED = 0x5ea1ed; 

const BANDS = ["", "·.:'`", "-=+x?", "%&#@"] as const;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildBandGrid(): number[][] {
  const rand = mulberry32(SEED);
  const grid: number[][] = [];
  for (let y = 0; y < ROWS; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < COLS; x += 1) {
      const nx = x / (COLS - 1);
      const ny = y / (ROWS - 1);
      const dx = (nx - 0.5) / 0.52;
      const dy = (ny - 0.68) / 0.72;
      const dome = Math.max(0, 1 - (dx * dx + dy * dy));
      const noise = rand();
      const i = dome > 0 ? dome * 0.8 + noise * 0.32 : noise * 0.16;
      row.push(i < 0.12 ? 0 : i < 0.38 ? 1 : i < 0.68 ? 2 : 3);
    }
    grid.push(row);
  }
  return grid;
}

function glyphFor(band: number, rand: () => number): string {
  if (band === 0) return " ";
  const set = BANDS[band];
  return set[Math.floor(rand() * set.length)] ?? " ";
}

function renderRows(bands: number[][], rand: () => number): string[] {
  return bands.map((row) => row.map((band) => glyphFor(band, rand)).join(""));
}

function formatCompactAmount(value: bigint): string {
  const n = Number(formatUnits(value));
  if (!Number.isFinite(n)) return formatUnits(value);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 100_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function AsciiPoolField() {
  const configured = contractsConfigured();
  const { data: tvl } = useVaultTvl();
  const { prizeAmountPlain } = usePublicDrawData();
  const cycle = useDrawCycle();

  const bands = useMemo(buildBandGrid, []);
  const initialRows = useMemo(() => renderRows(bands, mulberry32(SEED ^ 0x9e3779b9)), [bands]);
  const [rows, setRows] = useState<string[]>(initialRows);
  const rowsRef = useRef<string[][]>(initialRows.map((r) => r.split("")));

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rand = mulberry32(Date.now() >>> 0);
    const timer = setInterval(() => {
      const cells = rowsRef.current;
      for (let i = 0; i < 14; i += 1) {
        const y = Math.floor(rand() * ROWS);
        const x = Math.floor(rand() * COLS);
        const band = bands[y]?.[x] ?? 0;
        if (band === 0) continue;
        const cellRow = cells[y];
        if (cellRow) cellRow[x] = glyphFor(band, rand);
      }
      setRows(cells.map((r) => r.join("")));
    }, 220);
    return () => clearInterval(timer);
  }, [bands]);

  const poolTotal = !configured || tvl === undefined ? undefined : tvl;
  const prize = !configured ? undefined : prizeAmountPlain;

  const nextDrawText = !configured
    ? "--:--:--"
    : cycle.phase === "loading"
      ? "--:--:--"
      : cycle.phase === "missed"
        ? "missed"
        : formatCountdown(cycle.secondsRemaining);

  return (
    <div className="relative py-2">
      <pre
        className="m-0 overflow-hidden select-none text-center font-mono text-[clamp(7px,1.05vw,12px)] leading-[1.35] tracking-[0.12em] text-ember/50"
        aria-hidden="true"
      >
        {rows.join("\n")}
      </pre>
      <div className="absolute inset-0 flex flex-wrap items-center justify-evenly gap-4 max-[760px]:static max-[760px]:pt-3">
        <div className="flex flex-col items-center gap-1.5 px-7 py-4 text-center [background:radial-gradient(closest-side,rgba(10,10,10,0.92),rgba(10,10,10,0.55)_70%,transparent)] max-[760px]:bg-none max-[760px]:px-3 max-[760px]:py-2">
          <span className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted">
            Pool total
          </span>
          <span className="font-mono text-[clamp(1.15rem,2.2vw,1.6rem)] tabular-nums text-ink">
            {poolTotal === undefined ? "--" : formatCompactAmount(poolTotal)}{" "}
            <span className="text-[0.7em] text-muted">cUSDC</span>
          </span>
        </div>
        <div className="flex flex-col items-center gap-1.5 px-7 py-4 text-center [background:radial-gradient(closest-side,rgba(10,10,10,0.92),rgba(10,10,10,0.55)_70%,transparent)] max-[760px]:bg-none max-[760px]:px-3 max-[760px]:py-2">
          <span className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted">
            Current prize
          </span>
          <span className="font-mono text-[clamp(1.15rem,2.2vw,1.6rem)] tabular-nums text-ink">
            {prize === undefined ? "--" : formatCompactAmount(prize)}{" "}
            <span className="text-[0.7em] text-muted">cUSDC</span>
          </span>
        </div>
        <div className="flex flex-col items-center gap-1.5 px-7 py-4 text-center [background:radial-gradient(closest-side,rgba(10,10,10,0.92),rgba(10,10,10,0.55)_70%,transparent)] max-[760px]:bg-none max-[760px]:px-3 max-[760px]:py-2">
          <span className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted">
            Next draw
          </span>
          <span
            className="font-mono text-[clamp(1.15rem,2.2vw,1.6rem)] tabular-nums text-ink"
            suppressHydrationWarning
          >
            {nextDrawText}
          </span>
        </div>
      </div>
    </div>
  );
}
