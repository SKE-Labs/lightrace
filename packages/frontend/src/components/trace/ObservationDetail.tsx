"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { JsonViewer } from "./JsonViewer";
import { formatDuration, formatTokens, formatCost } from "@/lib/utils";
import type { Observation, Score, Trace } from "@prisma/client";

interface TraceDetailProps {
  type: "trace";
  trace: Trace;
  scores: Score[];
}

interface ObservationDetailProps {
  type: "observation";
  observation: Observation & { scores: Score[] };
}

type Props = TraceDetailProps | ObservationDetailProps;

export function ObservationDetail(props: Props) {
  if (props.type === "trace") {
    return <TraceDetailPanel trace={props.trace} scores={props.scores} />;
  }
  return <ObservationDetailPanel observation={props.observation} />;
}

function TraceDetailPanel({ trace, scores }: { trace: Trace; scores: Score[] }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Badge
          variant="outline"
          className="text-purple-400 bg-purple-400/10 border-purple-400/20 text-[10px] font-mono"
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
          <TabsTrigger value="scores" className="text-xs">
            Scores {scores.length > 0 && `(${scores.length})`}
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
          <TabsContent value="scores" className="mt-0">
            <ScoresList scores={scores} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function ObservationDetailPanel({
  observation,
}: {
  observation: Observation & { scores: Score[] };
}) {
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
              ? "text-blue-400 bg-blue-400/10 border-blue-400/20"
              : observation.type === "SPAN"
                ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
                : "text-green-400 bg-green-400/10 border-green-400/20"
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
          <TabsTrigger value="scores" className="text-xs">
            Scores {observation.scores.length > 0 && `(${observation.scores.length})`}
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
          <TabsContent value="scores" className="mt-0">
            <ScoresList scores={observation.scores} />
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

function ScoresList({ scores }: { scores: Score[] }) {
  if (scores.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No scores</p>;
  }
  return (
    <div className="space-y-2">
      {scores.map((score) => (
        <div
          key={score.id}
          className="flex items-center justify-between rounded-md border border-border p-3"
        >
          <div>
            <p className="text-sm font-medium">{score.name}</p>
            {score.comment && (
              <p className="text-xs text-muted-foreground mt-0.5">{score.comment}</p>
            )}
          </div>
          <span className="text-lg font-mono font-semibold">{score.value}</span>
        </div>
      ))}
    </div>
  );
}
