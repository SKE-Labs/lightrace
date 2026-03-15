import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Re-export from shared
export {
  formatDuration,
  formatTokens,
  formatCost,
  formatRelativeTime,
} from "@lightrace/shared/utils";
