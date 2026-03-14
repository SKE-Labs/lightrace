"use client";

import { useState } from "react";
import { cn, formatDuration } from "@/lib/utils";
import { Route, Bot, Brackets, CircleDot, Wrench, Link } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import type { Observation, ObservationType } from "@prisma/client";

interface TraceTreeProps {
  trace: {
    id: string;
    name: string | null;
    timestamp: Date;
  };
  observations: Observation[];
  selectedId: string | null;
  onSelect: (id: string, isTrace: boolean) => void;
}

interface TreeNode {
  observation: Observation;
  children: TreeNode[];
}

function buildTree(observations: Observation[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const obs of observations) {
    map.set(obs.id, { observation: obs, children: [] });
  }

  for (const obs of observations) {
    const node = map.get(obs.id)!;
    if (obs.parentObservationId && map.has(obs.parentObservationId)) {
      map.get(obs.parentObservationId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function typeIcon(type: ObservationType): {
  icon: LucideIcon;
  color: string;
  barColor: string;
  label: string;
} {
  switch (type) {
    case "GENERATION":
      return {
        icon: Bot,
        color: "text-blue-500",
        barColor: "bg-blue-500/40",
        label: "Generation",
      };
    case "SPAN":
      return {
        icon: Brackets,
        color: "text-amber-500",
        barColor: "bg-amber-500/40",
        label: "Span",
      };
    case "EVENT":
      return {
        icon: CircleDot,
        color: "text-green-500",
        barColor: "bg-green-500/40",
        label: "Event",
      };
    case "TOOL":
      return {
        icon: Wrench,
        color: "text-orange-500",
        barColor: "bg-orange-500/40",
        label: "Tool",
      };
    case "CHAIN":
      return {
        icon: Link,
        color: "text-pink-500",
        barColor: "bg-pink-500/40",
        label: "Chain",
      };
  }
}

function TreeNodeRow({
  node,
  depth,
  selectedId,
  onSelect,
  traceStartTime,
  traceDuration,
}: {
  node: TreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string, isTrace: boolean) => void;
  traceStartTime: number;
  traceDuration: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const obs = node.observation;
  const { icon: Icon, color, barColor, label } = typeIcon(obs.type);
  const duration = obs.endTime
    ? new Date(obs.endTime).getTime() - new Date(obs.startTime).getTime()
    : 0;

  const offsetPercent =
    traceDuration > 0
      ? ((new Date(obs.startTime).getTime() - traceStartTime) / traceDuration) * 100
      : 0;
  const widthPercent = traceDuration > 0 && duration > 0 ? (duration / traceDuration) * 100 : 1;

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 cursor-pointer border-l-2 transition-colors",
          selectedId === obs.id
            ? "bg-accent border-l-primary"
            : "border-l-transparent hover:bg-accent/30",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(obs.id, false)}
      >
        {node.children.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="text-muted-foreground hover:text-foreground text-xs w-4"
          >
            {expanded ? "▾" : "▸"}
          </button>
        )}
        {node.children.length === 0 && <span className="w-4" />}

        <Tooltip>
          <TooltipTrigger className="inline-flex">
            <Icon className={cn("size-4 shrink-0", color)} />
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>

        <span className="text-sm truncate flex-shrink-0 max-w-[180px]">
          {obs.name || obs.id.slice(0, 8)}
        </span>

        {/* Latency bar */}
        <div className="flex-1 mx-2 h-3 relative bg-muted/30 rounded-sm overflow-hidden min-w-[60px]">
          <div
            className={cn("absolute h-full rounded-sm", barColor)}
            style={{
              left: `${Math.min(offsetPercent, 100)}%`,
              width: `${Math.max(Math.min(widthPercent, 100 - offsetPercent), 0.5)}%`,
            }}
          />
        </div>

        <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
          {duration > 0 ? formatDuration(duration) : "—"}
        </span>

        {obs.totalTokens > 0 && (
          <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
            {obs.totalTokens}t
          </span>
        )}
      </div>

      {expanded &&
        node.children.map((child) => (
          <TreeNodeRow
            key={child.observation.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
            traceStartTime={traceStartTime}
            traceDuration={traceDuration}
          />
        ))}
    </>
  );
}

export function TraceTree({ trace, observations, selectedId, onSelect }: TraceTreeProps) {
  const tree = buildTree(observations);

  const allTimes = observations.flatMap((o) => {
    const times = [new Date(o.startTime).getTime()];
    if (o.endTime) times.push(new Date(o.endTime).getTime());
    return times;
  });
  const traceStartTime =
    allTimes.length > 0 ? Math.min(...allTimes) : new Date(trace.timestamp).getTime();
  const traceEndTime = allTimes.length > 0 ? Math.max(...allTimes) : traceStartTime;
  const traceDuration = traceEndTime - traceStartTime;

  return (
    <TooltipProvider>
      <div className="flex flex-col">
        {/* Trace root node */}
        <div
          className={cn(
            "flex items-center gap-2 px-2 py-2 cursor-pointer border-l-2 transition-colors",
            selectedId === trace.id
              ? "bg-accent border-l-primary"
              : "border-l-transparent hover:bg-accent/30",
          )}
          onClick={() => onSelect(trace.id, true)}
        >
          <span className="w-4" />
          <Tooltip>
            <TooltipTrigger className="inline-flex">
              <Route className="size-4 shrink-0 text-purple-500" />
            </TooltipTrigger>
            <TooltipContent>Trace</TooltipContent>
          </Tooltip>
          <span className="text-sm font-medium truncate">{trace.name || trace.id.slice(0, 8)}</span>
          {traceDuration > 0 && (
            <span className="ml-auto text-xs text-muted-foreground font-mono">
              {formatDuration(traceDuration)}
            </span>
          )}
        </div>

        {/* Observation tree */}
        {tree.map((node) => (
          <TreeNodeRow
            key={node.observation.id}
            node={node}
            depth={1}
            selectedId={selectedId}
            onSelect={onSelect}
            traceStartTime={traceStartTime}
            traceDuration={traceDuration}
          />
        ))}

        {observations.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">No observations</div>
        )}
      </div>
    </TooltipProvider>
  );
}
