"use client";

import { useEffect, useMemo, useState } from "react";

export type StepVisual = "deposit" | "yield" | "draw" | "claim";

const COLS = 44;
const ROWS = 24;
const CELL = 2.5;
const GAP = 2;
const DISPLAY_SCALE = 1.22;
const CX = 22;

type Dot = {
  x: number;
  y: number;
  opacity: number;
  scale: number;
};

type Point3 = { x: number; y: number; z: number };

type ShellPoint = Point3 & { weight: number };

type Rotator = {
  y: number;
  x: number;
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

function rotateY(p: Point3, angle: number): Point3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
}

function rotateX(p: Point3, angle: number): Point3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
}

function projectMesh(
  mesh: Point3[],
  cx: number,
  cy: number,
  radius: number,
  rotY: number,
  rotX: number,
): Dot[] {
  const projected: Dot[] = [];

  for (const raw of mesh) {
    let p = rotateY(raw, rotY);
    p = rotateX(p, rotX);

    const sx = cx + p.x * radius;
    const sy = cy - p.y * radius * 0.9;
    const depth = 0.5 + 0.5 * p.z;
    const rim = Math.hypot(p.x, p.z);

    projected.push({
      x: sx,
      y: sy,
      opacity: 0.12 + 0.48 * depth + 0.38 * rim ** 0.68,
      scale: 0.42 + 0.32 * depth + 0.26 * rim ** 0.75,
    });
  }

  return projected;
}

/** Hollow shell — pole-heavy scatter, back-face culled, no rim fill. */
function projectSphereShell(
  mesh: ShellPoint[],
  cx: number,
  cy: number,
  radius: number,
  rotY: number,
  rotX: number,
): Dot[] {
  const projected: Dot[] = [];

  for (const raw of mesh) {
    let p = rotateY(raw, rotY);
    p = rotateX(p, rotX);

    if (p.z < -0.06) continue;

    const sx = cx + p.x * radius;
    const sy = cy - p.y * radius;
    const depth = (p.z + 1) * 0.5;

    projected.push({
      x: sx,
      y: sy,
      opacity: (0.22 + 0.58 * depth) * raw.weight,
      scale: (0.34 + 0.18 * depth) * (0.82 + 0.36 * raw.weight),
    });
  }

  return projected;
}

function createSeededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

/** Random surface points with dense caps at the poles — matches reference orb. */
function buildSphereShell(count: number): ShellPoint[] {
  const rand = createSeededRandom(9031);
  const pts: ShellPoint[] = [];
  const poleBias = 0.34;

  for (let i = 0; i < count; i += 1) {
    const theta = rand() * Math.PI * 2;
    const y0 = (rand() < 0.5 ? 1 : -1) * rand() ** poleBias;
    const ring = Math.sqrt(Math.max(0, 1 - y0 * y0));
    const jitter = 0.018;
    let x = ring * Math.cos(theta) + (rand() - 0.5) * jitter;
    let y = y0 + (rand() - 0.5) * jitter;
    let z = ring * Math.sin(theta) + (rand() - 0.5) * jitter;
    const len = Math.hypot(x, y, z) || 1;

    pts.push({
      x: x / len,
      y: y / len,
      z: z / len,
      weight: 0.72 + rand() * 0.56,
    });
  }

  return pts;
}

function addBoxFace(
  pts: Point3[],
  axis: "x" | "y" | "z",
  fixed: number,
  uMin: number,
  uMax: number,
  vMin: number,
  vMax: number,
  step: number,
): void {
  for (let u = uMin; u <= uMax; u += step) {
    for (let v = vMin; v <= vMax; v += step) {
      if (axis === "x") pts.push({ x: fixed, y: u, z: v });
      if (axis === "y") pts.push({ x: u, y: fixed, z: v });
      if (axis === "z") pts.push({ x: u, y: v, z: fixed });
    }
  }
}

/** 3D padlock — body + open shackle, reads with depth when tumbled. */
function buildLockMesh(): Point3[] {
  const pts: Point3[] = [];
  const bx = 0.38;
  const by0 = -0.42;
  const by1 = 0.28;
  const bz = 0.2;
  const step = 0.11;

  addBoxFace(pts, "x", -bx, by0, by1, -bz, bz, step);
  addBoxFace(pts, "x", bx, by0, by1, -bz, bz, step);
  addBoxFace(pts, "y", by0, -bx, bx, -bz, bz, step);
  addBoxFace(pts, "y", by1, -bx, bx, -bz, bz, step);
  addBoxFace(pts, "z", bz, -bx, bx, by0, by1, step);

  const R = 0.34;
  const tube = 0.075;
  const shackleY = 0.34;
  for (let u = 0.15; u <= Math.PI - 0.15; u += 0.13) {
    for (let v = 0; v < Math.PI * 2; v += 0.42) {
      pts.push({
        x: (R + tube * Math.cos(v)) * Math.cos(u),
        y: shackleY + tube * Math.sin(v),
        z: (R + tube * Math.cos(v)) * Math.sin(u) * 0.55,
      });
    }
  }

  for (let leg = 0; leg <= 1; leg += 0.08) {
    pts.push({ x: -R + 0.02, y: shackleY - leg * 0.28, z: 0 });
    pts.push({ x: R - 0.02, y: shackleY - leg * 0.28, z: 0 });
  }

  for (let a = 0; a < Math.PI * 2; a += 0.45) {
    pts.push({
      x: Math.cos(a) * 0.07,
      y: -0.05,
      z: bz + 0.01,
    });
  }
  for (let t = 0; t <= 1; t += 0.12) {
    pts.push({ x: 0, y: -0.05 - t * 0.14, z: bz + 0.01 });
  }

  return pts;
}

function buildDepositCloud(): Dot[] {
  const dots: Dot[] = [];
  const heights = [4, 8, 12, 16, 20];
  const rxTop = 10.5;
  const rxBot = 12.5;

  for (let h = 0; h < heights.length; h += 1) {
    const y = heights[h] ?? 0;
    const t = h / (heights.length - 1);
    const rx = rxTop + (rxBot - rxTop) * t;
    for (let deg = 0; deg < 360; deg += 7) {
      const a = (deg * Math.PI) / 180;
      const edge = Math.abs(Math.sin(a));
      dots.push({
        x: CX + rx * Math.cos(a),
        y,
        opacity: 0.25 + 0.65 * edge,
        scale: 0.5 + 0.45 * edge,
      });
    }
  }

  for (const side of [-1, 1]) {
    const x0 = CX + side * rxTop;
    const x1 = CX + side * rxBot;
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
  const baseY = 21;
  const bars = [
    { x: 9, w: 5.5, h: 7 },
    { x: 16.5, w: 5.5, h: 10 },
    { x: 24, w: 5.5, h: 13 },
    { x: 31.5, w: 5.5, h: 16 },
  ];

  for (let x = 6; x <= 38; x += 1) {
    dots.push({ x, y: baseY, opacity: 0.35, scale: 0.55 });
  }

  for (const bar of bars) {
    for (let py = baseY - bar.h; py <= baseY; py += 0.8) {
      for (let px = bar.x; px <= bar.x + bar.w; px += 0.8) {
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

function waveDelay(dot: Dot, type: StepVisual): string {
  if (type === "yield") return `${dot.x * 42 + dot.y * 18}ms`;
  if (type === "deposit") return `${dot.y * 55 + Math.abs(dot.x - CX) * 20}ms`;
  return `${dot.x * 28 + dot.y * 36}ms`;
}

function useRotator(enabled: boolean, speedY: number, baseX: number, wobbleX: number): Rotator {
  const [rotation, setRotation] = useState<Rotator>({ y: 0, x: baseX });

  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRotation({ y: 0.6, x: baseX });
      return;
    }

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = (now - start) / 1000;
      setRotation({
        y: t * speedY,
        x: baseX + Math.sin(t * 0.85) * wobbleX,
      });
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [enabled, speedY, baseX, wobbleX]);

  return rotation;
}

type StepPixelArtProps = {
  type: StepVisual;
};

/** Halftone point-cloud geometry per flow step, with geometric motion. */
export function StepPixelArt({ type }: StepPixelArtProps) {
  const sphereMesh = useMemo(() => buildSphereShell(620), []);
  const lockMesh = useMemo(() => buildLockMesh(), []);

  const isDraw = type === "draw";
  const isClaim = type === "claim";
  const rotation = useRotator(isDraw, 0.14, 0.32, 0);
  const lockRotation = useRotator(isClaim, 0.55, 0.52, 0.1);

  const staticDots = useMemo(() => {
    if (isDraw || isClaim) return [];
    if (type === "deposit") return buildDepositCloud();
    return buildYieldCloud();
  }, [type, isDraw, isClaim]);

  const dynamicDots = useMemo(() => {
    if (isDraw) {
      return rasterize(
        projectSphereShell(sphereMesh, CX, 11.5, 10.5, rotation.y, rotation.x),
      );
    }
    if (isClaim) {
      return rasterize(
        projectMesh(lockMesh, CX, 12, 9.5, lockRotation.y, lockRotation.x),
      );
    }
    return [];
  }, [isDraw, isClaim, sphereMesh, lockMesh, rotation.y, rotation.x, lockRotation.y, lockRotation.x]);

  const dots = isDraw || isClaim ? dynamicDots : staticDots;
  const gridAnim = type === "deposit" ? "animate-step-breathe motion-reduce:animate-none" : undefined;
  const dotsWave = isDraw || isClaim ? "" : "animate-step-dot-wave motion-reduce:animate-none";

  return (
    <div className="mb-6 flex h-40 w-full items-center justify-center" aria-hidden="true">
      <div className="origin-center" style={{ transform: `scale(${DISPLAY_SCALE})` }}>
        <div className={`origin-center ${gridAnim ?? ""}`}>
          <div
            className="grid shrink-0"
            style={{
              gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
              gridTemplateRows: `repeat(${ROWS}, ${CELL}px)`,
              gap: `${GAP}px`,
            }}
          >
            {dots.map((dot) => {
              const size = CELL * dot.scale;
              return (
                <span
                  key={`${dot.x}-${dot.y}`}
                  className={`block rounded-full bg-ember ${dotsWave}`}
                  style={{
                    gridColumn: dot.x + 1,
                    gridRow: dot.y + 1,
                    width: `${size}px`,
                    height: `${size}px`,
                    opacity: dot.opacity,
                    animationDelay: dotsWave ? waveDelay(dot, type) : undefined,
                    ["--dot-o" as string]: dot.opacity,
                    ["--dot-s" as string]: dot.scale,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
