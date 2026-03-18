"use client";

import { use, useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useProjectStore } from "@/lib/project-store";
import { useRealtimeTraceDetail } from "@/lib/use-realtime";
import { TraceTree } from "@/components/trace/trace-tree";
import { ObservationDetail } from "@/components/trace/observation-detail";
import Link from "next/link";

export default function TraceDetailPage({ params }: { params: Promise<{ traceId: string }> }) {
  const { traceId } = use(params);
  const projectId = useProjectStore((s) => s.projectId);

  // Real-time updates via WebSocket
  useRealtimeTraceDetail(projectId ?? "", traceId);

  const { data: trace, isLoading } = trpc.traces.byId.useQuery(
    { projectId: projectId!, id: traceId },
    { refetchInterval: 30000, enabled: !!projectId },
  );
  const [selected, setSelected] = useState<{ id: string; isTrace: boolean } | null>(null);

  // Auto-select trace root on load
  useEffect(() => {
    if (trace && !selected) {
      setSelected({ id: trace.id, isTrace: true });
    }
  }, [trace, selected]);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          <div className="h-4 w-12 bg-muted animate-pulse rounded" />
          <span className="text-muted-foreground">/</span>
          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-[420px] flex-shrink-0 border-r border-border p-3 space-y-2">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="size-4 bg-muted animate-pulse rounded" />
                <div
                  className="h-4 bg-muted animate-pulse rounded"
                  style={{ width: `${140 - i * 10}px` }}
                />
              </div>
            ))}
          </div>
          <div className="flex-1 p-4 space-y-4">
            <div className="h-6 w-48 bg-muted animate-pulse rounded" />
            <div className="h-32 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!trace) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <p>Trace not found</p>
        <Link
          href={`/project/${projectId}/traces`}
          className="text-sm text-primary hover:underline"
        >
          Back to traces
        </Link>
      </div>
    );
  }

  const selectedObservation =
    selected && !selected.isTrace ? trace.observations.find((o) => o.id === selected.id) : null;

  return (
    <div className="flex h-full flex-col">
      {/* Split pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Tree panel */}
        <div className="w-[420px] flex-shrink-0 overflow-auto border-r border-border">
          <TraceTree
            trace={trace}
            observations={trace.observations}
            selectedId={selected?.id ?? null}
            onSelect={(id, isTrace) => setSelected({ id, isTrace })}
          />
        </div>

        {/* Detail panel */}
        <div className="flex-1 overflow-hidden">
          {selected?.isTrace && <ObservationDetail type="trace" trace={trace} />}
          {selectedObservation && (
            <ObservationDetail type="observation" observation={selectedObservation} />
          )}
        </div>
      </div>
    </div>
  );
}
