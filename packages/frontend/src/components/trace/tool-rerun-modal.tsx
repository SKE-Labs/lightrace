"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { FormattedView } from "./formatted-view";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Play, CheckCircle2, XCircle, ChevronRight, Info, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { useToolInputEditor } from "@/lib/use-tool-input-editor";
import { ToolInputEditor } from "./tool-input-editor";
import { DevServerOfflineAlert } from "./dev-server-offline-alert";

// --- Main Component ---

interface ToolRerunModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toolName: string;
  originalInput: unknown;
  originalOutput: unknown;
  observationId?: string;
  /** Project ID for the tool invocation */
  projectId?: string;
  /** Captured execution context from observation metadata.__lightrace_context */
  context?: Record<string, unknown>;
}

export function ToolRerunModal({
  open,
  onOpenChange,
  toolName,
  originalInput,
  originalOutput,
  observationId,
  projectId,
  context,
}: ToolRerunModalProps) {
  const healthCheck = trpc.tools.healthCheck.useQuery(
    { projectId: projectId ?? "", toolName },
    { enabled: open && !!projectId },
  );
  const devServerOffline = healthCheck.data != null && healthCheck.data.status !== "healthy";

  const editor = useToolInputEditor(originalInput, observationId);
  const [contextText, setContextText] = useState(context ? JSON.stringify(context, null, 2) : "{}");
  const hasContext = context != null && Object.keys(context).length > 0;
  const [contextOpen, setContextOpen] = useState(hasContext);

  interface InvokeResult {
    output: unknown;
    error?: string;
    durationMs: number;
  }
  const [result, setResult] = useState<InvokeResult | null>(null);

  // Reset context/result when switching observations (input reset handled by hook)
  useEffect(() => {
    setContextText(context ? JSON.stringify(context, null, 2) : "{}");
    setContextOpen(context != null && Object.keys(context).length > 0);
    setResult(null);
  }, [observationId, context]);

  const invoke = trpc.tools.invoke.useMutation({
    onSuccess: (data) =>
      setResult({
        output: data.output,
        error: data.error ?? undefined,
        durationMs: data.durationMs,
      }),
    onError: (err) => setResult({ output: null, error: err.message, durationMs: 0 }),
  });

  const handleRun = () => {
    try {
      const parsedInput = editor.getParsedInput();

      let parsedContext: Record<string, unknown> | undefined;
      try {
        const ctx = JSON.parse(contextText);
        if (ctx && typeof ctx === "object" && Object.keys(ctx).length > 0) {
          parsedContext = ctx as Record<string, unknown>;
        }
      } catch {
        // Invalid context JSON — send without context
      }

      setResult(null);
      invoke.mutate({
        projectId: projectId ?? "",
        toolName,
        input: parsedInput,
        context: parsedContext,
        observationId,
      });
    } catch (e) {
      setResult({
        output: null,
        error: editor.rawMode ? "Invalid JSON input" : String(e),
        durationMs: 0,
      });
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col" showCloseButton>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Play className="size-4" />
              Re-run: {toolName}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-auto space-y-4 p-4">
            {devServerOffline && (
              <DevServerOfflineAlert callbackUrl={healthCheck.data?.callbackUrl} />
            )}

            <ToolInputEditor
              rows={editor.rows}
              onChangeRows={editor.setRows}
              rawMode={editor.rawMode}
              rawText={editor.rawText}
              onChangeRawText={editor.setRawText}
              onSwitchToTable={editor.switchToTable}
              onSwitchToRaw={editor.switchToRaw}
              rawJsonValid={editor.rawJsonValid}
              label="Input"
            />

            {/* Context editor (collapsible) */}
            <div className="space-y-2">
              <button
                onClick={() => setContextOpen(!contextOpen)}
                className="inline-flex items-center gap-1"
              >
                <ChevronRight
                  className={cn(
                    "size-3.5 text-muted-foreground transition-transform",
                    contextOpen && "rotate-90",
                  )}
                />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Context
                </span>
                {hasContext && (
                  <Badge variant="outline" className="text-xs ml-1">
                    captured
                  </Badge>
                )}
                <Tooltip>
                  <TooltipTrigger className="cursor-default">
                    <Info className="size-3 text-muted-foreground ml-0.5" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[250px]">
                    <p className="text-xs">
                      Execution context captured at trace time (user IDs, thread state, etc.) needed
                      to reproduce the tool call.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </button>
              {contextOpen && (
                <textarea
                  value={contextText}
                  onChange={(e) => setContextText(e.target.value)}
                  className="w-full min-h-[100px] rounded-md border border-border bg-muted/50 p-3 font-mono text-xs resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                  spellCheck={false}
                  placeholder='{"user_id": "...", "thread_id": "...", ...}'
                />
              )}
            </div>

            {/* Result */}
            {result !== null && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Result
                  </label>
                  {result.error ? (
                    <Badge variant="destructive" className="text-xs gap-1">
                      <XCircle className="size-3" />
                      Error
                    </Badge>
                  ) : (
                    <Badge className="text-xs gap-1 bg-success/15 text-success border-success/30">
                      <CheckCircle2 className="size-3" />
                      Success
                    </Badge>
                  )}
                  {result.durationMs > 0 && (
                    <Badge variant="outline" className="text-xs font-mono">
                      {result.durationMs}ms
                    </Badge>
                  )}
                  {!result.error && (
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(
                          typeof result.output === "string"
                            ? result.output
                            : JSON.stringify(result.output, null, 2),
                        )
                      }
                      className="text-muted-foreground hover:text-foreground transition-colors ml-auto"
                      title="Copy result"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  )}
                </div>

                {result.error ? (
                  <Alert variant="destructive">
                    <XCircle className="size-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription className="font-mono">{result.error}</AlertDescription>
                  </Alert>
                ) : originalOutput !== null && originalOutput !== undefined ? (
                  /* Stacked comparison */
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Re-run Result
                      </span>
                      <FormattedView data={result.output} />
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Original Output
                      </span>
                      <FormattedView data={originalOutput} />
                    </div>
                  </div>
                ) : (
                  <FormattedView data={result.output} />
                )}
              </div>
            )}
          </div>

          <SheetFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              onClick={handleRun}
              disabled={
                invoke.isPending ||
                (!editor.rawMode && editor.hasRowErrors) ||
                (editor.rawMode && !editor.rawJsonValid)
              }
            >
              {invoke.isPending ? (
                <>
                  <Spinner size="sm" className="mr-1" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="size-4 mr-1" />
                  Run
                </>
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
