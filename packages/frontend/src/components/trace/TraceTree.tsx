"use client";

import { useState, useCallback, useMemo } from "react";
import { cn, formatDuration, formatCost } from "@/lib/utils";
import { getObservationIcon } from "@/lib/observation-icons";
import { Route, ChevronRight } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import type { Observation } from "@prisma/client";

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

function collectNodeIds(nodes: TreeNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.children.length > 0) {
      ids.push(node.observation.id);
      ids.push(...collectNodeIds(node.children));
    }
  }
  return ids;
}

function TreeNodeRow({
  node,
  depth,
  selectedId,
  onSelect,
  collapsedIds,
  onToggleCollapse,
}: {
  node: TreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string, isTrace: boolean) => void;
  collapsedIds: Set<string>;
  onToggleCollapse: (id: string) => void;
}) {
  const obs = node.observation;
  const isCollapsed = collapsedIds.has(obs.id);
  const { icon: Icon, color, label } = getObservationIcon(obs.type);
  const duration = obs.endTime
    ? new Date(obs.endTime).getTime() - new Date(obs.startTime).getTime()
    : 0;

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-1.5 pr-2 py-1.5 cursor-pointer transition-colors",
          selectedId === obs.id ? "bg-accent" : "hover:bg-accent/30",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(obs.id, false)}
      >
        {/* Expand/collapse or spacer */}
        {node.children.length > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse(obs.id);
            }}
            className="text-muted-foreground hover:text-foreground shrink-0 p-0.5"
          >
            <ChevronRight
              className={cn("size-3.5 transition-transform", !isCollapsed && "rotate-90")}
            />
          </button>
        ) : (
          <span className="w-[18px] shrink-0" />
        )}

        {/* Type icon */}
        <Tooltip>
          <TooltipTrigger className="inline-flex shrink-0">
            <Icon className={cn("size-4", color)} />
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>

        {/* Name */}
        <span className="text-sm truncate min-w-0 flex-1">{obs.name || obs.id.slice(0, 8)}</span>

        {/* Duration */}
        <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
          {duration > 0 ? formatDuration(duration) : "—"}
        </span>

        {/* Tokens */}
        {obs.totalTokens > 0 && (
          <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
            {obs.totalTokens}t
          </span>
        )}

        {/* Cost */}
        {obs.totalCost !== null && Number(obs.totalCost) > 0 && (
          <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
            {formatCost(Number(obs.totalCost))}
          </span>
        )}
      </div>

      {/* Children */}
      {!isCollapsed &&
        node.children.map((child) => (
          <TreeNodeRow
            key={child.observation.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
            collapsedIds={collapsedIds}
            onToggleCollapse={onToggleCollapse}
          />
        ))}
    </>
  );
}

export function TraceTree({ trace, observations, selectedId, onSelect }: TraceTreeProps) {
  const tree = useMemo(() => buildTree(observations), [observations]);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const onToggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setCollapsedIds(new Set()), []);
  const collapseAll = useCallback(() => {
    setCollapsedIds(new Set(collectNodeIds(tree)));
  }, [tree]);

  const traceDuration = useMemo(() => {
    const allTimes = observations.flatMap((o) => {
      const times = [new Date(o.startTime).getTime()];
      if (o.endTime) times.push(new Date(o.endTime).getTime());
      return times;
    });
    const start = allTimes.length > 0 ? Math.min(...allTimes) : new Date(trace.timestamp).getTime();
    const end = allTimes.length > 0 ? Math.max(...allTimes) : start;
    return end - start;
  }, [observations, trace.timestamp]);

  return (
    <TooltipProvider>
      <div className="flex flex-col">
        {/* Toolbar */}
        {observations.length > 0 && (
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50">
            <span className="text-xs text-muted-foreground">
              {observations.length} observation{observations.length !== 1 && "s"}
            </span>
            <div className="flex gap-1 text-xs">
              <button onClick={expandAll} className="text-muted-foreground hover:text-foreground">
                Expand all
              </button>
              <span className="text-border">|</span>
              <button onClick={collapseAll} className="text-muted-foreground hover:text-foreground">
                Collapse all
              </button>
            </div>
          </div>
        )}

        {/* Trace root node */}
        <div
          className={cn(
            "flex items-center gap-2 px-2 py-2 cursor-pointer transition-colors",
            selectedId === trace.id ? "bg-accent" : "hover:bg-accent/30",
          )}
          onClick={() => onSelect(trace.id, true)}
        >
          <span className="w-5 shrink-0" />
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
            collapsedIds={collapsedIds}
            onToggleCollapse={onToggleCollapse}
          />
        ))}

        {observations.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">No observations</div>
        )}
      </div>
    </TooltipProvider>
  );
}
