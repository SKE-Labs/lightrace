"use client";

import { useState, useCallback, useMemo } from "react";
import { cn, formatDuration, formatCost } from "@/lib/utils";
import { getObservationIcon } from "@/lib/observation-icons";
import { Route, ChevronRight } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
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
  /** IDs to highlight with an accent border (used for compare view cross-highlighting). */
  highlightIds?: Set<string>;
  /** ID of the fork point observation to mark with a visual indicator. */
  forkPointId?: string;
}

interface FlatNode {
  observation: Observation;
  depth: number;
  hasChildren: boolean;
  /** Per-ancestor-depth: does an ancestor at depth d have a sibling that comes later? */
  ancestorContinues: boolean[];
  /** Does this node's own depth have a sibling below this row? */
  hasSiblingBelow: boolean;
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

/**
 * Walk the tree DF-order producing a flat list with connector metadata.
 * Skips children of any node whose id is in `collapsedIds`.
 */
function flattenWithGuides(roots: TreeNode[], collapsedIds: Set<string>): FlatNode[] {
  const flat: FlatNode[] = [];

  function walk(nodes: TreeNode[], depth: number, ancestorContinues: boolean[]) {
    nodes.forEach((node, i) => {
      const isLastSibling = i === nodes.length - 1;
      const hasChildren = node.children.length > 0;

      flat.push({
        observation: node.observation,
        depth,
        hasChildren,
        ancestorContinues: ancestorContinues.slice(),
        hasSiblingBelow: !isLastSibling,
      });

      if (hasChildren && !collapsedIds.has(node.observation.id)) {
        walk(node.children, depth + 1, [...ancestorContinues, !isLastSibling]);
      }
    });
  }

  walk(roots, 1, []);
  return flat;
}

function collectAllParentIds(nodes: TreeNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.children.length > 0) {
      ids.push(node.observation.id);
      ids.push(...collectAllParentIds(node.children));
    }
  }
  return ids;
}

export function TraceTree({
  trace,
  observations,
  selectedId,
  onSelect,
  highlightIds,
  forkPointId,
}: TraceTreeProps) {
  const tree = useMemo(() => buildTree(observations), [observations]);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const flatNodes = useMemo(() => flattenWithGuides(tree, collapsedIds), [tree, collapsedIds]);

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
    setCollapsedIds(new Set(collectAllParentIds(tree)));
  }, [tree]);

  const traceDuration = useMemo(() => {
    const allTimes = observations.flatMap((o) => {
      const times = [new Date(o.startTime).getTime()];
      if (o.endTime) times.push(new Date(o.endTime).getTime());
      return times;
    });
    let start = new Date(trace.timestamp).getTime();
    let end = start;
    for (const t of allTimes) {
      if (t < start) start = t;
      if (t > end) end = t;
    }
    return end - start;
  }, [observations, trace.timestamp]);

  return (
    <div className="flex flex-col">
      {/* Toolbar */}
      {observations.length > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50">
          <span className="text-[11px] text-muted-foreground">
            {observations.length} observation{observations.length !== 1 && "s"}
          </span>
          <div className="flex gap-1.5 text-[11px]">
            <button
              onClick={expandAll}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Expand
            </button>
            <span className="text-border">|</span>
            <button
              onClick={collapseAll}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Collapse
            </button>
          </div>
        </div>
      )}

      {/* Trace root node */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors duration-100",
          selectedId === trace.id ? "bg-foreground/7" : "hover:bg-foreground/3",
        )}
        onClick={() => onSelect(trace.id, true)}
      >
        <span className="w-4 shrink-0" />
        <Tooltip>
          <TooltipTrigger className="inline-flex">
            <Route className="size-4 shrink-0 text-chart-4" strokeWidth={2} />
          </TooltipTrigger>
          <TooltipContent>Trace</TooltipContent>
        </Tooltip>
        <span className="text-[12.5px] truncate min-w-0 flex-1 text-foreground">
          {trace.name || trace.id.slice(0, 8)}
        </span>
        {traceDuration > 0 && (
          <span className="ml-auto text-[11px] text-muted-foreground font-mono">
            {formatDuration(traceDuration)}
          </span>
        )}
      </div>

      {/* Observation tree (flattened) */}
      {flatNodes.map((flat) => {
        const obs = flat.observation;
        const { icon: Icon, color, label } = getObservationIcon(obs.type);
        const duration = obs.endTime
          ? new Date(obs.endTime).getTime() - new Date(obs.startTime).getTime()
          : 0;
        const isSelected = selectedId === obs.id;
        const isHighlighted = highlightIds?.has(obs.id);
        const isForkPoint = forkPointId === obs.id;
        const isCollapsed = collapsedIds.has(obs.id);

        return (
          <div
            key={obs.id}
            className={cn(
              "flex items-center pr-3 cursor-pointer transition-colors duration-100 select-none",
              "h-7", // 28px row height
              isSelected ? "bg-foreground/[0.07]" : "hover:bg-foreground/3",
              isHighlighted && "ring-1 ring-inset ring-primary/30",
              isForkPoint && !isSelected && "ring-1 ring-inset ring-primary/30 bg-row-fork",
            )}
            onClick={() => onSelect(obs.id, false)}
          >
            {/* Connector guides for ancestor depths 1..depth-1 */}
            {flat.ancestorContinues.map((continues, i) => (
              <span key={`g-${i}`} className={cn("tree-guide", continues && "tree-guide-v")} />
            ))}
            {/* Connector at this node's own depth (T or L) */}
            {flat.depth > 0 && (
              <span
                className={cn("tree-guide", flat.hasSiblingBelow ? "tree-guide-t" : "tree-guide-l")}
              />
            )}

            {/* Expand/collapse toggle or spacer */}
            {flat.hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapse(obs.id);
                }}
                className="flex items-center justify-center size-4 shrink-0 text-muted-foreground hover:text-foreground transition-colors rounded-sm"
              >
                <ChevronRight
                  className={cn("size-3 transition-transform", !isCollapsed && "rotate-90")}
                  strokeWidth={2.5}
                />
              </button>
            ) : (
              <span className="w-4 shrink-0" />
            )}

            {/* Type icon (PRESERVED — colors from observation-icons.ts) */}
            <Tooltip>
              <TooltipTrigger className="inline-flex shrink-0 mx-1">
                <Icon className={cn("size-3.75", color)} strokeWidth={2} />
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>

            {/* Name */}
            <span className="text-[12.5px] truncate min-w-0 flex-1 text-foreground">
              {obs.name || obs.id.slice(0, 8)}
            </span>

            {/* Error indicator */}
            {obs.level === "ERROR" && (
              <span className="size-1.5 rounded-full bg-error shrink-0 ml-1.5" title="Error" />
            )}

            {/* Tokens */}
            {obs.totalTokens > 0 && (
              <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap ml-1.5">
                {obs.totalTokens}t
              </span>
            )}

            {/* Cost */}
            {obs.totalCost !== null && Number(obs.totalCost) > 0 && (
              <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap ml-1.5">
                {formatCost(Number(obs.totalCost))}
              </span>
            )}

            {/* Duration */}
            <span className="text-[10.5px] text-muted-foreground font-mono whitespace-nowrap ml-1.5">
              {duration > 0 ? formatDuration(duration) : "—"}
            </span>
          </div>
        );
      })}

      {observations.length === 0 && (
        <div className="px-6 py-8 text-center text-sm text-muted-foreground">No observations</div>
      )}
    </div>
  );
}
