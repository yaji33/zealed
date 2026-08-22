"use client";

import { useMemo } from "react";

export type StepVisual = "deposit" | "yield" | "draw" | "claim";

const COLS = 44;
const ROWS = 24;

type Dot = {
  x: number;
  y: number;
  opacity: number;
  scale: number;
};

function rasterize(dots: Dot[]): Dot[] {
  const grid = new Map<string, Dot>();
  for (const dot of dots) {
    const x = Math.round(dot.x);
    const y = Math.round(dot.y);
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) continue;
    const key = `${x},${y}`;
    const prev = grid.get(key);
    if (!prev || dot.opacity > prev.opacity) {
      grid.set(key, { ...dot, x, y });
    }
  }
  return [...grid.values()];
}

function fibonacciSphere(n: number, cx: number, cy: number, r: number): Dot[] {
  const dots: Dot[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1);
    const y3 = 1 - t * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y3 * y3));
    const theta = golden * i;
    const x3 = Math.cos(theta) * ring;
    const z3 = Math.sin(theta) * ring;

    const sx = cx + x3 * r;
    const sy = cy - y3 * r * 0.92;
    const silhouette = Math.hypot(x3, z3);
    const opacity = 0.14 + 0.86 * silhouette ** 0.62;
    const scale = 0.42 + 0.58 * silhouette ** 0.75;

    dots.push({ x: sx, y: sy, opacity, scale });
  }

  return dots;
}

function sphereLatLines(cx: number, cy: number, r: number): Dot[] {
  const dots: Dot[] = [];
  for (let lat = -70; lat <= 70; lat += 14) {
    const phi = (lat * Math.PI) / 180;
    const ry = r * Math.cos(phi);
    const y = cy - r * Math.sin(phi) * 0.92;
    if (ry < 0.6) continue;
    for (let deg = 0; deg < 360; deg += 9) {
      const t = (deg * Math.PI) / 180;
      const silhouette = Math.abs(Math.cos(t));
      dots.push({
        x: cx + ry * Math.cos(t),
        y,
        opacity: 0.22 + 0.55 * silhouette,
        scale: 0.55 + 0.35 * silhouette,
      });
    }
  }
  return dots;
}

function buildDepositCloud(): Dot[] {
  const cx = 22;
  const dots: Dot[] = [];
  const heights = [5, 8.5, 12, 15.5, 19];
  const rxTop = 9;
  const rxBot = 11;

  for (let h = 0; h < heights.length; h += 1) {
    const y = heights[h] ?? 0;
    const t = h / (heights.length - 1);
    const rx = rxTop + (rxBot - rxTop) * t;
    const ry = 2.2 + t * 0.4;
    for (let deg = 0; deg < 360; deg += 7) {
      const a = (deg * Math.PI) / 180;
      const edge = Math.abs(Math.sin(a));
      dots.push({
        x: cx + rx * Math.cos(a),
        y,
        opacity: 0.25 + 0.65 * edge,
        scale: 0.5 + 0.45 * edge,
      });
    }
  }

  for (const side of [-1, 1]) {
    const x0 = cx + side * rxTop;
    const x1 = cx + side * rxBot;
    for (let t = 0; t <= 1; t += 0.04) {
      dots.push({
        x: x0 + (x1 - x0) * t,
        y: (heights[0] ?? 0) + ((heights.at(-1) ?? 0) - (heights[0] ?? 0)) * t,
        opacity: 0.55,
        scale: 0.75,
      });
    }
  }

  return rasterize(dots);
}

function buildYieldCloud(): Dot[] {
  const dots: Dot[] = [];
  const baseY = 20;
  const bars = [
    { x: 10, w: 5, h: 6 },
    { x: 17, w: 5, h: 9 },
    { x: 24, w: 5, h: 12 },
    { x: 31, w: 5, h: 15 },
  ];

  for (let x = 7; x <= 37; x += 1.1) {
    dots.push({ x, y: baseY, opacity: 0.35, scale: 0.55 });
  }

  for (const bar of bars) {
    for (let py = baseY - bar.h; py <= baseY; py += 0.85) {
      for (let px = bar.x; px <= bar.x + bar.w; px += 0.85) {
        const rise = (baseY - py) / bar.h;
        dots.push({
          x: px,
          y: py,
          opacity: 0.35 + 0.55 * rise,
          scale: 0.48 + 0.42 * rise,
        });
      }
    }
  }

  return rasterize(dots);
}

function buildDrawCloud(): Dot[] {
  const cx = 22;
  const cy = 11;
  const r = 9;
  return rasterize([...fibonacciSphere(220, cx, cy, r), ...sphereLatLines(cx, cy, r)]);
}

function buildClaimCloud(): Dot[] {
  const dots: Dot[] = [];
  const cx = 22;
  const cy = 12;
  const R = 7.5;
  const tube = 2.4;

  for (let u = 0; u < Math.PI * 2; u += 0.11) {
    for (let v = 0; v < Math.PI * 2; v += 0.22) {
      const x3 = (R + tube * Math.cos(v)) * Math.cos(u);
      const y3 = tube * Math.sin(v);
      const z3 = (R + tube * Math.cos(v)) * Math.sin(u);

      const sx = cx + x3 * 0.95;
      const sy = cy - y3 * 0.95 + z3 * 0.08;
      const rim = Math.abs(Math.cos(v));
      const opacity = 0.2 + 0.75 * rim;
      const scale = 0.45 + 0.5 * rim;

      dots.push({ x: sx, y: sy, opacity, scale });
    }
  }

  return rasterize(dots);
}

const CLOUD_BUILDERS: Record<StepVisual, () => Dot[]> = {
  deposit: buildDepositCloud,
  yield: buildYieldCloud,
  draw: buildDrawCloud,
  claim: buildClaimCloud,
};

type StepPixelArtProps = {
  type: StepVisual;
};

export function StepPixelArt({ type }: StepPixelArtProps) {
  const dots = useMemo(() => CLOUD_BUILDERS[type](), [type]);

  return (
    <div className="mb-6 flex h-32 w-full items-center justify-center" aria-hidden="true">
      <div
        className="grid shrink-0"
        style={{
          gridTemplateColumns: `repeat(${COLS}, 2px)`,
          gridTemplateRows: `repeat(${ROWS}, 2px)`,
          gap: "1.5px",
        }}
      >
        {dots.map((dot) => (
          <span
            key={`${dot.x}-${dot.y}`}
            className="block rounded-full bg-ember"
            style={{
              gridColumn: dot.x + 1,
              gridRow: dot.y + 1,
              width: `${2 * dot.scale}px`,
              height: `${2 * dot.scale}px`,
              opacity: dot.opacity,
            }}
          />
        ))}
      </div>
    </div>
  );
}
