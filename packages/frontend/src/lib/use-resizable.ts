"use client";

import { useState, useRef, useCallback } from "react";

interface UseResizableOptions {
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  storageKey?: string;
  side?: "left" | "right";
}

/**
 * Resizable pane hook — handles mouse drag, cursor styling, and optional localStorage persistence.
 */
export function useResizable({
  defaultWidth,
  minWidth,
  maxWidth,
  storageKey,
  side = "left",
}: UseResizableOptions) {
  const [width, setWidth] = useState(() => {
    if (storageKey && typeof window !== "undefined") {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) return parsed;
      }
    }
    return defaultWidth;
  });

  const panelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const panel = panelRef.current;
      const container = containerRef.current;
      if (!panel) return;

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      let currentWidth = panel.offsetWidth;

      const handleMouseMove = (ev: MouseEvent) => {
        if (side === "left" && container) {
          const rect = container.getBoundingClientRect();
          currentWidth = Math.max(minWidth, Math.min(maxWidth, ev.clientX - rect.left));
        } else if (side === "left") {
          // Fallback when no containerRef: use panel rect
          const rect = panel.getBoundingClientRect();
          currentWidth = Math.max(minWidth, Math.min(maxWidth, ev.clientX - rect.left));
        } else {
          const rect = panel.getBoundingClientRect();
          currentWidth = Math.max(minWidth, Math.min(maxWidth, rect.right - ev.clientX));
        }
        panel.style.width = `${currentWidth}px`;
      };

      const handleMouseUp = () => {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        setWidth(currentWidth);
        if (storageKey) localStorage.setItem(storageKey, String(currentWidth));
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [minWidth, maxWidth, storageKey, side],
  );

  return { width, panelRef, containerRef, handleMouseDown, setWidth } as const;
}

/**
 * Factory for dual-pane resizable layouts (e.g., compare view with two side-by-side trees).
 * Returns a callback factory compatible with the previous `createResizeHandler` API but deduped.
 */
export function useResizablePair(opts: {
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
}) {
  const left = useResizable({ ...opts, side: "left" });
  const right = useResizable({ ...opts, side: "right" });
  return { left, right } as const;
}
