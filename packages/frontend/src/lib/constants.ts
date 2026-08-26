/** Centralized frontend constants — page sizes, debounce, realtime, layout. */

export const PAGE_SIZE = {
  TRACES: 20,
  ERRORS: 20,
  ERROR_EVENTS: 10,
  TOOLS: 12,
} as const;

export const SEARCH_DEBOUNCE_MS = 300;

export const REALTIME_THROTTLE_MS = 500;
export const REALTIME_DETAIL_THROTTLE_MS = 200;
export const REALTIME_REFETCH_INTERVAL_MS = 30_000;
export const TOOLS_REFETCH_INTERVAL_MS = 10_000;
export const HEALTH_REFETCH_INTERVAL_MS = 15_000;

export const RESIZABLE = {
  TRACE_TREE_DEFAULT: 420,
  TRACE_TREE_MIN: 280,
  TRACE_TREE_MAX: 700,
  COMPARE_DEFAULT: 320,
  COMPARE_MIN: 240,
  COMPARE_MAX: 500,
} as const;

export const LOCAL_STORAGE_KEYS = {
  TRACE_TREE_WIDTH: "lightrace-tree-width",
} as const;
