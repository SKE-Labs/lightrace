"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JsonViewer } from "./JsonViewer";
import { Play, Loader2, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolRerunModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toolName: string;
  originalInput: unknown;
  originalOutput: unknown;
  observationId?: string;
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
  context,
}: ToolRerunModalProps) {
  const [inputText, setInputText] = useState(JSON.stringify(originalInput, null, 2) ?? "{}");
  const [contextText, setContextText] = useState(context ? JSON.stringify(context, null, 2) : "{}");
  const hasContext = context != null && Object.keys(context).length > 0;
  const [contextOpen, setContextOpen] = useState(hasContext);
  interface InvokeResult {
    output: unknown;
    error?: string;
    durationMs: number;
  }
  const [result, setResult] = useState<InvokeResult | null>(null);

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
      const parsedInput = JSON.parse(inputText);
      let state: Record<string, unknown> | undefined;

      // Pack context into state.__lightrace_context for SDK restore
      if (contextText && contextText !== "{}") {
        try {
          const parsedContext = JSON.parse(contextText);
          state = { __lightrace_context: parsedContext };
        } catch {
          setResult({ output: null, error: "Invalid JSON in context", durationMs: 0 });
          return;
        }
      }

      setResult(null);
      invoke.mutate({
        toolName,
        input: parsedInput,
        state,
        observationId,
      });
    } catch {
      setResult({ output: null, error: "Invalid JSON input", durationMs: 0 });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="size-4" />
            Re-run: {toolName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Input editor */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Input
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full min-h-[120px] rounded-md border border-border bg-muted/50 p-3 font-mono text-sm resize-y focus:outline-none focus:ring-1 focus:ring-ring"
              spellCheck={false}
            />
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
                <Badge variant="outline" className="text-[10px] ml-1">
                  captured
                </Badge>
              )}
            </button>
            {contextOpen && (
              <textarea
                value={contextText}
                onChange={(e) => setContextText(e.target.value)}
                className="w-full min-h-[100px] rounded-md border border-border bg-muted/50 p-3 font-mono text-sm resize-y focus:outline-none focus:ring-1 focus:ring-ring"
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
                  <Badge className="text-xs gap-1 bg-green-500/15 text-green-800 dark:text-green-400 border-green-500/30">
                    <CheckCircle2 className="size-3" />
                    Success
                  </Badge>
                )}
                {result.durationMs > 0 && (
                  <Badge variant="outline" className="text-xs font-mono">
                    {result.durationMs}ms
                  </Badge>
                )}
              </div>
              <div className="rounded-md border border-border bg-muted/50 p-3">
                {result.error ? (
                  <p className="text-sm text-destructive font-mono">{result.error}</p>
                ) : (
                  <JsonViewer data={result.output} />
                )}
              </div>
            </div>
          )}

          {/* Original output for comparison */}
          {result !== null &&
            !result.error &&
            originalOutput !== null &&
            originalOutput !== undefined && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Original Output (for comparison)
                </label>
                <div className="rounded-md border border-border bg-muted/50 p-3 opacity-60">
                  <JsonViewer data={originalOutput} />
                </div>
              </div>
            )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleRun} disabled={invoke.isPending}>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
