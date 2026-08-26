"use client";

import { cn } from "@/lib/utils";
import { Loader, ThinkingDots } from "./loader";

const spinnerGridMap = {
  xs: { box: 16, dot: 2 },
  sm: { box: 16, dot: 2 },
  md: { box: 20, dot: 3 },
  lg: { box: 20, dot: 3 },
  xl: { box: 24, dot: 4 },
} as const;

export type SpinnerSize = keyof typeof spinnerGridMap;

// Spinner — inline grid loader inspired by provided design (replaces Loader2 everywhere)
export function Spinner({ size = "sm", className }: { size?: SpinnerSize; className?: string }) {
  const { box, dot } = spinnerGridMap[size];
  const step = box / 5;
  // Reuse the same 5x5 grid logic as Loader but compact without p-4
  const GRID = 5;
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
  function cellStyle(c: number, r: number): React.CSSProperties {
    const cx = Math.round((c + 0.5) * step);
    const cy = Math.round((r + 0.5) * step);
    const half = Math.round(dot / 2);
    return { width: dot, height: dot, left: cx - half, top: cy - half };
  }
  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: box, height: box }}
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: GRID * GRID }).map((_, i) => {
        const c = i % GRID;
        const r = Math.floor(i / GRID);
        return (
          <span
            key={i}
            aria-hidden
            className="loader-dim rounded-full absolute block"
            style={cellStyle(c, r)}
          />
        );
      })}
      <span
        aria-hidden
        className="loader-cell loader-cell-center absolute block rounded-full"
        style={cellStyle(CENTER[0], CENTER[1])}
      />
      {DIAMOND.map(([c, r], i) => (
        <span
          key={`di-${i}`}
          aria-hidden
          className="loader-cell loader-cell-diamond absolute block rounded-full"
          style={cellStyle(c, r)}
        />
      ))}
      {SQUARE.map(([c, r], i) => (
        <span
          key={`sq-${i}`}
          aria-hidden
          className="loader-cell loader-cell-square absolute block rounded-full"
          style={cellStyle(c, r)}
        />
      ))}
      {EXTENSIONS.map(([c, r], i) => (
        <span
          key={`ex-${i}`}
          aria-hidden
          className="loader-cell loader-cell-extension absolute block rounded-full"
          style={cellStyle(c, r)}
        />
      ))}
    </span>
  );
}

// PageLoader — full-page centered loader using the grid Loader (inspired by design)
export function PageLoader({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-muted-foreground">
      <Loader size="lg" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function InlineLoader({ message, size = "xs" }: { message?: string; size?: SpinnerSize }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Spinner size={size} className="text-primary" />
      {message && <span>{message}</span>}
    </span>
  );
}

// LiveInlineLoader — uses ThinkingDots for WS live states
export function LiveInlineLoader({ message = "Live syncing" }: { message?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <ThinkingDots size="sm" />
      <span className="hidden sm:inline">{message}</span>
    </span>
  );
}
