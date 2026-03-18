"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { FormattedView } from "./formatted-view";
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Info,
  Copy,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Key-Value Editor Types ---

type ParamType = "string" | "number" | "boolean" | "json";

interface ParamRow {
  key: string;
  value: string;
  type: ParamType;
}

function detectType(value: unknown): ParamType {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "object" && value !== null) return "json";
  return "string";
}

function inputToRows(input: unknown): ParamRow[] {
  if (input == null) return [];
  if (typeof input === "object" && !Array.isArray(input)) {
    const obj = input as Record<string, unknown>;
    const entries = Object.entries(obj);
    if (entries.length === 0) return [];
    return entries.map(([key, value]) => {
      const type = detectType(value);
      const strValue =
        type === "json"
          ? JSON.stringify(value, null, 2)
          : type === "boolean"
            ? String(value)
            : String(value ?? "");
      return { key, value: strValue, type };
    });
  }
  // Non-object input: single row
  return [{ key: "", value: JSON.stringify(input, null, 2) ?? "", type: "json" as ParamType }];
}

function rowsToInput(rows: ParamRow[]): unknown {
  if (rows.length === 0) return {};
  if (rows.length === 1 && rows[0].key === "" && rows[0].value.trim()) {
    return JSON.parse(rows[0].value);
  }
  const obj: Record<string, unknown> = {};
  for (const row of rows) {
    if (!row.key) continue;
    switch (row.type) {
      case "number":
        obj[row.key] = Number(row.value);
        break;
      case "boolean":
        obj[row.key] = row.value === "true";
        break;
      case "json":
        obj[row.key] = JSON.parse(row.value);
        break;
      default:
        obj[row.key] = row.value;
    }
  }
  return obj;
}

function validateRow(row: ParamRow): string | null {
  if (row.type === "number" && isNaN(Number(row.value))) return "Invalid number";
  if (row.type === "json") {
    try {
      JSON.parse(row.value);
    } catch {
      return "Invalid JSON";
    }
  }
  return null;
}

// --- Key-Value Editor Component ---

function KeyValueEditor({
  rows,
  onChange,
}: {
  rows: ParamRow[];
  onChange: (rows: ParamRow[]) => void;
}) {
  const updateRow = (index: number, patch: Partial<ParamRow>) => {
    const next = [...rows];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const removeRow = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  const addRow = () => {
    onChange([...rows, { key: "", value: "", type: "string" }]);
  };

  return (
    <div className="space-y-1.5">
      {rows.length > 0 && (
        <div className="rounded-md border border-border overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_1.5fr_80px_32px] gap-0 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div className="px-2.5 py-1.5">Key</div>
            <div className="px-2.5 py-1.5 border-l border-border">Value</div>
            <div className="px-2.5 py-1.5 border-l border-border">Type</div>
            <div className="px-2.5 py-1.5 border-l border-border" />
          </div>
          {/* Rows */}
          {rows.map((row, i) => {
            const error = validateRow(row);
            return (
              <div
                key={i}
                className={cn(
                  "grid grid-cols-[1fr_1.5fr_80px_32px] gap-0 border-b border-border last:border-0",
                  error && "bg-destructive/5",
                )}
              >
                <div className="px-1">
                  <input
                    value={row.key}
                    onChange={(e) => updateRow(i, { key: e.target.value })}
                    className="w-full px-1.5 py-1.5 bg-transparent font-mono text-xs focus:outline-none"
                    placeholder="key"
                    spellCheck={false}
                  />
                </div>
                <div className="border-l border-border px-1">
                  {row.type === "json" ? (
                    <textarea
                      value={row.value}
                      onChange={(e) => updateRow(i, { value: e.target.value })}
                      className="w-full px-1.5 py-1.5 bg-transparent font-mono text-xs focus:outline-none resize-y min-h-[28px]"
                      spellCheck={false}
                      rows={Math.min(row.value.split("\n").length, 4)}
                    />
                  ) : row.type === "boolean" ? (
                    <select
                      value={row.value}
                      onChange={(e) => updateRow(i, { value: e.target.value })}
                      className="w-full px-1.5 py-1.5 bg-transparent text-xs focus:outline-none"
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : (
                    <input
                      value={row.value}
                      onChange={(e) => updateRow(i, { value: e.target.value })}
                      className={cn(
                        "w-full px-1.5 py-1.5 bg-transparent font-mono text-xs focus:outline-none",
                        error && "text-destructive",
                      )}
                      placeholder="value"
                      spellCheck={false}
                    />
                  )}
                </div>
                <div className="border-l border-border px-1">
                  <select
                    value={row.type}
                    onChange={(e) => updateRow(i, { type: e.target.value as ParamType })}
                    className="w-full px-1 py-1.5 bg-transparent text-xs text-muted-foreground focus:outline-none"
                  >
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                    <option value="json">json</option>
                  </select>
                </div>
                <div className="border-l border-border flex items-start justify-center pt-1.5">
                  <button
                    onClick={() => removeRow(i)}
                    className="text-muted-foreground/50 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <button
        onClick={addRow}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus className="size-3" />
        Add parameter
      </button>
    </div>
  );
}

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
  const [rows, setRows] = useState(() => inputToRows(originalInput));
  const [rawMode, setRawMode] = useState(false);
  const [rawText, setRawText] = useState(JSON.stringify(originalInput, null, 2) ?? "{}");
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

      let state: Record<string, unknown> | undefined;
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
        projectId: projectId ?? "",
        toolName,
        input: parsedInput,
        state,
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
    <TooltipProvider>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col" showCloseButton>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Play className="size-4" />
              Re-run: {toolName}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-auto space-y-4 p-4">
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
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
                    <p className="text-sm text-destructive font-mono">{result.error}</p>
                  </div>
                ) : originalOutput !== null && originalOutput !== undefined ? (
                  /* Side-by-side comparison */
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Re-run Result
                      </span>
                      <div className="rounded-md border border-border bg-muted/50 p-3">
                        <FormattedView data={result.output} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Original Output
                      </span>
                      <div className="rounded-md border border-border bg-muted/50 p-3 opacity-70">
                        <FormattedView data={originalOutput} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-border bg-muted/50 p-3">
                    <FormattedView data={result.output} />
                  </div>
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
    </TooltipProvider>
  );
}
