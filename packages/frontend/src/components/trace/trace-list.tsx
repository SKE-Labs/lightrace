"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { useProjectStore } from "@/lib/project-store";
import { useRealtimeTraceUpdates } from "@/lib/use-realtime";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { formatDuration, formatTokens, formatCost, formatRelativeTime } from "@/lib/utils";
import { PaginationBar } from "@/components/pagination-bar";
import { GitBranch, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

type TraceListItem = RouterOutputs["traces"]["list"]["items"][number];
// Forks share the same shape as parent items (no nested forks-of-forks)
type TraceForkItem = Omit<TraceListItem, "forks">;

export function TraceList() {
  const router = useRouter();
  const projectId = useProjectStore((s) => s.projectId);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expandedForks, setExpandedForks] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, error } = trpc.traces.list.useQuery(
    { projectId: projectId!, limit: PAGE_SIZE, page, search: search || undefined },
    { retry: false, refetchInterval: 30000, enabled: !!projectId },
  );

  const traces = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.totalCount ?? 0;

  useEffect(() => {
    setPage(1);
  }, [search]);

  useRealtimeTraceUpdates(projectId ?? "");

  const toggleFork = (id: string) => {
    setExpandedForks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNavigate = (traceId: string) => {
    router.push(`/project/${projectId}/traces/${traceId}`);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end px-6 py-3">
        <Input
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 h-8"
        />
      </div>
      <div className="flex-1 overflow-auto">
        <Table density="tight">
          <TableHeader sticky>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead className="text-right">Latency</TableHead>
              <TableHead className="text-right">Tokens</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Obs</TableHead>
              <TableHead>Tags</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              !isError &&
              Array.from({ length: 5 }, (_, i) => (
                <TableRow key={`skeleton-${i}`} className="hover:bg-transparent">
                  <TableCell>
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="h-4 w-12 bg-muted animate-pulse rounded ml-auto" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="h-4 w-10 bg-muted animate-pulse rounded ml-auto" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="h-4 w-14 bg-muted animate-pulse rounded ml-auto" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="h-4 w-6 bg-muted animate-pulse rounded ml-auto" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                  </TableCell>
                </TableRow>
              ))}
            {isError && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                  {error?.message?.includes("UNAUTHORIZED") ? (
                    <span>
                      Please{" "}
                      <a href="/login" className="text-primary hover:underline">
                        sign in
                      </a>{" "}
                      to view traces.
                    </span>
                  ) : (
                    <span>Failed to load traces: {error?.message}</span>
                  )}
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !isError && traces.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                  No traces yet. Send traces using the Lightrace SDK.
                </TableCell>
              </TableRow>
            )}
            {traces.map((trace) => {
              const forks = trace.forks;
              const hasForks = forks.length > 0;
              const isExpanded = expandedForks.has(trace.id);
              return (
                <FragmentRow
                  key={trace.id}
                  trace={trace}
                  forks={forks}
                  hasForks={hasForks}
                  isExpanded={isExpanded}
                  onToggle={() => toggleFork(trace.id)}
                  onNavigate={handleNavigate}
                />
              );
            })}
          </TableBody>
        </Table>
      </div>

      <PaginationBar
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        label="traces"
      />
    </div>
  );
}

function FragmentRow({
  trace,
  forks,
  hasForks,
  isExpanded,
  onToggle,
  onNavigate,
}: {
  trace: TraceListItem;
  forks: TraceForkItem[];
  hasForks: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onNavigate: (id: string) => void;
}) {
  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => onNavigate(trace.id)}>
        <TableCell>
          <div className="flex items-center gap-2">
            {hasForks ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
                className="flex items-center justify-center size-4 shrink-0 -ml-1 text-muted-foreground hover:text-foreground transition-colors rounded-sm"
                title={isExpanded ? "Collapse forks" : "Expand forks"}
              >
                <ChevronRight
                  className={cn("size-3 transition-transform", isExpanded && "rotate-90")}
                  strokeWidth={2}
                />
              </button>
            ) : (
              <span className="w-3 shrink-0" />
            )}
            {trace.hasError && (
              <span className="size-1.5 rounded-full bg-error shrink-0" title="Has errors" />
            )}
            {trace.hasWarning && (
              <span className="size-1.5 rounded-full bg-warning shrink-0" title="Has warnings" />
            )}
            <span className="font-medium text-foreground truncate">
              {trace.name || trace.id.slice(0, 8)}
            </span>
            {trace.primaryModel && (
              <Badge variant="secondary" className="font-mono shrink-0">
                {trace.primaryModel}
              </Badge>
            )}
            {trace.forkCount > 0 && (
              <Badge
                variant="outline"
                className="shrink-0 gap-1 text-primary border-primary/30 bg-primary/10"
              >
                <GitBranch className="size-3" strokeWidth={1.5} />
                {trace.forkCount}
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell>
          <Tooltip>
            <TooltipTrigger className="cursor-default">
              <span className="text-muted-foreground">
                {formatRelativeTime(new Date(trace.timestamp))}
              </span>
            </TooltipTrigger>
            <TooltipContent>{new Date(trace.timestamp).toLocaleString()}</TooltipContent>
          </Tooltip>
        </TableCell>
        <TableCell className="text-right font-mono text-muted-foreground">
          {trace.latencyMs > 0 ? formatDuration(trace.latencyMs) : "—"}
        </TableCell>
        <TableCell className="text-right font-mono text-muted-foreground">
          {trace.totalTokens > 0 ? formatTokens(trace.totalTokens) : "—"}
        </TableCell>
        <TableCell className="text-right font-mono text-muted-foreground">
          {trace.totalCost ? formatCost(trace.totalCost) : "—"}
        </TableCell>
        <TableCell className="text-right text-muted-foreground">{trace.observationCount}</TableCell>
        <TableCell>
          <div className="flex gap-1">
            {trace.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="font-mono">
                {tag}
              </Badge>
            ))}
          </div>
        </TableCell>
      </TableRow>

      {/* Nested fork rows */}
      {hasForks &&
        isExpanded &&
        forks.map((fork, i) => {
          const isLast = i === forks.length - 1;
          return (
            <TableRow
              key={fork.id}
              className="cursor-pointer bg-row-fork hover:bg-foreground/[0.06] text-foreground/80"
              onClick={() => onNavigate(fork.id)}
            >
              <TableCell>
                <div className="flex items-center gap-1">
                  {/* Connector cell — T (has next) or L (last) */}
                  <span
                    className={cn("tree-guide -ml-1", isLast ? "tree-guide-l" : "tree-guide-t")}
                  />
                  <GitBranch className="size-3 text-primary shrink-0" strokeWidth={1.5} />
                  {fork.hasError && (
                    <span
                      className="size-1.5 rounded-full bg-error shrink-0 ml-1"
                      title="Has errors"
                    />
                  )}
                  {fork.hasWarning && (
                    <span
                      className="size-1.5 rounded-full bg-warning shrink-0 ml-1"
                      title="Has warnings"
                    />
                  )}
                  <span className="text-foreground/85 truncate ml-1">
                    {fork.name || fork.id.slice(0, 8)}
                  </span>
                  {fork.primaryModel && (
                    <Badge variant="secondary" className="font-mono shrink-0">
                      {fork.primaryModel}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Tooltip>
                  <TooltipTrigger className="cursor-default">
                    <span className="text-muted-foreground">
                      {formatRelativeTime(new Date(fork.timestamp))}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{new Date(fork.timestamp).toLocaleString()}</TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {fork.latencyMs > 0 ? formatDuration(fork.latencyMs) : "—"}
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {fork.totalTokens > 0 ? formatTokens(fork.totalTokens) : "—"}
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {fork.totalCost ? formatCost(fork.totalCost) : "—"}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {fork.observationCount}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {fork.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="font-mono">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
    </>
  );
}
