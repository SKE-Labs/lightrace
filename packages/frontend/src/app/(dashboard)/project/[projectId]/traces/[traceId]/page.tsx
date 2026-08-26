"use client";

import { use, useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useProjectStore } from "@/lib/project-store";
import { useRealtimeTraceDetail } from "@/lib/use-realtime";
import { TraceTree } from "@/components/trace/trace-tree";
import { ObservationDetail } from "@/components/trace/observation-detail";
import { useResizable } from "@/lib/use-resizable";
import { LOCAL_STORAGE_KEYS, RESIZABLE, REALTIME_REFETCH_INTERVAL_MS } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

export default function TraceDetailPage({ params }: { params: Promise<{ traceId: string }> }) {
  const { traceId } = use(params);
  const projectId = useProjectStore((s) => s.projectId);
  const searchParams = useSearchParams();
  const initialObservationId =
    searchParams.get("observationId") ?? searchParams.get("observation_id");

  // Real-time updates via WebSocket
  useRealtimeTraceDetail(projectId ?? "", traceId);

  const {
    data: trace,
    isLoading,
    isFetching,
  } = trpc.traces.byId.useQuery(
    { projectId: projectId!, id: traceId },
    { refetchInterval: REALTIME_REFETCH_INTERVAL_MS, enabled: !!projectId },
  );
  const [selected, setSelected] = useState<{ id: string; isTrace: boolean } | null>(null);

  const {
    width: treeWidth,
    panelRef: treePanelRef,
    containerRef,
    handleMouseDown,
  } = useResizable({
    defaultWidth: RESIZABLE.TRACE_TREE_DEFAULT,
    minWidth: RESIZABLE.TRACE_TREE_MIN,
    maxWidth: RESIZABLE.TRACE_TREE_MAX,
    storageKey: LOCAL_STORAGE_KEYS.TRACE_TREE_WIDTH,
    side: "left",
  });

  // Auto-select trace root or deep-linked observation on load
  useEffect(() => {
    if (trace && !selected) {
      if (initialObservationId) {
        const found = trace.observations.find((o) => o.id === initialObservationId);
        if (found) {
          setSelected({ id: initialObservationId, isTrace: false });
          return;
        }
      }
      setSelected({ id: trace.id, isTrace: true });
    }
  }, [trace, selected, initialObservationId]);

  const selectedObservation = useMemo(
    () =>
      selected && !selected.isTrace && trace
        ? trace.observations.find((o) => o.id === selected.id)
        : null,
    [trace, selected],
  );

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          <Skeleton className="h-4 w-12" />
          <span className="text-muted-foreground">/</span>
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-[420px] flex-shrink-0 border-r border-border p-3 space-y-2">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="size-4" />
                <Skeleton className="h-4" style={{ width: `${140 - i * 10}px` }} />
              </div>
            ))}
          </div>
          <div className="flex-1 p-4 space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-32" />
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

  return (
    <div className="flex h-full flex-col">
      {/* Split pane */}
      <div className="flex flex-1 overflow-hidden" ref={containerRef}>
        {/* Tree panel — TraceTree handles its own scroll + sticky bottom loader */}
        <div
          ref={treePanelRef}
          className="shrink-0 flex flex-col overflow-hidden border-r border-border"
          style={{ width: `${treeWidth}px` }}
        >
          <TraceTree
            trace={trace}
            observations={trace.observations}
            selectedId={selected?.id ?? null}
            onSelect={(id, isTrace) => setSelected({ id, isTrace })}
            isFetching={isFetching}
          />
        </div>

        {/* Drag handle */}
        <div
          className="w-1 shrink-0 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors"
          onMouseDown={handleMouseDown}
        />

        {/* Detail panel */}
        <div className="flex-1 overflow-hidden min-w-0">
          {selected?.isTrace && <ObservationDetail type="trace" trace={trace} />}
          {selectedObservation && (
            <ObservationDetail type="observation" observation={selectedObservation} />
          )}
        </div>
      </div>
    </div>
  );
}
