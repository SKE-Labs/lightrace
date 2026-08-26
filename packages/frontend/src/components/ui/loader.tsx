import React from "react";
import { cn } from "@/lib/utils";

interface LoaderProps {
  className?: string;
  /** Size of the loader */
  size?: "sm" | "md" | "lg";
}

const sizeMap: Record<NonNullable<LoaderProps["size"]>, { box: number; dot: number }> = {
  sm: { box: 16, dot: 2 },
  md: { box: 20, dot: 3 },
  lg: { box: 24, dot: 4 },
};

const GRID = 5;

// Cells (col, row) for each shape layer. Layers turn on progressively to form
// nested shapes: dot → diamond → square → star (square + extensions), then
// peel back to dot. Each layer's cells are kept in its own array so a single
// opacity animation per layer is enough.
//
// Note: SQUARE's 4 inner-cross cells are the same cells as DIAMOND. Rendering
// both is fine — they overlap at the same coordinates with the same color, so
// the cross cells stay visibly lit throughout the diamond→square transition
// (one layer fades out as the other fades in, with the cells in common
// composited to opacity ≈ 1 the whole time).
const CENTER: readonly [number, number] = [2, 2];
const DIAMOND: ReadonlyArray<readonly [number, number]> = [
  [2, 1],
  [1, 2],
  [3, 2],
  [2, 3],
];
const SQUARE: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [2, 1],
  [3, 1],
  [1, 2],
  [3, 2],
  [1, 3],
  [2, 3],
  [3, 3],
];
const EXTENSIONS: ReadonlyArray<readonly [number, number]> = [
  [2, 0],
  [0, 2],
  [4, 2],
  [2, 4],
];

// Snap each dot to integer pixel coordinates so the rendered circle stays
// crisp regardless of grid size. (Box sizes like 24 don't divide evenly by
// GRID=5, so the unrounded centers would otherwise sit on sub-pixel positions,
// which makes Tailwind's rounded-full render some dots as fuzzy ovals.)
function cellStyle(c: number, r: number, step: number, dot: number): React.CSSProperties {
  const cx = Math.round((c + 0.5) * step);
  const cy = Math.round((r + 0.5) * step);
  const half = Math.round(dot / 2);
  return {
    width: dot,
    height: dot,
    left: cx - half,
    top: cy - half,
  };
}

function dotStyle(c: number, r: number, box: number, dot: number): React.CSSProperties {
  return cellStyle(c, r, box / GRID, dot);
}

export function Loader({ className, size = "md" }: LoaderProps) {
  const { box, dot } = sizeMap[size];

  return (
    <div
      className={cn("flex justify-center items-center p-4", className)}
      role="status"
      aria-label="Loading"
    >
      <div className="relative" style={{ width: box, height: box }}>
        {Array.from({ length: GRID * GRID }).map((_, i) => {
          const c = i % GRID;
          const r = Math.floor(i / GRID);
          return (
            <span
              key={i}
              aria-hidden
              className="loader-dim rounded-full absolute block"
              style={dotStyle(c, r, box, dot)}
            />
          );
        })}
        <span
          aria-hidden
          className="loader-cell loader-cell-center absolute block rounded-full"
          style={dotStyle(CENTER[0], CENTER[1], box, dot)}
        />
        {DIAMOND.map(([c, r], i) => (
          <span
            key={`di-${i}`}
            aria-hidden
            className="loader-cell loader-cell-diamond absolute block rounded-full"
            style={dotStyle(c, r, box, dot)}
          />
        ))}
        {SQUARE.map(([c, r], i) => (
          <span
            key={`sq-${i}`}
            aria-hidden
            className="loader-cell loader-cell-square absolute block rounded-full"
            style={dotStyle(c, r, box, dot)}
          />
        ))}
        {EXTENSIONS.map(([c, r], i) => (
          <span
            key={`ex-${i}`}
            aria-hidden
            className="loader-cell loader-cell-extension absolute block rounded-full"
            style={dotStyle(c, r, box, dot)}
          />
        ))}
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// ThinkingDots — the Loader's inline sibling for chat working/thinking
// states: a 2×3 dot column sized to sit next to a line of small text. Same
// dot grid + `--ds-loader-bright` family as Loader; the animation is a
// brightness wave sweeping the rows top→bottom (see `.loader-wave-cell`).
const WAVE_COLS = 2;
const WAVE_ROWS = 3;

const waveSizeMap: Record<NonNullable<LoaderProps["size"]>, { step: number; dot: number }> = {
  sm: { step: 4, dot: 2 },
  md: { step: 5, dot: 3 },
  lg: { step: 6, dot: 4 },
};

export function ThinkingDots({ className, size = "sm" }: LoaderProps) {
  const { step, dot } = waveSizeMap[size];

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: WAVE_COLS * step, height: WAVE_ROWS * step }}
      role="status"
      aria-label="Working"
    >
      {Array.from({ length: WAVE_COLS * WAVE_ROWS }).map((_, i) => {
        const c = i % WAVE_COLS;
        const r = Math.floor(i / WAVE_COLS);
        return (
          <span
            key={i}
            aria-hidden
            className={cn("loader-wave-cell absolute block rounded-full", `loader-wave-row-${r}`)}
            style={cellStyle(c, r, step, dot)}
          />
        );
      })}
    </div>
  );
}
