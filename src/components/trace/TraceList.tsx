"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDuration, formatTokens, formatCost } from "@/lib/utils";

export function TraceList() {
  const [search, setSearch] = useState("");
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.traces.list.useInfiniteQuery(
      { limit: 50, search: search || undefined },
      { getNextPageParam: (lastPage) => lastPage.nextCursor, retry: false },
    );

  const traces = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold">Traces</h1>
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
              <th className="px-6 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Timestamp</th>
              <th className="px-4 py-3 text-right font-medium">Latency</th>
              <th className="px-4 py-3 text-right font-medium">Tokens</th>
              <th className="px-4 py-3 text-right font-medium">Cost</th>
              <th className="px-4 py-3 text-right font-medium">Obs</th>
              <th className="px-4 py-3 text-left font-medium">Tags</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && !isError && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            )}
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
                  No traces yet. Send traces using the Langfuse SDK.
                </td>
              </tr>
            )}
            {traces.map((trace) => (
              <tr
                key={trace.id}
                className="border-b border-border/50 hover:bg-accent/30 transition-colors"
              >
                <td className="px-6 py-3">
                  <Link
                    href={`/traces/${trace.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {trace.name || trace.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(trace.timestamp).toLocaleString()}
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
        {hasNextPage && (
          <div className="flex justify-center py-4">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {isFetchingNextPage ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
