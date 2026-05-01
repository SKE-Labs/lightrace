import { Badge } from "@/components/ui/badge";
import { Crown, Shield, User, Eye } from "lucide-react";

export const roleConfig = {
  OWNER: {
    icon: Crown,
    label: "Owner",
    color: "bg-primary/15 text-primary border-primary/30",
  },
  ADMIN: {
    icon: Shield,
    label: "Admin",
    color: "bg-info/15 text-info border-info/30",
  },
  MEMBER: { icon: User, label: "Member", color: "bg-muted text-muted-foreground" },
  VIEWER: { icon: Eye, label: "Viewer", color: "bg-muted text-muted-foreground" },
} as const;

export function RoleBadge({ role }: { role: string }) {
  const config = roleConfig[role as keyof typeof roleConfig] ?? roleConfig.MEMBER;
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`text-xs gap-1 ${config.color}`}>
      <Icon className="size-3" strokeWidth={1.5} />
      {config.label}
    </Badge>
  );
}

export function isAdmin(role: string | null) {
  return role === "OWNER" || role === "ADMIN";
}
