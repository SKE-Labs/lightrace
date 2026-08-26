import { Badge } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "@/components/ui/badge";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export const priorityVariant: Record<string, BadgeVariant> = {
  HIGH: "error",
  MEDIUM: "warning",
  LOW: "secondary",
};

export const statusVariant: Record<string, BadgeVariant> = {
  UNRESOLVED: "error",
  RESOLVED: "success",
  ARCHIVED: "secondary",
  ESCALATING: "warning",
  REGRESSED: "warning",
  FOR_REVIEW: "outline",
};

export function PriorityBadge({ priority }: { priority: string }) {
  const variant = priorityVariant[priority] ?? "secondary";
  return (
    <Badge variant={variant} className="font-medium">
      {priority}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const variant = statusVariant[status] ?? "outline";
  return (
    <Badge variant={variant} className="font-medium">
      {status}
    </Badge>
  );
}
