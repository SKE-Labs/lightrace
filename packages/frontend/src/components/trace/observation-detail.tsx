"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { JsonViewer } from "./json-viewer";
import { FormattedView } from "./formatted-view";
import { ToolRerunModal } from "./tool-rerun-modal";
import { useProjectStore } from "@/lib/project-store";
import { formatDuration, formatTokens, formatCost } from "@/lib/utils";
import { Route, Clock, Coins, Hash, RotateCcw, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

// --- Scroll-to-section tab bar ---

function SectionNav({
  items,
  activeId,
  onSelect,
}: {
  items: { id: string; label: string }[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex gap-0 mx-4 mt-1 border-b border-border">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          className={cn(
            "text-xs px-3 py-2 -mb-px border-b-2 transition-colors",
            activeId === item.id
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function TraceDetailPanel({ trace }: { trace: Trace }) {
  const [activeSection, setActiveSection] = useState("input");
  const inputRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const metadataRef = useRef<HTMLDivElement>(null);

  const refs = { input: inputRef, output: outputRef, metadata: metadataRef };

  const scrollTo = (id: string) => {
    setActiveSection(id);
    refs[id as keyof typeof refs]?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
          <Route className="size-4 shrink-0 text-primary" />
          <h2 className="text-sm font-medium truncate">{trace.name || trace.id}</h2>
        </div>

        <SectionNav
          items={[
            { id: "input", label: "Input" },
            { id: "output", label: "Output" },
            { id: "metadata", label: "Metadata" },
          ]}
          activeId={activeSection}
          onSelect={scrollTo}
        />

        <div className="flex-1 overflow-auto min-h-0 p-4 space-y-8">
          {/* Input */}
          <div ref={inputRef}>
            <Section title="Input" data={trace.input} showToggle />
          </div>

          {/* Output */}
          <div ref={outputRef}>
            <Section title="Output" data={trace.output} showToggle />
          </div>

          {/* Metadata */}
          <div ref={metadataRef}>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Metadata
            </h3>
            <div className="space-y-3">
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
                  <div className="rounded-md border border-border p-3">
                    <JsonViewer data={trace.metadata} />
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

function ObservationDetailPanel({ observation }: { observation: Observation }) {
  const projectId = useProjectStore((s) => s.projectId);
  const [rerunOpen, setRerunOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("input");
  const inputRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const metadataRef = useRef<HTMLDivElement>(null);

  const refs = { input: inputRef, output: outputRef, metadata: metadataRef };

  const scrollTo = (id: string) => {
    setActiveSection(id);
    refs[id as keyof typeof refs]?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const duration = observation.endTime
    ? new Date(observation.endTime).getTime() - new Date(observation.startTime).getTime()
    : null;
  const { icon: Icon, color } = getObservationIcon(observation.type);
  const isTool = observation.type === "TOOL";

  return (
    <>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <Icon className={`size-4 shrink-0 ${color}`} />
          <h2 className="text-sm font-medium truncate">{observation.name || observation.id}</h2>
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
          <Alert variant="destructive" className="mx-4 my-2">
            <XCircle className="size-4" />
            <AlertDescription className="whitespace-pre-wrap break-words font-mono">
              {observation.statusMessage}
            </AlertDescription>
            <CopyButton
              text={observation.statusMessage}
              className="absolute top-1.5 right-2 text-destructive/70 hover:text-destructive"
            />
          </Alert>
        )}

        {/* Section nav */}
        <SectionNav
          items={[
            { id: "input", label: "Input" },
            { id: "output", label: "Output" },
            { id: "metadata", label: "Metadata" },
          ]}
          activeId={activeSection}
          onSelect={scrollTo}
        />

        {/* Scrollable content with all sections */}
        <div className="flex-1 overflow-auto min-h-0 p-4 space-y-8">
          {/* Input */}
          <div ref={inputRef}>
            <Section title="Input" data={observation.input} showToggle />
          </div>

          {/* Output */}
          <div ref={outputRef}>
            <Section title="Output" data={observation.output} showToggle />
          </div>

          {/* Metadata */}
          <div ref={metadataRef}>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Metadata
            </h3>
            <div className="space-y-3">
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
                  <div className="rounded-md border border-border p-3">
                    <JsonViewer data={observation.modelParameters} />
                  </div>
                </div>
              )}
              {observation.metadata && (
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Metadata</span>
                  <div className="rounded-md border border-border p-3">
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
  title,
  children,
  data,
  showToggle,
}: {
  title?: string;
  children?: React.ReactNode;
  data?: unknown;
  showToggle?: boolean;
}) {
  const [viewMode, setViewMode] = useState<"formatted" | "raw">("formatted");
  const hasData = data !== undefined && data !== null;

  return (
    <div className="space-y-3">
      {/* Header row: title + toolbar */}
      <div className="flex items-center justify-between gap-2">
        {title && (
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {title}
          </h3>
        )}
        <div className="flex items-center gap-2">
          {showToggle && hasData && (
            <SegmentedToggle
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: "formatted", label: "Formatted" },
                { value: "raw", label: "JSON" },
              ]}
            />
          )}
          {hasData && (
            <CopyButton
              text={typeof data === "string" ? data : JSON.stringify(data, null, 2)}
              className="text-muted-foreground hover:text-foreground"
            />
          )}
        </div>
      </div>

      {/* Content */}
      {showToggle ? (
        viewMode === "formatted" ? (
          <FormattedView data={data} />
        ) : (
          <div className="rounded-md border border-border p-3">
            <JsonViewer data={data} />
          </div>
        )
      ) : (
        <div className="rounded-md border border-border p-3">{children}</div>
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
