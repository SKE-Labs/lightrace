"use client";

import { cn } from "@/lib/utils";

interface SegmentedToggleProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  size?: "sm" | "xs";
}

export function SegmentedToggle<T extends string>({
  value,
  onChange,
  options,
  size = "xs",
}: SegmentedToggleProps<T>) {
  const textSize = size === "sm" ? "text-xs" : "text-[10px]";

  return (
    <div className={cn("flex rounded-md border border-border overflow-hidden", textSize)}>
      {options.map((opt, i) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-2.5 py-1 transition-colors",
            i > 0 && "border-l border-border",
            value === opt.value
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
