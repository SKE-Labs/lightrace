"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useProjectStore } from "@/lib/project-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Wrench, Play, Search } from "lucide-react";
import { JsonViewer } from "@/components/trace/json-viewer";
import { ToolRerunModal } from "@/components/trace/tool-rerun-modal";
import { PaginationBar } from "@/components/pagination-bar";
import { HealthBadge } from "@/components/tools/health-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_SIZE, TOOLS_REFETCH_INTERVAL_MS, HEALTH_REFETCH_INTERVAL_MS } from "@/lib/constants";
import { useDebouncedSearch } from "@/lib/use-debounced-search";

export default function ToolsPage() {
  const projectId = useProjectStore((s) => s.projectId);
  const { search, debouncedSearch, setSearch } = useDebouncedSearch();
  const [page, setPage] = useState(1);
  const [invokeTarget, setInvokeTarget] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data, isLoading } = trpc.tools.list.useQuery(
    { projectId: projectId!, limit: PAGE_SIZE.TOOLS, page, search: debouncedSearch || undefined },
    {
      refetchInterval: TOOLS_REFETCH_INTERVAL_MS,
      refetchIntervalInBackground: false,
      enabled: !!projectId,
    },
  );
  const { data: healthStatus } = trpc.tools.healthCheckAll.useQuery(
    { projectId: projectId! },
    {
      refetchInterval: HEALTH_REFETCH_INTERVAL_MS,
      refetchIntervalInBackground: false,
      enabled: !!projectId,
    },
  );

  const tools = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.totalCount ?? 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end px-6 py-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            size="sm"
            placeholder="Search tools…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 pl-8"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <Skeleton className="h-5 w-32" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && tools.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Wrench className="size-8 mx-auto mb-2 opacity-50" />
              {debouncedSearch ? (
                <p className="text-sm">No tools matching &ldquo;{debouncedSearch}&rdquo;</p>
              ) : (
                <>
                  <p className="text-sm">No tools registered yet.</p>
                  <p className="text-xs mt-1">
                    Use <code className="text-xs bg-muted px-1 py-0.5 rounded">defineTool()</code>{" "}
                    or{" "}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      @trace(type=&quot;tool&quot;)
                    </code>{" "}
                    in your SDK to register tools.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {!isLoading && tools.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {tools.map((tool) => {
              const health = healthStatus?.[tool.toolName];
              const isHealthy = health?.status === "healthy";
              return (
                <Card key={tool.id} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2 min-w-0">
                        <Wrench className="size-4 shrink-0" />
                        <span className="truncate">{tool.toolName}</span>
                      </CardTitle>
                      <HealthBadge status={health} />
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-3">
                    {tool.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {String(tool.description)}
                      </p>
                    )}
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Callback URL</span>
                      <p className="font-mono text-xs truncate">{tool.callbackUrl}</p>
                    </div>
                    {tool.inputSchema && (
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Input Schema</span>
                        <div className="rounded-md border border-border bg-muted/50 p-2 max-h-32 overflow-auto">
                          <JsonViewer data={tool.inputSchema} />
                        </div>
                      </div>
                    )}
                  </CardContent>
                  <div className="px-6 pb-4 pt-2">
                    {health != null && !isHealthy ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-1 text-xs h-7"
                            disabled
                          >
                            <Play className="size-3" />
                            Invoke
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="text-xs">
                            SDK dev server is offline. Start your SDK to invoke this tool.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1 text-xs h-7"
                        onClick={() => setInvokeTarget(tool.toolName)}
                      >
                        <Play className="size-3" />
                        Invoke
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <PaginationBar
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={PAGE_SIZE.TOOLS}
        onPageChange={setPage}
        label="tools"
      />

      {invokeTarget && (
        <ToolRerunModal
          open={true}
          onOpenChange={(open) => {
            if (!open) setInvokeTarget(null);
          }}
          toolName={invokeTarget}
          originalInput={{}}
          originalOutput={null}
          projectId={projectId ?? undefined}
        />
      )}
    </div>
  );
}
