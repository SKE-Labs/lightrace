"use client";

import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/ui/copy-button";

export function MetadataRow({
  label,
  value,
  mono,
  copyable,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 group">
      <span className="text-xs text-muted-foreground shrink-0 pt-0.5">{label}</span>
      <div className="flex items-start gap-1.5 min-w-0 flex-1 justify-end">
        <span
          className={cn(
            "text-xs text-right break-words whitespace-pre-wrap [overflow-wrap:anywhere] max-w-[68%]",
            mono && "font-mono",
          )}
        >
          {value}
        </span>
        {copyable && (
          <CopyButton
            text={value}
            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
          />
        )}
      </div>
    </div>
  );
}
