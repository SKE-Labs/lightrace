"use client";

import { useState } from "react";
import { cn, SECTION_LABEL } from "@/lib/utils";
import { CopyButton } from "@/components/ui/copy-button";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { JsonViewer } from "@/components/trace/json-viewer";
import { FormattedView } from "@/components/trace/formatted-view";

export function DetailSection({
  title,
  data,
  showToggle,
}: {
  title?: string;
  data?: unknown;
  showToggle?: boolean;
}) {
  const [viewMode, setViewMode] = useState<"formatted" | "raw">("formatted");
  const hasData = data !== undefined && data !== null;

  return (
    <div className="space-y-3 min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-2 min-h-7">
        {title && <h3 className={SECTION_LABEL}>{title}</h3>}
        <div className="flex items-center gap-2 shrink-0">
          {showToggle && hasData && (
            <SegmentedToggle
              value={viewMode}
              onChange={setViewMode}
              size="sm"
              options={[
                { value: "formatted", label: "Formatted" },
                { value: "raw", label: "JSON" },
              ]}
            />
          )}
          {hasData && (
            <CopyButton text={typeof data === "string" ? data : JSON.stringify(data, null, 2)} />
          )}
        </div>
      </div>

      {showToggle ? (
        viewMode === "formatted" ? (
          <div className="min-w-0 overflow-hidden">
            <FormattedView data={data} />
          </div>
        ) : (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed overflow-auto max-w-full">
            <JsonViewer data={data} />
          </div>
        )
      ) : null}
    </div>
  );
}
