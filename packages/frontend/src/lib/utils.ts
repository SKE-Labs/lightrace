import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Design-system section label classes — all-caps muted label above grouped content. */
export const SECTION_LABEL =
  "text-[11px] font-medium uppercase tracking-wider text-muted-foreground";

// Re-export from shared
export {
  formatDuration,
  formatTokens,
  formatCost,
  formatRelativeTime,
} from "@lightrace/shared/utils";
