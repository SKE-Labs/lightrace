"use client";

import { useState } from "react";
import { cn, SECTION_LABEL } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { JsonViewer } from "./json-viewer";
import { ToolRerunModal } from "./tool-rerun-modal";
import { ForkModal } from "./fork-modal";
import { useProjectStore } from "@/lib/project-store";
import { formatDuration, formatTokens, formatCost } from "@/lib/utils";
import { Route, Clock, Coins, Hash, RotateCcw, GitBranch } from "lucide-react";
import { getObservationIcon } from "@/lib/observation-icons";
import { useScrollSections } from "@/lib/use-scroll-sections";
import { SectionNav } from "./detail/section-nav";
import { MetricBadge } from "./detail/metric-badge";
import { MetadataRow } from "./detail/metadata-row";
import { ObservationErrorBanner, ObservationStacktrace } from "./detail/observation-error-panel";
import { DetailSection } from "./detail/detail-section";
import Link from "next/link";
import type { Observation, Trace, TraceFork } from "@prisma/client";

function extractContext(metadata: unknown): Record<string, unknown> | undefined {
  const ctx = (metadata as Record<string, unknown> | null)?.__lightrace_context;
  return ctx && typeof ctx === "object" && !Array.isArray(ctx)
    ? (ctx as Record<string, unknown>)
    : undefined;
}

interface TraceDetailProps {
  type: "trace";
  trace: Trace & { forkedFrom?: TraceFork | null; forks?: TraceFork[] };
}

interface ObservationDetailProps {
  type: "observation";
  observation: Observation;
}

type Props = TraceDetailProps | ObservationDetailProps;

export function ObservationDetail(props: Props) {
  if (props.type === "trace") {
    return <TraceDetailPanel trace={props.trace} />;
  }
  return <ObservationDetailPanel observation={props.observation} />;
}

const SECTION_ITEMS = [
  { id: "input", label: "Input" },
  { id: "output", label: "Output" },
  { id: "metadata", label: "Metadata" },
];

function TraceDetailPanel({
  trace,
}: {
  trace: Trace & { forkedFrom?: TraceFork | null; forks?: TraceFork[] };
}) {
  const projectId = useProjectStore((s) => s.projectId);
  const { activeId, refs, scrollTo } = useScrollSections(["input", "output", "metadata"]);

  return (
    <div className="flex h-full flex-col min-w-0 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border min-w-0 overflow-hidden">
        <Route className="size-4 shrink-0 text-primary" strokeWidth={1.5} />
        <h2 className="text-sm font-medium leading-tight truncate min-w-0 flex-1">
          {trace.name || trace.id}
        </h2>
      </div>

      <SectionNav items={SECTION_ITEMS} activeId={activeId} onSelect={scrollTo} />

      <div className="flex-1 overflow-auto min-h-0 p-4 space-y-8">
        <div ref={refs.input}>
          <DetailSection title="Input" data={trace.input} showToggle />
        </div>
        <div ref={refs.output}>
          <DetailSection title="Output" data={trace.output} showToggle />
        </div>
        <div ref={refs.metadata}>
          <h3 className={cn(SECTION_LABEL, "mb-3")}>Metadata</h3>
          <div className="space-y-2">
            <MetadataRow label="ID" value={trace.id} mono copyable />
            <MetadataRow label="Timestamp" value={new Date(trace.timestamp).toLocaleString()} />
            {trace.sessionId && (
              <MetadataRow label="Session" value={trace.sessionId} mono copyable />
            )}
            {trace.userId && <MetadataRow label="User" value={trace.userId} />}
            {trace.release && <MetadataRow label="Release" value={trace.release} />}
            {trace.version && <MetadataRow label="Version" value={trace.version} />}
            {trace.tags.length > 0 && (
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-xs text-muted-foreground shrink-0">Tags</span>
                <div className="flex gap-1 flex-wrap justify-end">
                  {trace.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="font-mono">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {trace.metadata && (
              <div className="space-y-1.5 pt-2">
                <span className="text-xs text-muted-foreground">Metadata</span>
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <JsonViewer data={trace.metadata} />
                </div>
              </div>
            )}
          </div>
        </div>

        {trace.forkedFrom && (
          <div>
            <h3 className={cn(SECTION_LABEL, "mb-3")}>Fork source</h3>
            <div className="rounded-md border border-border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <GitBranch className="size-3.5 text-primary" strokeWidth={1.5} />
                <span className="text-xs text-muted-foreground">Forked from</span>
                <Link
                  href={`/project/${projectId}/traces/${trace.forkedFrom.sourceTraceId}`}
                  className="text-xs text-primary hover:underline font-mono"
                >
                  {trace.forkedFrom.sourceTraceId.slice(0, 8)}…
                </Link>
              </div>
              <Link
                href={`/project/${projectId}/traces/compare/${trace.forkedFrom.id}`}
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                View comparison
              </Link>
              {trace.forkedFrom.modifiedInput && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-xs text-muted-foreground">Modified input</span>
                  <div className="rounded-md border border-border bg-muted/30 p-2">
                    <JsonViewer data={trace.forkedFrom.modifiedInput} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {trace.forks && trace.forks.length > 0 && (
          <div>
            <h3 className={cn(SECTION_LABEL, "mb-3 flex items-center gap-1.5")}>
              Forks
              <span className="text-muted-foreground normal-case tracking-normal">
                ({trace.forks.length})
              </span>
            </h3>
            <div className="space-y-2">
              {trace.forks.map((fork) => (
                <div
                  key={fork.id}
                  className="rounded-md border border-border p-3 flex items-center gap-3"
                >
                  <GitBranch className="size-3.5 text-primary shrink-0" strokeWidth={1.5} />
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/project/${projectId}/traces/${fork.forkedTraceId}`}
                      className="text-xs text-primary hover:underline font-mono"
                    >
                      {fork.forkedTraceId.slice(0, 8)}…
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(fork.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Link
                    href={`/project/${projectId}/traces/compare/${fork.id}`}
                    className="text-xs text-primary hover:underline shrink-0"
                  >
                    Compare
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ObservationDetailPanel({ observation }: { observation: Observation }) {
  const projectId = useProjectStore((s) => s.projectId);
  const [rerunOpen, setRerunOpen] = useState(false);
  const [forkOpen, setForkOpen] = useState(false);
  const { activeId, refs, scrollTo } = useScrollSections(["input", "output", "metadata"]);

  const duration = observation.endTime
    ? new Date(observation.endTime).getTime() - new Date(observation.startTime).getTime()
    : null;
  const { icon: Icon, color } = getObservationIcon(observation.type);
  const isTool = observation.type === "TOOL";

  return (
    <>
      <div className="flex h-full flex-col min-w-0 overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3 min-w-0 overflow-hidden">
          <Icon className={cn("size-4 shrink-0", color)} strokeWidth={1.5} />
          <h2 className="text-sm font-medium leading-tight truncate min-w-0 flex-1">
            {observation.name || observation.id}
          </h2>
          <div className="flex items-center gap-1.5 ml-auto">
            {observation.level === "ERROR" && (
              <Badge variant="error" className="font-mono">
                error
              </Badge>
            )}
            {observation.level === "WARNING" && (
              <Badge variant="warning" className="font-mono">
                warning
              </Badge>
            )}
            {isTool && (
              <>
                <Button
                  variant="outline"
                  size="default"
                  className="gap-1.5"
                  onClick={() => setRerunOpen(true)}
                >
                  <RotateCcw className="size-3" strokeWidth={1.5} />
                  Re-run
                </Button>
                <Button
                  variant="outline"
                  size="default"
                  className="gap-1.5"
                  onClick={() => setForkOpen(true)}
                >
                  <GitBranch className="size-3" strokeWidth={1.5} />
                  Fork
                </Button>
              </>
            )}
          </div>
        </div>

        {isTool && (
          <ToolRerunModal
            open={rerunOpen}
            onOpenChange={setRerunOpen}
            toolName={observation.name ?? observation.id}
            originalInput={observation.input}
            originalOutput={observation.output}
            observationId={observation.id}
            projectId={projectId ?? undefined}
            context={extractContext(observation.metadata)}
          />
        )}

        {isTool && projectId && (
          <ForkModal
            open={forkOpen}
            onOpenChange={setForkOpen}
            toolName={observation.name ?? observation.id}
            originalInput={observation.input}
            observationId={observation.id}
            traceId={observation.traceId}
            projectId={projectId}
            context={extractContext(observation.metadata)}
          />
        )}

        <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 border-b border-border">
          {duration !== null && duration > 0 && (
            <MetricBadge icon={Clock} label={formatDuration(duration)} />
          )}
          {observation.model && (
            <Badge variant="outline" className="font-mono">
              {observation.model}
            </Badge>
          )}
          {observation.totalTokens > 0 && (
            <Tooltip>
              <TooltipTrigger className="cursor-default">
                <MetricBadge icon={Hash} label={formatTokens(observation.totalTokens)} />
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs space-y-1">
                  <div>Input: {formatTokens(observation.promptTokens)}</div>
                  <div>Output: {formatTokens(observation.completionTokens)}</div>
                </div>
              </TooltipContent>
            </Tooltip>
          )}
          {observation.totalCost !== null && Number(observation.totalCost) > 0 && (
            <Tooltip>
              <TooltipTrigger className="cursor-default">
                <MetricBadge icon={Coins} label={formatCost(Number(observation.totalCost))} />
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs space-y-1">
                  {observation.inputCost !== null && (
                    <div>Input: {formatCost(Number(observation.inputCost))}</div>
                  )}
                  {observation.outputCost !== null && (
                    <div>Output: {formatCost(Number(observation.outputCost))}</div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
          {observation.completionStartTime && duration !== null && (
            <MetricBadge
              label={`TTFT ${formatDuration(
                new Date(observation.completionStartTime).getTime() -
                  new Date(observation.startTime).getTime(),
              )}`}
            />
          )}
        </div>

        {observation.level === "ERROR" && (
          <ObservationErrorBanner
            errorType={observation.errorType}
            statusMessage={observation.statusMessage}
            errorHandled={observation.errorHandled}
          />
        )}
        <ObservationStacktrace stacktrace={observation.errorStacktrace} />

        <SectionNav items={SECTION_ITEMS} activeId={activeId} onSelect={scrollTo} />

        <div className="flex-1 overflow-auto min-h-0 p-4 space-y-8">
          <div ref={refs.input}>
            <DetailSection title="Input" data={observation.input} showToggle />
          </div>
          <div ref={refs.output}>
            <DetailSection title="Output" data={observation.output} showToggle />
          </div>
          <div ref={refs.metadata}>
            <h3 className={cn(SECTION_LABEL, "mb-3")}>Metadata</h3>
            <div className="space-y-2">
              <MetadataRow label="ID" value={observation.id} mono copyable />
              <MetadataRow label="Trace ID" value={observation.traceId} mono copyable />
              <MetadataRow label="Start" value={new Date(observation.startTime).toLocaleString()} />
              {observation.endTime && (
                <MetadataRow label="End" value={new Date(observation.endTime).toLocaleString()} />
              )}
              {observation.model && <MetadataRow label="Model" value={observation.model} mono />}
              {observation.level !== "DEFAULT" && (
                <MetadataRow label="Level" value={observation.level} />
              )}
              {observation.statusMessage && (
                <MetadataRow label="Status" value={observation.statusMessage} />
              )}
              {observation.errorType && (
                <MetadataRow label="Error Type" value={observation.errorType} mono />
              )}
              {observation.errorHandled !== null && observation.errorHandled !== undefined && (
                <MetadataRow label="Handled" value={String(observation.errorHandled)} />
              )}
              {observation.version && <MetadataRow label="Version" value={observation.version} />}
              {observation.modelParameters && (
                <div className="space-y-1.5 pt-2">
                  <span className="text-xs text-muted-foreground">Model parameters</span>
                  <div className="rounded-md border border-border bg-muted/30 p-3">
                    <JsonViewer data={observation.modelParameters} />
                  </div>
                </div>
              )}
              {observation.metadata && (
                <div className="space-y-1.5 pt-2">
                  <span className="text-xs text-muted-foreground">Metadata</span>
                  <div className="rounded-md border border-border bg-muted/30 p-3">
                    <JsonViewer data={observation.metadata} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
