"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { JsonViewer } from "./json-viewer";
import { FormattedView } from "./formatted-view";
import { ToolRerunModal } from "./tool-rerun-modal";
import { useProjectStore } from "@/lib/project-store";
import { formatDuration, formatTokens, formatCost } from "@/lib/utils";
import { Route, Copy, Clock, Coins, Hash, ChevronRight, RotateCcw, Check } from "lucide-react";
import { getObservationIcon } from "@/lib/observation-icons";
import type { Observation, Trace } from "@prisma/client";

interface TraceDetailProps {
  type: "trace";
  trace: Trace;
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

function TraceDetailPanel({ trace }: { trace: Trace }) {
  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
          <Route className="size-4 shrink-0 text-primary" />
          <h2 className="text-sm font-semibold truncate">{trace.name || trace.id}</h2>
        </div>

        <Tabs defaultValue="input" className="flex-1 flex flex-col min-h-0">
          <TabsList variant="line" className="mx-4 mt-1 gap-0">
            <TabsTrigger value="input" className="text-xs px-3">
              Input
            </TabsTrigger>
            <TabsTrigger value="output" className="text-xs px-3">
              Output
            </TabsTrigger>
            <TabsTrigger value="metadata" className="text-xs px-3">
              Metadata
            </TabsTrigger>
          </TabsList>
          <div className="flex-1 overflow-auto min-h-0 p-4">
            <TabsContent value="input" className="mt-0">
              <Section data={trace.input} showToggle />
            </TabsContent>
            <TabsContent value="output" className="mt-0">
              <Section data={trace.output} showToggle />
            </TabsContent>
            <TabsContent value="metadata" className="mt-0 space-y-3">
              <MetadataRow label="ID" value={trace.id} mono copyable />
              <MetadataRow label="Timestamp" value={new Date(trace.timestamp).toLocaleString()} />
              {trace.sessionId && (
                <MetadataRow label="Session" value={trace.sessionId} mono copyable />
              )}
              {trace.userId && <MetadataRow label="User" value={trace.userId} />}
              {trace.release && <MetadataRow label="Release" value={trace.release} />}
              {trace.version && <MetadataRow label="Version" value={trace.version} />}
              {trace.tags.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Tags</span>
                  <div className="flex gap-1 flex-wrap">
                    {trace.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {trace.metadata && (
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Metadata</span>
                  <div className="rounded-md border border-border bg-muted/30 p-3">
                    <JsonViewer data={trace.metadata} />
                  </div>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}

function ObservationDetailPanel({ observation }: { observation: Observation }) {
  const projectId = useProjectStore((s) => s.projectId);
  const [rerunOpen, setRerunOpen] = useState(false);
  const duration = observation.endTime
    ? new Date(observation.endTime).getTime() - new Date(observation.startTime).getTime()
    : null;
  const { icon: Icon, color } = getObservationIcon(observation.type);
  const isTool = observation.type === "TOOL";

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <Icon className={`size-4 shrink-0 ${color}`} />
          <h2 className="text-sm font-semibold truncate">{observation.name || observation.id}</h2>
          <div className="flex items-center gap-1.5 ml-auto">
            {observation.level === "ERROR" && (
              <Badge variant="destructive" className="text-xs">
                ERROR
              </Badge>
            )}
            {observation.level === "WARNING" && (
              <Badge className="text-xs bg-warning/15 text-warning border-warning/30">
                WARNING
              </Badge>
            )}
            {isTool && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-7"
                onClick={() => setRerunOpen(true)}
              >
                <RotateCcw className="size-3" />
                Re-run
              </Button>
            )}
          </div>
        </div>

        {/* Tool re-run modal */}
        {isTool && (
          <ToolRerunModal
            open={rerunOpen}
            onOpenChange={setRerunOpen}
            toolName={observation.name ?? observation.id}
            originalInput={observation.input}
            originalOutput={observation.output}
            observationId={observation.id}
            projectId={projectId ?? undefined}
            context={
              (observation.metadata as Record<string, unknown> | null)?.__lightrace_context as
                | Record<string, unknown>
                | undefined
            }
          />
        )}

        {/* Metric badges */}
        <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 border-b border-border">
          {duration !== null && duration > 0 && (
            <MetricBadge icon={Clock} label={formatDuration(duration)} />
          )}
          {observation.model && (
            <Badge variant="outline" className="text-xs font-mono">
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

        {/* Error banner */}
        {observation.level === "ERROR" && observation.statusMessage && (
          <div className="mx-4 my-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 flex items-start gap-2">
            <span className="text-xs text-destructive flex-1 whitespace-pre-wrap break-words font-mono">
              {observation.statusMessage}
            </span>
            <CopyButton
              text={observation.statusMessage}
              className="text-destructive/70 hover:text-destructive"
            />
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="input" className="flex-1 flex flex-col min-h-0">
          <TabsList variant="line" className="mx-4 mt-1 gap-0">
            <TabsTrigger value="input" className="text-xs px-3">
              Input
            </TabsTrigger>
            <TabsTrigger value="output" className="text-xs px-3">
              Output
            </TabsTrigger>
            <TabsTrigger value="metadata" className="text-xs px-3">
              Metadata
            </TabsTrigger>
          </TabsList>
          <div className="flex-1 overflow-auto min-h-0 p-4">
            <TabsContent value="input" className="mt-0">
              <Section data={observation.input} showToggle />
            </TabsContent>
            <TabsContent value="output" className="mt-0">
              <Section data={observation.output} showToggle />
            </TabsContent>
            <TabsContent value="metadata" className="mt-0 space-y-3">
              <MetadataRow label="ID" value={observation.id} mono copyable />
              <MetadataRow label="Trace ID" value={observation.traceId} mono copyable />
              <MetadataRow label="Start" value={new Date(observation.startTime).toLocaleString()} />
              {observation.endTime && (
                <MetadataRow label="End" value={new Date(observation.endTime).toLocaleString()} />
              )}
              {observation.model && <MetadataRow label="Model" value={observation.model} />}
              {observation.level !== "DEFAULT" && (
                <MetadataRow label="Level" value={observation.level} />
              )}
              {observation.statusMessage && (
                <MetadataRow label="Status" value={observation.statusMessage} />
              )}
              {observation.version && <MetadataRow label="Version" value={observation.version} />}
              {observation.modelParameters && (
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Model Parameters</span>
                  <div className="rounded-md border border-border bg-muted/30 p-3">
                    <JsonViewer data={observation.modelParameters} />
                  </div>
                </div>
              )}
              {observation.metadata && (
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Metadata</span>
                  <div className="rounded-md border border-border bg-muted/30 p-3">
                    <JsonViewer data={observation.metadata} />
                  </div>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}

function MetricBadge({
  icon: Icon,
  label,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Badge variant="outline" className="text-xs font-mono gap-1">
      {Icon && <Icon className="size-3" />}
      {label}
    </Badge>
  );
}

function Section({
  children,
  data,
  showToggle,
}: {
  children?: React.ReactNode;
  data?: unknown;
  showToggle?: boolean;
}) {
  const [viewMode, setViewMode] = useState<"formatted" | "raw">("formatted");
  const hasData = data !== undefined && data !== null;

  return (
    <div className="space-y-2">
      {/* Toolbar row */}
      <div className="flex items-center justify-end gap-2">
        {showToggle && hasData && (
          <div className="flex rounded-md border border-border text-xs overflow-hidden">
            <button
              onClick={() => setViewMode("formatted")}
              className={cn(
                "px-2.5 py-1 transition-colors",
                viewMode === "formatted"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Formatted
            </button>
            <button
              onClick={() => setViewMode("raw")}
              className={cn(
                "px-2.5 py-1 transition-colors border-l border-border",
                viewMode === "raw"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              JSON
            </button>
          </div>
        )}
        {hasData && (
          <CopyButton
            text={typeof data === "string" ? data : JSON.stringify(data, null, 2)}
            className="text-muted-foreground hover:text-foreground"
          />
        )}
      </div>

      {/* Content */}
      {showToggle ? (
        viewMode === "formatted" ? (
          <FormattedView data={data} />
        ) : (
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <JsonViewer data={data} />
          </div>
        )
      ) : (
        <div className="rounded-md border border-border bg-muted/30 p-3">{children}</div>
      )}
    </div>
  );
}

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={cn("transition-colors shrink-0", className)}
      title="Copy to clipboard"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}

function MetadataRow({
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
    <div className="flex items-baseline justify-between gap-4 group">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={cn("text-sm truncate", mono && "font-mono text-xs")}>{value}</span>
        {copyable && (
          <CopyButton
            text={value}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
          />
        )}
      </div>
    </div>
  );
}
