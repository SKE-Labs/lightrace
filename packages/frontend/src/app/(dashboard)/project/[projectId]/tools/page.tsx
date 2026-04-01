"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useProjectStore } from "@/lib/project-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, Play } from "lucide-react";
import { JsonViewer } from "@/components/trace/json-viewer";
import { ToolRerunModal } from "@/components/trace/tool-rerun-modal";

export default function ToolsPage() {
  const projectId = useProjectStore((s) => s.projectId);
  const { data: tools, isLoading } = trpc.tools.list.useQuery(
    { projectId: projectId! },
    { refetchInterval: 10_000, enabled: !!projectId },
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
              {tools.map((tool) => (
                <Card key={tool.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Wrench className="size-4" />
                        {tool.toolName}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-xs h-7"
                          onClick={() => setInvokeTarget(tool.toolName)}
                        >
                          <Play className="size-3" />
                          Invoke
                        </Button>
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
              ))}
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
