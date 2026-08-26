"use client";

import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CopyButton } from "@/components/ui/copy-button";
import { XCircle } from "lucide-react";

export function ObservationErrorBanner({
  errorType,
  statusMessage,
  errorHandled,
}: {
  errorType?: string | null;
  statusMessage?: string | null;
  errorHandled?: boolean | null;
}) {
  if (!statusMessage && !errorType) return null;
  return (
    <Alert
      variant="destructive"
      className="mx-4 my-2 w-auto max-w-[calc(100%-2rem)] min-w-0 overflow-hidden pr-10"
    >
      <XCircle className="size-4 shrink-0 mt-0.5" strokeWidth={1.5} />
      <AlertDescription className="min-w-0 max-w-full overflow-hidden text-xs font-mono leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-wrap">
        {errorType && <span className="font-semibold">{errorType}: </span>}
        <span className="break-words [overflow-wrap:anywhere] whitespace-pre-wrap">
          {statusMessage || errorType}
        </span>
        {errorHandled !== null && errorHandled !== undefined && (
          <Badge
            variant={errorHandled ? "secondary" : "error"}
            className="ml-1.5 align-middle font-medium text-xs whitespace-nowrap"
          >
            {errorHandled ? "handled" : "unhandled"}
          </Badge>
        )}
      </AlertDescription>
      <CopyButton
        text={statusMessage || errorType || ""}
        className="absolute top-1.5 right-2 shrink-0"
      />
    </Alert>
  );
}

export function ObservationStacktrace({ stacktrace }: { stacktrace?: string | null }) {
  if (!stacktrace) return null;
  return (
    <div className="mx-4 my-2 w-auto max-w-[calc(100%-2rem)] overflow-hidden rounded-md border border-error/30 bg-error/5">
      <div className="flex items-center justify-between px-3 py-2 border-b border-error/20">
        <span className="text-xs font-medium text-error">Stacktrace</span>
        <CopyButton text={stacktrace} />
      </div>
      <div className="max-h-64 overflow-auto bg-card/50">
        <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5 p-3 [overflow-wrap:anywhere] max-w-full">
          {stacktrace}
        </pre>
      </div>
    </div>
  );
}
