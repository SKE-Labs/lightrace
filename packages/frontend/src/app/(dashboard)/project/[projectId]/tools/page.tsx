"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useProjectStore } from "@/lib/project-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Wrench, Play } from "lucide-react";
import { JsonViewer } from "@/components/trace/json-viewer";
import { ToolRerunModal } from "@/components/trace/tool-rerun-modal";

function HealthBadge({ status }: { status?: { status: string; message?: string } }) {
  if (!status) {
    return (
      <Badge variant="outline" className="text-xs text-muted-foreground">
        checking...
      </Badge>
    );
  }

  switch (status.status) {
    case "healthy":
      return (
        <Badge className="text-xs gap-1 bg-success/15 text-success border-success/30">
          <span className="size-1.5 rounded-full bg-success" />
          Connected
        </Badge>
      );
    case "unhealthy":
    case "unreachable":
      return (
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="destructive" className="text-xs gap-1">
              <span className="size-1.5 rounded-full bg-destructive" />
              Offline
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">{status.message ?? "Dev server unreachable"}</p>
          </TooltipContent>
        </Tooltip>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
          <span className="size-1.5 rounded-full bg-muted-foreground" />
          No server
        </Badge>
      );
  }
}

export default function ToolsPage() {
  const projectId = useProjectStore((s) => s.projectId);
  const { data: tools, isLoading } = trpc.tools.list.useQuery(
    { projectId: projectId! },
    { refetchInterval: 10_000, enabled: !!projectId },
  );
  const { data: healthStatus } = trpc.tools.healthCheckAll.useQuery(
    { projectId: projectId! },
    { refetchInterval: 15_000, enabled: !!projectId },
  );
  const [invokeTarget, setInvokeTarget] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl space-y-6">
          {isLoading && <p className="text-sm text-muted-foreground">Loading tools...</p>}

          {tools && tools.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Wrench className="size-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No tools registered yet.</p>
                <p className="text-xs mt-1">
                  Use <code className="text-xs bg-muted px-1 py-0.5 rounded">defineTool()</code> or{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">
                    @trace(type=&quot;tool&quot;)
                  </code>{" "}
                  in your SDK to register tools.
                </p>
              </CardContent>
            </Card>
          )}

          {tools && tools.length > 0 && (
            <div className="space-y-3">
              {tools.map((tool) => {
                const health = healthStatus?.[tool.toolName];
                const isHealthy = health?.status === "healthy";
                return (
                  <Card key={tool.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Wrench className="size-4" />
                          {tool.toolName}
                          <HealthBadge status={health} />
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {health != null && !isHealthy ? (
                            <Tooltip>
                              <TooltipTrigger>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1 text-xs h-7"
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
                              className="gap-1 text-xs h-7"
                              onClick={() => setInvokeTarget(tool.toolName)}
                            >
                              <Play className="size-3" />
                              Invoke
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {tool.description && (
                        <p className="text-sm text-muted-foreground">{String(tool.description)}</p>
                      )}
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-muted-foreground">Callback URL</span>
                        <span className="font-mono text-xs">{tool.callbackUrl}</span>
                      </div>
                      {tool.inputSchema && (
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Input Schema</span>
                          <div className="rounded-md border border-border bg-muted/50 p-2">
                            <JsonViewer data={tool.inputSchema} />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

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
