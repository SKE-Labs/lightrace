import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Design-system section label classes — all-caps muted label above grouped content. */
export const SECTION_LABEL = "text-xs font-medium uppercase tracking-wider text-muted-foreground";

/**
 * Shared base classes for form controls (Input / Textarea / Select trigger).
 * Covers border, surface, transition, focus ring, disabled, and aria-invalid states.
 * Per-control specifics (sizing, placeholder, layout) layer on top.
 */
export const FORM_FIELD_BASE =
  "rounded-md border border-input bg-input/20 dark:bg-input/30 text-foreground transition-colors duration-150 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

// Re-export from shared utils subpath (avoids bundling server-only deps like ioredis)
export {
  formatDuration,
  formatTokens,
  formatCost,
  formatRelativeTime,
} from "@lightrace/shared/utils";

import { formatCost as _formatCost } from "@lightrace/shared/utils";

/**
 * Format a Prisma Decimal / string / number / null cost value.
 * Returns null for null/undefined/zero so callers can conditionally render.
 */
export function formatCostDecimal(value: unknown): string | null {
  if (value == null) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return null;
  return _formatCost(num);
}

/**
 * Type-safe tRPC error code check — standardize on `error.data.code` instead of string matching.
 */
export function isUnauthorizedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { data?: { code?: string }; message?: string };
  if (maybe.data?.code === "UNAUTHORIZED") return true;
  // Fallback for string-based errors (legacy)
  if (typeof maybe.message === "string" && maybe.message.includes("UNAUTHORIZED")) return true;
  return false;
}
