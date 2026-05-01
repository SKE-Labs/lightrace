import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Design-system section label classes — all-caps muted label above grouped content. */
export const SECTION_LABEL =
  "text-[11px] font-medium uppercase tracking-wider text-muted-foreground";

/**
 * Shared base classes for form controls (Input / Textarea / Select trigger).
 * Covers border, surface, transition, focus ring, disabled, and aria-invalid states.
 * Per-control specifics (sizing, placeholder, layout) layer on top.
 */
export const FORM_FIELD_BASE =
  "rounded-md border border-input bg-input/20 dark:bg-input/30 text-foreground transition-colors duration-150 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

// Re-export from shared
export {
  formatDuration,
  formatTokens,
  formatCost,
  formatRelativeTime,
} from "@lightrace/shared/utils";
