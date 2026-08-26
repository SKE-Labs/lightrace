"use client";

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export function DevServerOfflineAlert({ callbackUrl }: { callbackUrl?: string | null }) {
  return (
    <Alert variant="warning">
      <AlertTriangle className="size-4" />
      <AlertTitle>SDK dev server is not reachable</AlertTitle>
      <AlertDescription>
        Make sure your SDK is running.
        {callbackUrl?.includes("127.0.0.1") &&
          " If using Docker, set LIGHTRACE_DEV_SERVER_HOST to your host IP."}
      </AlertDescription>
    </Alert>
  );
}
