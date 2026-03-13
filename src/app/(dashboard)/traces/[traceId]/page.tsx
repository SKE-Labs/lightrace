"use client";

import { use, useState } from "react";
import { trpc } from "@/lib/trpc";
import { TraceTree } from "@/components/trace/TraceTree";
import { ObservationDetail } from "@/components/trace/ObservationDetail";
import Link from "next/link";

export default function TraceDetailPage({ params }: { params: Promise<{ traceId: string }> }) {
  const { traceId } = use(params);
  const { data: trace, isLoading } = trpc.traces.byId.useQuery(
    { id: traceId },
    { refetchInterval: 2000 },
  );
  const [selected, setSelected] = useState<{ id: string; isTrace: boolean } | null>(null);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading trace...
      </div>
    );
  }

  if (!trace) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <p>Trace not found</p>
        <Link href="/traces" className="text-sm text-primary hover:underline">
          Back to traces
        </Link>
      </div>
    );
  }

  const selectedObservation =
    selected && !selected.isTrace ? trace.observations.find((o) => o.id === selected.id) : null;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-3">
        <Link href="/traces" className="text-muted-foreground hover:text-foreground text-sm">
          Traces
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-sm font-medium truncate">{trace.name || trace.id.slice(0, 12)}</h1>
      </div>

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
          {!selected && (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Select a trace or observation to view details
            </div>
          )}
          {selected?.isTrace && (
            <ObservationDetail type="trace" trace={trace} scores={trace.scores} />
          )}
          {selectedObservation && (
            <ObservationDetail
              type="observation"
              observation={{
                ...selectedObservation,
                scores: trace.scores.filter((s) => s.observationId === selectedObservation.id),
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
