"use client";

import { Badge } from "@/components/ui/badge";

export function MetricBadge({
  icon: Icon,
  label,
}: {
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
}) {
  return (
    <Badge variant="outline" className="font-mono gap-1">
      {Icon && <Icon className="size-3" strokeWidth={1.5} />}
      {label}
    </Badge>
  );
}
