"use client";

import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, Wifi, WifiOff } from "lucide-react";
import { JsonViewer } from "@/components/trace/JsonViewer";

export default function ToolsSettingsPage() {
  const { data: tools, isLoading } = trpc.tools.list.useQuery(undefined, {
    refetchInterval: 10_000,
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">Tools</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Connected SDK instances and their registered tools
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl space-y-6">
          {isLoading && <p className="text-sm text-muted-foreground">Loading tools...</p>}

          {tools && tools.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Wrench className="size-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No tools registered yet.</p>
                <p className="text-xs mt-1">
                  Use{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">
                    @trace(type=&quot;tool&quot;)
                  </code>{" "}
                  in your SDK to register invocable tools.
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
                      <Badge
                        variant="outline"
                        className={`text-xs font-mono gap-1 ${
                          tool.status === "online"
                            ? "bg-green-500/15 text-green-800 dark:text-green-400 border-green-500/30"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {tool.status === "online" ? (
                          <Wifi className="size-3" />
                        ) : (
                          <WifiOff className="size-3" />
                        )}
                        {tool.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-muted-foreground">SDK Instance</span>
                      <span className="font-mono text-xs">{tool.sdkInstanceId}</span>
                    </div>
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-muted-foreground">Last heartbeat</span>
                      <span>{new Date(tool.lastHeartbeat).toLocaleString()}</span>
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
    </div>
  );
}
