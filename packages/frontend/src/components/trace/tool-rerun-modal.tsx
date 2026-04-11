"use client";

import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { FormattedView } from "./formatted-view";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Info,
  Copy,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  KeyValueEditor,
  inputToRows,
  rowsToInput,
  validateRow,
  pythonReprToJson,
} from "./key-value-editor";

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

  const [rows, setRows] = useState(() => inputToRows(originalInput));
  const [rawMode, setRawMode] = useState(false);
  const [rawText, setRawText] = useState(() => {
    if (typeof originalInput === "string") {
      const parsed = pythonReprToJson(originalInput);
      if (parsed !== null) return JSON.stringify(parsed, null, 2);
    }
    return JSON.stringify(originalInput, null, 2) ?? "{}";
  });
  const [contextText, setContextText] = useState(context ? JSON.stringify(context, null, 2) : "{}");
  const hasContext = context != null && Object.keys(context).length > 0;
  const [contextOpen, setContextOpen] = useState(hasContext);

  interface InvokeResult {
    output: unknown;
    error?: string;
    durationMs: number;
  }
  const [result, setResult] = useState<InvokeResult | null>(null);

  // Reset state when switching between observations
  useEffect(() => {
    setRows(inputToRows(originalInput));
    setRawMode(false);
    if (typeof originalInput === "string") {
      const parsed = pythonReprToJson(originalInput);
      if (parsed !== null) {
        setRawText(JSON.stringify(parsed, null, 2));
      } else {
        setRawText(JSON.stringify(originalInput, null, 2) ?? "{}");
      }
    } else {
      setRawText(JSON.stringify(originalInput, null, 2) ?? "{}");
    }
    setContextText(context ? JSON.stringify(context, null, 2) : "{}");
    setContextOpen(context != null && Object.keys(context).length > 0);
    setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observationId]);

  const invoke = trpc.tools.invoke.useMutation({
    onSuccess: (data) =>
      setResult({
        output: data.output,
        error: data.error ?? undefined,
        durationMs: data.durationMs,
      }),
    onError: (err) => setResult({ output: null, error: err.message, durationMs: 0 }),
  });

  // Validation
  const rowErrors = useMemo(() => rows.map(validateRow), [rows]);
  const hasRowErrors = rowErrors.some((e) => e !== null);
  const rawJsonValid = useMemo(() => {
    if (!rawMode) return true;
    try {
      JSON.parse(rawText);
      return true;
    } catch {
      return false;
    }
  }, [rawMode, rawText]);

  const handleRun = () => {
    try {
      let parsedInput: unknown;
      if (rawMode) {
        parsedInput = JSON.parse(rawText);
      } else {
        parsedInput = rowsToInput(rows);
      }

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
        error: rawMode ? "Invalid JSON input" : String(e),
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
            {/* Health warning */}
            {devServerOffline && (
              <Alert variant="warning">
                <AlertTriangle className="size-4" />
                <AlertTitle>SDK dev server is not reachable</AlertTitle>
                <AlertDescription>
                  Make sure your SDK is running.
                  {healthCheck.data?.callbackUrl?.includes("127.0.0.1") &&
                    " If using Docker, set LIGHTRACE_DEV_SERVER_HOST to your host IP."}
                </AlertDescription>
              </Alert>
            )}

            {/* Input editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Input
                </label>
                <div className="flex rounded-md border border-border text-xs overflow-hidden">
                  <button
                    onClick={() => {
                      if (rawMode) {
                        // Switching to table: try to parse raw text into rows
                        try {
                          const parsed = JSON.parse(rawText);
                          setRows(inputToRows(parsed));
                        } catch {
                          // Keep raw mode if can't parse
                          return;
                        }
                      }
                      setRawMode(false);
                    }}
                    className={cn(
                      "px-2 py-0.5 transition-colors",
                      !rawMode
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Table
                  </button>
                  <button
                    onClick={() => {
                      if (!rawMode) {
                        // Switching to raw: serialize rows to JSON
                        try {
                          setRawText(JSON.stringify(rowsToInput(rows), null, 2));
                        } catch {
                          setRawText("{}");
                        }
                      }
                      setRawMode(true);
                    }}
                    className={cn(
                      "px-2 py-0.5 transition-colors border-l border-border",
                      rawMode
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Raw JSON
                  </button>
                </div>
              </div>

              {rawMode ? (
                <div className="space-y-1">
                  <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    className="w-full min-h-[120px] rounded-md border border-border bg-muted/50 p-3 font-mono text-xs resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                    spellCheck={false}
                  />
                  {!rawJsonValid && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <XCircle className="size-3" />
                      Invalid JSON
                    </p>
                  )}
                </div>
              ) : (
                <KeyValueEditor rows={rows} onChange={setRows} />
              )}
            </div>

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
                    <Info className="size-3 text-muted-foreground/50 ml-0.5" />
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
                invoke.isPending || (!rawMode && hasRowErrors) || (rawMode && !rawJsonValid)
              }
            >
              {invoke.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1" />
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
