"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { JsonViewer } from "./JsonViewer";
import { formatDuration, formatTokens, formatCost } from "@/lib/utils";
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
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Badge
          variant="outline"
          className="text-purple-700 dark:text-purple-400 bg-purple-500/10 border-purple-500/20 text-[10px] font-mono"
        >
          TRACE
        </Badge>
        <h2 className="text-sm font-medium truncate">{trace.name || trace.id}</h2>
      </div>
      <Tabs defaultValue="io" className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-2 w-fit">
          <TabsTrigger value="io" className="text-xs">
            I/O
          </TabsTrigger>
          <TabsTrigger value="metadata" className="text-xs">
            Metadata
          </TabsTrigger>
        </TabsList>
        <div className="flex-1 overflow-auto p-4">
          <TabsContent value="io" className="mt-0 space-y-4">
            <Section title="Input">
              <JsonViewer data={trace.input} />
            </Section>
            <Section title="Output">
              <JsonViewer data={trace.output} />
            </Section>
          </TabsContent>
          <TabsContent value="metadata" className="mt-0 space-y-3">
            <MetadataRow label="ID" value={trace.id} mono />
            <MetadataRow label="Timestamp" value={new Date(trace.timestamp).toLocaleString()} />
            {trace.sessionId && <MetadataRow label="Session" value={trace.sessionId} mono />}
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
              <Section title="Metadata">
                <JsonViewer data={trace.metadata} />
              </Section>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function ObservationDetailPanel({ observation }: { observation: Observation }) {
  const duration = observation.endTime
    ? new Date(observation.endTime).getTime() - new Date(observation.startTime).getTime()
    : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Badge
          variant="outline"
          className={`text-[10px] font-mono ${
            observation.type === "GENERATION"
              ? "text-blue-700 dark:text-blue-400 bg-blue-500/10 border-blue-500/20"
              : observation.type === "SPAN"
                ? "text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/20"
                : "text-green-700 dark:text-green-400 bg-green-500/10 border-green-500/20"
          }`}
        >
          {observation.type}
        </Badge>
        <h2 className="text-sm font-medium truncate">{observation.name || observation.id}</h2>
        {observation.model && (
          <Badge variant="secondary" className="text-xs ml-auto">
            {observation.model}
          </Badge>
        )}
      </div>
      <Tabs defaultValue="io" className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-2 w-fit">
          <TabsTrigger value="io" className="text-xs">
            I/O
          </TabsTrigger>
          <TabsTrigger value="metadata" className="text-xs">
            Metadata
          </TabsTrigger>
          <TabsTrigger value="usage" className="text-xs">
            Usage
          </TabsTrigger>
        </TabsList>
        <div className="flex-1 overflow-auto p-4">
          <TabsContent value="io" className="mt-0 space-y-4">
            <Section title="Input">
              <JsonViewer data={observation.input} />
            </Section>
            <Section title="Output">
              <JsonViewer data={observation.output} />
            </Section>
          </TabsContent>
          <TabsContent value="metadata" className="mt-0 space-y-3">
            <MetadataRow label="ID" value={observation.id} mono />
            <MetadataRow label="Trace ID" value={observation.traceId} mono />
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
              <Section title="Model Parameters">
                <JsonViewer data={observation.modelParameters} />
              </Section>
            )}
            {observation.metadata && (
              <Section title="Metadata">
                <JsonViewer data={observation.metadata} />
              </Section>
            )}
          </TabsContent>
          <TabsContent value="usage" className="mt-0">
            <div className="grid grid-cols-2 gap-4">
              <UsageCard label="Latency" value={duration ? formatDuration(duration) : "—"} />
              <UsageCard label="Model" value={observation.model || "—"} />
              <UsageCard label="Input Tokens" value={formatTokens(observation.promptTokens)} />
              <UsageCard label="Output Tokens" value={formatTokens(observation.completionTokens)} />
              <UsageCard label="Total Tokens" value={formatTokens(observation.totalTokens)} />
              <UsageCard
                label="Total Cost"
                value={observation.totalCost ? formatCost(observation.totalCost) : "—"}
              />
            </div>
            {observation.completionStartTime && (
              <div className="mt-4">
                <MetadataRow
                  label="Time to First Token"
                  value={formatDuration(
                    new Date(observation.completionStartTime).getTime() -
                      new Date(observation.startTime).getTime(),
                  )}
                />
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {title}
      </h3>
      <div className="rounded-md border border-border bg-muted/30 p-3">{children}</div>
    </div>
  );
}

function MetadataRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className={`text-sm truncate ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

function UsageCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold font-mono mt-1">{value}</p>
    </div>
  );
}
