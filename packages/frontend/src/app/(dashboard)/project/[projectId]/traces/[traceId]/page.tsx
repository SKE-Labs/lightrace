"use client";

import { use, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useProjectStore } from "@/lib/project-store";
import { useRealtimeTraceDetail } from "@/lib/use-realtime";
import { TraceTree } from "@/components/trace/trace-tree";
import { ObservationDetail } from "@/components/trace/observation-detail";
import Link from "next/link";

const TREE_WIDTH_KEY = "lightrace-tree-width";
const DEFAULT_TREE_WIDTH = 420;
const MIN_TREE_WIDTH = 280;
const MAX_TREE_WIDTH = 700;

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

  // --- Resizable tree panel ---
  const [treeWidth, setTreeWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(TREE_WIDTH_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= MIN_TREE_WIDTH && parsed <= MAX_TREE_WIDTH) return parsed;
      }
    }
    return DEFAULT_TREE_WIDTH;
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const treePanelRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    const treePanel = treePanelRef.current;
    if (!container || !treePanel) return;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    let currentWidth = treePanel.offsetWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      currentWidth = Math.max(MIN_TREE_WIDTH, Math.min(MAX_TREE_WIDTH, e.clientX - rect.left));
      treePanel.style.width = `${currentWidth}px`;
    };

    const handleMouseUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      setTreeWidth(currentWidth);
      localStorage.setItem(TREE_WIDTH_KEY, String(currentWidth));
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  // Auto-select trace root on load
  useEffect(() => {
    if (trace && !selected) {
      setSelected({ id: trace.id, isTrace: true });
    }
  }, [trace, selected]);

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

  return (
    <div className="flex h-full flex-col">
      {/* Split pane */}
      <div className="flex flex-1 overflow-hidden" ref={containerRef}>
        {/* Tree panel */}
        <div
          ref={treePanelRef}
          className="shrink-0 overflow-auto border-r border-border"
          style={{ width: `${treeWidth}px` }}
        >
          <TraceTree
            trace={trace}
            observations={trace.observations}
            selectedId={selected?.id ?? null}
            onSelect={(id, isTrace) => setSelected({ id, isTrace })}
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
