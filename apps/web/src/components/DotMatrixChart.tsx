"use client";

import { useMemo } from "react";

const ROWS = 16;
const AREA_COLS = 40;

export type DotSeriesPoint = {
  value: number;
  label?: string;
  caption?: string;
};

type DotMatrixChartProps = {
  points: DotSeriesPoint[];
  mode: "area" | "bars";
};

type Cell = {
  col: number;
  row: number;
  opacity: number;
};

function resample(values: number[], cols: number): number[] {
  if (values.length === 0) return [];
  if (values.length === cols) return values;
  if (values.length === 1) return Array.from({ length: cols }, () => values[0] ?? 0);
  const out: number[] = [];
  const last = cols - 1;
  for (let i = 0; i < cols; i += 1) {
    const t = (i / last) * (values.length - 1);
    const i0 = Math.floor(t);
    const i1 = Math.min(values.length - 1, i0 + 1);
    const f = t - i0;
    out.push((values[i0] ?? 0) * (1 - f) + (values[i1] ?? 0) * f);
  }
  return out;
}

function heightFor(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.max(1, Math.round((value / max) * ROWS));
}

function barLayout(count: number) {
  const gap = 2;
  const barWidth = Math.max(3, Math.floor((AREA_COLS - (count + 1) * gap) / count));
  const used = count * barWidth + (count + 1) * gap;
  const extra = Math.max(0, AREA_COLS - used);
  const start = gap + 1 + Math.floor(extra / 2);
  return { gap, barWidth, start };
}

function areaCells(values: number[]): Cell[] {
  const max = Math.max(...values, 0);
  const cols = resample(values, AREA_COLS);
  const cells: Cell[] = [];
  for (let col = 0; col < cols.length; col += 1) {
    const h = heightFor(cols[col] ?? 0, max);
    for (let filled = 0; filled < h; filled += 1) {
      const row = ROWS - filled;
      const rise = h <= 1 ? 1 : filled / (h - 1);
      cells.push({
        col: col + 1,
        row,
        opacity: 0.28 + 0.42 * rise,
      });
    }
  }
  return cells;
}

function barCells(values: number[]): Cell[] {
  const n = values.length;
  if (n === 0) return [];
  const { gap, barWidth, start } = barLayout(n);
  const max = Math.max(...values, 0);
  const cells: Cell[] = [];

  let col = start;
  for (let i = 0; i < n; i += 1) {
    const h = heightFor(values[i] ?? 0, max);
    for (let bx = 0; bx < barWidth; bx += 1) {
      for (let filled = 0; filled < h; filled += 1) {
        const row = ROWS - filled;
        const rise = h <= 1 ? 1 : filled / (h - 1);
        cells.push({
          col: col + bx,
          row,
          opacity: 0.32 + 0.48 * rise,
        });
      }
    }
    col += barWidth + gap;
  }
  return cells;
}

export function DotMatrixChart({ points, mode }: DotMatrixChartProps) {
  const values = useMemo(() => points.map((p) => p.value), [points]);
  const cells = useMemo(
    () => (mode === "bars" ? barCells(values) : areaCells(values)),
    [mode, values],
  );
  const layout = mode === "bars" ? barLayout(points.length) : null;

  return (
    <div>
      <div className="h-[200px] w-full" aria-hidden="true">
        <div
          className="grid h-full w-full"
          style={{
            gridTemplateColumns: `repeat(${AREA_COLS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
            gap: "2px",
          }}
        >
          {cells.map((cell) => (
            <span
              key={`${cell.col}-${cell.row}`}
              className="block place-self-center rounded-full bg-ember"
              style={{
                gridColumn: cell.col,
                gridRow: cell.row,
                width: "78%",
                height: "78%",
                opacity: cell.opacity,
              }}
            />
          ))}
        </div>
      </div>
      {layout && points.some((point) => point.label || point.caption) ? (
        <div
          className="mt-3 grid"
          style={{
            gridTemplateColumns: `repeat(${AREA_COLS}, minmax(0, 1fr))`,
            gap: "2px",
          }}
        >
          {points.map((point, index) => (
            <div
              key={`${point.label ?? index}-${index}`}
              className="text-center"
              style={{
                gridColumn: `${layout.start + index * (layout.barWidth + layout.gap)} / span ${layout.barWidth}`,
              }}
            >
              {point.label ? (
                <p className="m-0 font-mono text-[0.72rem] tabular-nums text-ink">{point.label}</p>
              ) : null}
              {point.caption ? (
                <p className="m-0 mt-0.5 font-mono text-[0.68rem] tabular-nums text-muted">{point.caption}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
