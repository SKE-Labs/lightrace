"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { JsonViewer } from "./JsonViewer";
import { FormattedView } from "./FormattedView";
import { formatDuration, formatTokens, formatCost } from "@/lib/utils";
import { Route, Copy, Clock, Coins, Hash, ChevronRight } from "lucide-react";
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
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Route className="size-4 shrink-0 text-purple-600 dark:text-purple-500" />
          <h2 className="text-sm font-medium truncate">{trace.name || trace.id}</h2>
        </div>
        <Tabs defaultValue="io" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 mt-2 w-fit">
            <TabsTrigger value="io" className="text-xs">
              I/O
            </TabsTrigger>
            <TabsTrigger value="metadata" className="text-xs">
              Metadata
            </TabsTrigger>
          </TabsList>
          <div className="flex-1 overflow-auto min-h-0 p-4">
            <TabsContent value="io" className="mt-0 space-y-4">
              <Section title="Input" data={trace.input} showToggle collapsible />
              <Section title="Output" data={trace.output} showToggle collapsible />
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
                <div className="space-y-1">
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
                <Section title="Metadata" data={trace.metadata}>
                  <JsonViewer data={trace.metadata} />
                </Section>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}

function ObservationDetailPanel({ observation }: { observation: Observation }) {
  const duration = observation.endTime
    ? new Date(observation.endTime).getTime() - new Date(observation.startTime).getTime()
    : null;
  const { icon: Icon, color } = getObservationIcon(observation.type);

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        {/* Header row 1: icon + name + level */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Icon className={`size-4 shrink-0 ${color}`} />
          <h2 className="text-sm font-medium truncate">{observation.name || observation.id}</h2>
          {observation.level === "ERROR" && (
            <Badge variant="destructive" className="text-xs ml-auto">
              ERROR
            </Badge>
          )}
          {observation.level === "WARNING" && (
            <Badge className="text-xs ml-auto bg-yellow-500/15 text-yellow-800 dark:text-yellow-400 border-yellow-500/30">
              WARNING
            </Badge>
          )}
        </div>

        {/* Header row 2: metric badges */}
        <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 border-b border-border">
          {duration !== null && duration > 0 && (
            <Badge variant="outline" className="text-xs font-mono gap-1">
              <Clock className="size-3" />
              {formatDuration(duration)}
            </Badge>
          )}
          {observation.model && (
            <Badge variant="outline" className="text-xs font-mono">
              {observation.model}
            </Badge>
          )}
          {observation.totalTokens > 0 && (
            <Tooltip>
              <TooltipTrigger className="cursor-default">
                <Badge variant="outline" className="text-xs font-mono gap-1">
                  <Hash className="size-3" />
                  {formatTokens(observation.totalTokens)}
                </Badge>
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
                <Badge variant="outline" className="text-xs font-mono gap-1">
                  <Coins className="size-3" />
                  {formatCost(Number(observation.totalCost))}
                </Badge>
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
            <Badge variant="outline" className="text-xs font-mono gap-1">
              TTFT{" "}
              {formatDuration(
                new Date(observation.completionStartTime).getTime() -
                  new Date(observation.startTime).getTime(),
              )}
            </Badge>
          )}
        </div>

        {/* Tabs: I/O + Metadata */}
        <Tabs defaultValue="io" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 mt-2 w-fit">
            <TabsTrigger value="io" className="text-xs">
              I/O
            </TabsTrigger>
            <TabsTrigger value="metadata" className="text-xs">
              Metadata
            </TabsTrigger>
          </TabsList>
          <div className="flex-1 overflow-auto min-h-0 p-4">
            <TabsContent value="io" className="mt-0 space-y-4">
              <Section title="Input" data={observation.input} showToggle />
              <Section title="Output" data={observation.output} showToggle />
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
                <Section title="Model Parameters" data={observation.modelParameters}>
                  <JsonViewer data={observation.modelParameters} />
                </Section>
              )}
              {observation.metadata && (
                <Section title="Metadata" data={observation.metadata}>
                  <JsonViewer data={observation.metadata} />
                </Section>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}

function Section({
  title,
  children,
  data,
  showToggle,
  collapsible,
  defaultOpen = true,
}: {
  title: string;
  children?: React.ReactNode;
  data?: unknown;
  showToggle?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [viewMode, setViewMode] = useState<"formatted" | "raw">("formatted");
  const [open, setOpen] = useState(defaultOpen);
  const hasData = data !== undefined && data !== null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {collapsible ? (
          <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-1">
            <ChevronRight
              className={cn(
                "size-3.5 text-muted-foreground transition-transform",
                open && "rotate-90",
              )}
            />
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </h3>
          </button>
        ) : (
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {title}
          </h3>
        )}
        <div className="flex items-center gap-2">
          {showToggle && hasData && open && (
            <div className="flex rounded-md border border-border text-[10px] overflow-hidden">
              <button
                onClick={() => setViewMode("formatted")}
                className={cn(
                  "px-2 py-0.5 transition-colors",
                  viewMode === "formatted"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Formatted
              </button>
              <button
                onClick={() => setViewMode("raw")}
                className={cn(
                  "px-2 py-0.5 transition-colors border-l border-border",
                  viewMode === "raw"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Raw
              </button>
            </div>
          )}
          {hasData && open && (
            <button
              onClick={() =>
                navigator.clipboard.writeText(
                  typeof data === "string" ? data : JSON.stringify(data, null, 2),
                )
              }
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Copy to clipboard"
            >
              <Copy className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      {(!collapsible || open) && (
        <>
          {showToggle ? (
            viewMode === "formatted" ? (
              <FormattedView data={data} />
            ) : (
              <div className="rounded-md border border-border bg-muted/50 p-3">
                <JsonViewer data={data} />
              </div>
            )
          ) : (
            <div className="rounded-md border border-border bg-muted/50 p-3">{children}</div>
          )}
        </>
      )}
    </div>
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
        <span className={`text-sm truncate ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
        {copyable && (
          <button
            onClick={() => navigator.clipboard.writeText(value)}
            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            title="Copy"
          >
            <Copy className="size-3 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}
