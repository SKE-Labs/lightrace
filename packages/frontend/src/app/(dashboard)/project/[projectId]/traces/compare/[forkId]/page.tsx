"use client";

import { use, useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useProjectStore } from "@/lib/project-store";
import { TraceTree } from "@/components/trace/trace-tree";
import { ObservationDetail } from "@/components/trace/observation-detail";
import { useResizable } from "@/lib/use-resizable";
import { RESIZABLE } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { GitBranch, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function CompareViewPage({
  params,
}: {
  params: Promise<{ projectId: string; forkId: string }>;
}) {
  const { forkId } = use(params);
  const projectId = useProjectStore((s) => s.projectId);

  const { data, isLoading, isFetching } = trpc.forks.compare.useQuery(
    { projectId: projectId!, forkId },
    { enabled: !!projectId },
  );

  const [selected, setSelected] = useState<{
    id: string;
    isTrace: boolean;
    side: "source" | "fork";
  } | null>(null);

  const {
    width: leftWidth,
    panelRef: leftPanelRef,
    handleMouseDown: handleLeftResize,
  } = useResizable({
    defaultWidth: RESIZABLE.COMPARE_DEFAULT,
    minWidth: RESIZABLE.COMPARE_MIN,
    maxWidth: RESIZABLE.COMPARE_MAX,
    side: "left",
  });
  const {
    width: rightWidth,
    panelRef: rightPanelRef,
    handleMouseDown: handleRightResize,
  } = useResizable({
    defaultWidth: RESIZABLE.COMPARE_DEFAULT,
    minWidth: RESIZABLE.COMPARE_MIN,
    maxWidth: RESIZABLE.COMPARE_MAX,
    side: "right",
  });

  const reverseIdMap = useMemo(() => {
    if (!data) return {};
    const rev: Record<string, string> = {};
    for (const [k, v] of Object.entries(data.observationIdMap)) rev[v] = k;
    return rev;
  }, [data]);

  const crossHighlightIds = useMemo(() => {
    if (!selected || selected.isTrace || !data) return undefined;
    const id = selected.id;

    if (selected.side === "source") {
      const clonedId = data.observationIdMap[id];
      return clonedId ? new Set([clonedId]) : undefined;
    } else {
      const sourceId = reverseIdMap[id];
      return sourceId ? new Set([sourceId]) : undefined;
    }
  }, [selected, data, reverseIdMap]);

  // Find selected observation for the detail panel
  const selectedObservation = useMemo(() => {
    if (!selected || selected.isTrace || !data) return null;
    const trace = selected.side === "source" ? data.sourceTrace : data.forkedTrace;
    return trace.observations.find((o) => o.id === selected.id) ?? null;
  }, [selected, data]);

  const selectedTrace = useMemo(() => {
    if (!selected?.isTrace || !data) return null;
    return selected.side === "source" ? data.sourceTrace : data.forkedTrace;
  }, [selected, data]);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-[320px] border-r border-border p-3 space-y-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-4" style={{ width: `${120 - i * 10}px` }} />
            ))}
          </div>
          <div className="w-[320px] border-r border-border p-3 space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-4" style={{ width: `${100 - i * 10}px` }} />
            ))}
          </div>
          <div className="flex-1 p-4">
            <Skeleton className="h-6 w-48" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <p>Fork not found</p>
        <Link
          href={`/project/${projectId}/traces`}
          className="text-sm text-primary hover:underline"
        >
          Back to traces
        </Link>
      </div>
    );
  }

  const { sourceTrace, forkedTrace, fork } = data;

  return (
    <div className="flex h-full flex-col">
      {/* Top banner */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 bg-muted/30">
        <GitBranch className="size-4 text-primary shrink-0" />
        <Link
          href={`/project/${projectId}/traces/${sourceTrace.id}`}
          className="text-sm font-medium hover:underline truncate"
        >
          {sourceTrace.name || sourceTrace.id.slice(0, 8)}
        </Link>
        <ArrowRight className="size-3 text-muted-foreground shrink-0" />
        <Badge variant="outline" className="text-xs shrink-0">
          fork
        </Badge>
        <ArrowRight className="size-3 text-muted-foreground shrink-0" />
        <Link
          href={`/project/${projectId}/traces/${forkedTrace.id}`}
          className="text-sm font-medium hover:underline truncate"
        >
          {forkedTrace.name || forkedTrace.id.slice(0, 8)}
        </Link>
        <span className="ml-auto text-xs text-muted-foreground">
          {new Date(fork.createdAt).toLocaleString()}
        </span>
      </div>

      {/* Three-pane layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Source trace tree — flex-col so bottom loader sticks */}
        <div
          ref={leftPanelRef}
          className="flex-shrink-0 flex flex-col overflow-hidden border-r border-border"
          style={{ width: `${leftWidth}px` }}
        >
          <div className="px-3 py-1.5 border-b border-border bg-muted/20 shrink-0">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Original
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <TraceTree
              trace={sourceTrace}
              observations={sourceTrace.observations}
              selectedId={selected?.side === "source" ? selected.id : null}
              onSelect={(id, isTrace) => setSelected({ id, isTrace, side: "source" })}
              highlightIds={selected?.side === "fork" ? crossHighlightIds : undefined}
              forkPointId={fork.forkPointId}
              isFetching={isFetching}
            />
          </div>
        </div>

        {/* Left drag handle */}
        <div
          className="w-1 flex-shrink-0 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors"
          onMouseDown={handleLeftResize}
        />

        {/* Forked trace tree — flex-col so bottom loader sticks */}
        <div
          ref={rightPanelRef}
          className="flex-shrink-0 flex flex-col overflow-hidden border-r border-border"
          style={{ width: `${rightWidth}px` }}
        >
          <div className="px-3 py-1.5 border-b border-border bg-primary/5 shrink-0">
            <span className="text-xs font-medium text-primary uppercase tracking-wider">Fork</span>
          </div>
          <div className="flex-1 min-h-0">
            <TraceTree
              trace={forkedTrace}
              observations={forkedTrace.observations}
              selectedId={selected?.side === "fork" ? selected.id : null}
              onSelect={(id, isTrace) => setSelected({ id, isTrace, side: "fork" })}
              highlightIds={selected?.side === "source" ? crossHighlightIds : undefined}
              isFetching={isFetching}
            />
          </div>
        </div>

        {/* Right drag handle */}
        <div
          className="w-1 flex-shrink-0 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors"
          onMouseDown={handleRightResize}
        />

        {/* Detail panel */}
        <div className="flex-1 overflow-hidden min-w-0">
          {selectedTrace && <ObservationDetail type="trace" trace={selectedTrace} />}
          {selectedObservation && (
            <ObservationDetail type="observation" observation={selectedObservation} />
          )}
          {!selected && (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Select an observation to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
