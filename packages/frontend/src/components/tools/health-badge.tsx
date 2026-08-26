"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export function HealthBadge({ status }: { status?: { status: string; message?: string } }) {
  if (!status) {
    return (
      <Badge variant="outline" className="text-xs text-muted-foreground">
        checking...
      </Badge>
    );
  }
  switch (status.status) {
    case "healthy":
      return (
        <Badge className="text-xs gap-1 bg-success/15 text-success border-success/30">
          <span className="size-1.5 rounded-full bg-success" />
          Connected
        </Badge>
      );
    case "unhealthy":
    case "unreachable":
      return (
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="destructive" className="text-xs gap-1">
              <span className="size-1.5 rounded-full bg-destructive" />
              Offline
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">{status.message ?? "Dev server unreachable"}</p>
          </TooltipContent>
        </Tooltip>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
          <span className="size-1.5 rounded-full bg-muted-foreground" />
          No server
        </Badge>
      );
  }
}
