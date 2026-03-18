"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useProjectStore } from "@/lib/project-store";
import { useRealtimeTraceUpdates } from "@/lib/use-realtime";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { formatDuration, formatTokens, formatCost, formatRelativeTime } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "ellipsis")[] = [1];

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) pages.push("ellipsis");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("ellipsis");

  pages.push(total);
  return pages;
}

export function TraceList() {
  const router = useRouter();
  const projectId = useProjectStore((s) => s.projectId);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  // Real-time updates via WebSocket
  useRealtimeTraceUpdates(projectId ?? "");

  const { data, isLoading, isError, error } = trpc.traces.list.useQuery(
    { projectId: projectId!, limit: PAGE_SIZE, page, search: search || undefined },
    { retry: false, refetchInterval: 30000, enabled: !!projectId },
  );

  const traces = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.totalCount ?? 0;

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-end px-6 py-3">
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card border-b border-border">
              <tr className="text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Timestamp</th>
                <th className="px-4 py-3 text-right font-medium">Latency</th>
                <th className="px-4 py-3 text-right font-medium">Tokens</th>
                <th className="px-4 py-3 text-right font-medium">Cost</th>
                <th className="px-4 py-3 text-right font-medium">Obs</th>
                <th className="px-4 py-3 text-left font-medium">Tags</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                !isError &&
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="px-4 py-3">
                      <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="h-4 w-12 bg-muted animate-pulse rounded ml-auto" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="h-4 w-10 bg-muted animate-pulse rounded ml-auto" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="h-4 w-14 bg-muted animate-pulse rounded ml-auto" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="h-4 w-6 bg-muted animate-pulse rounded ml-auto" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                    </td>
                  </tr>
                ))}
              {isError && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
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
                  </td>
                </tr>
              )}
              {!isLoading && traces.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    No traces yet. Send traces using the Lightrace SDK.
                  </td>
                </tr>
              )}
              {traces.map((trace) => (
                <tr
                  key={trace.id}
                  className="border-b border-border/50 hover:bg-accent/30 transition-colors cursor-pointer"
                  onClick={() => router.push(`/project/${projectId}/traces/${trace.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {trace.hasError && (
                        <span
                          className="size-2 rounded-full bg-error shrink-0"
                          title="Has errors"
                        />
                      )}
                      {trace.hasWarning && (
                        <span
                          className="size-2 rounded-full bg-warning shrink-0"
                          title="Has warnings"
                        />
                      )}
                      <span className="font-medium text-foreground truncate">
                        {trace.name || trace.id.slice(0, 8)}
                      </span>
                      {trace.primaryModel && (
                        <Badge variant="secondary" className="text-xs font-mono shrink-0">
                          {trace.primaryModel}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Tooltip>
                      <TooltipTrigger className="cursor-default">
                        <span className="text-muted-foreground">
                          {formatRelativeTime(new Date(trace.timestamp))}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{new Date(trace.timestamp).toLocaleString()}</TooltipContent>
                    </Tooltip>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {trace.latencyMs > 0 ? formatDuration(trace.latencyMs) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {trace.totalTokens > 0 ? formatTokens(trace.totalTokens) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {trace.totalCost ? formatCost(trace.totalCost) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {trace.observationCount}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {trace.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalCount > 0 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-3">
            <span className="text-xs text-muted-foreground">
              Showing {rangeStart}–{rangeEnd} of {totalCount} traces
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                {getPageNumbers(page, totalPages).map((p, i) =>
                  p === "ellipsis" ? (
                    <span key={`e${i}`} className="px-1 text-xs text-muted-foreground">
                      ...
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={cn(
                        "size-7 rounded-md text-xs font-medium transition-colors",
                        p === page
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      {p}
                    </button>
                  ),
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
