"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { GitBranch, CheckCircle2, XCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useToolInputEditor } from "@/lib/use-tool-input-editor";
import { ToolInputEditor } from "./tool-input-editor";
import { DevServerOfflineAlert } from "./dev-server-offline-alert";

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

  const editor = useToolInputEditor(originalInput, observationId);

  type ForkState = "idle" | "creating" | "done" | "error";
  const [forkState, setForkState] = useState<ForkState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset fork-specific state when switching observations (input handled by hook)
  useEffect(() => {
    setForkState("idle");
    setErrorMessage(null);
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

  const handleFork = () => {
    try {
      const parsedInput = editor.getParsedInput();

      forkMutation.mutate({
        projectId,
        sourceTraceId: traceId,
        forkPointObservationId: observationId,
        modifiedInput: parsedInput,
        context,
      });
    } catch (e) {
      setForkState("error");
      setErrorMessage(editor.rawMode ? "Invalid JSON input" : String(e));
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
            label="Modified Input"
          />

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
            disabled={
              isPending ||
              (!editor.rawMode && editor.hasRowErrors) ||
              (editor.rawMode && !editor.rawJsonValid)
            }
          >
            {isPending ? (
              <>
                <Spinner size="sm" className="mr-1" />
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
