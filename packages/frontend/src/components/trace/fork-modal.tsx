"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { GitBranch, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  KeyValueEditor,
  inputToRows,
  rowsToInput,
  validateRow,
  pythonReprToJson,
} from "./key-value-editor";

interface ForkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toolName: string;
  originalInput: unknown;
  observationId: string;
  traceId: string;
  projectId: string;
  context?: Record<string, unknown>;
}

export function ForkModal({
  open,
  onOpenChange,
  toolName,
  originalInput,
  observationId,
  traceId,
  projectId,
  context,
}: ForkModalProps) {
  const router = useRouter();

  const healthCheck = trpc.tools.healthCheck.useQuery(
    { projectId, toolName },
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

  type ForkState = "idle" | "creating" | "done" | "error";
  const [forkState, setForkState] = useState<ForkState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    setForkState("idle");
    setErrorMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observationId]);

  const forkMutation = trpc.forks.create.useMutation({
    onMutate: () => {
      setForkState("creating");
      setErrorMessage(null);
    },
    onSuccess: (data) => {
      setForkState("done");
      if (data.invocationResult?.error) {
        setErrorMessage(data.invocationResult.error);
      }
      onOpenChange(false);
      router.push(`/project/${projectId}/traces/compare/${data.forkId}`);
    },
    onError: (err) => {
      setForkState("error");
      setErrorMessage(err.message);
    },
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

  const handleFork = () => {
    try {
      let parsedInput: unknown;
      if (rawMode) {
        parsedInput = JSON.parse(rawText);
      } else {
        parsedInput = rowsToInput(rows);
      }

      forkMutation.mutate({
        projectId,
        sourceTraceId: traceId,
        forkPointObservationId: observationId,
        modifiedInput: parsedInput,
        context,
      });
    } catch (e) {
      setForkState("error");
      setErrorMessage(rawMode ? "Invalid JSON input" : String(e));
    }
  };

  const isPending = forkState === "creating";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col" showCloseButton>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <GitBranch className="size-4" />
            Fork from: {toolName}
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Creates a new trace variant by cloning observations before this point and re-running the
            tool with modified input.
          </p>
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
                Modified Input
              </label>
              <div className="flex rounded-md border border-border text-xs overflow-hidden">
                <button
                  onClick={() => {
                    if (rawMode) {
                      try {
                        const parsed = JSON.parse(rawText);
                        setRows(inputToRows(parsed));
                      } catch {
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

          {/* Status / Error */}
          {forkState === "done" && !errorMessage && (
            <Alert>
              <CheckCircle2 className="size-4 text-success" />
              <AlertTitle>Fork created</AlertTitle>
              <AlertDescription>Navigating to compare view...</AlertDescription>
            </Alert>
          )}

          {errorMessage && (
            <Alert variant="destructive">
              <XCircle className="size-4" />
              <AlertTitle>
                {forkState === "done" ? "Tool invocation error" : "Fork failed"}
              </AlertTitle>
              <AlertDescription className="font-mono text-xs">{errorMessage}</AlertDescription>
            </Alert>
          )}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleFork}
            disabled={isPending || (!rawMode && hasRowErrors) || (rawMode && !rawJsonValid)}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin mr-1" />
                Creating fork...
              </>
            ) : (
              <>
                <GitBranch className="size-4 mr-1" />
                Fork & Run
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
