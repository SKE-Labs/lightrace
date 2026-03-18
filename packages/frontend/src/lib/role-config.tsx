import { Badge } from "@/components/ui/badge";
import { Crown, Shield, User, Eye } from "lucide-react";

export const roleConfig = {
  OWNER: {
    icon: Crown,
    label: "Owner",
    color: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  },
  ADMIN: { icon: Shield, label: "Admin", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  MEMBER: { icon: User, label: "Member", color: "bg-muted text-muted-foreground" },
  VIEWER: { icon: Eye, label: "Viewer", color: "bg-muted text-muted-foreground" },
} as const;

export function RoleBadge({ role }: { role: string }) {
  const config = roleConfig[role as keyof typeof roleConfig] ?? roleConfig.MEMBER;
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`text-xs gap-1 ${config.color}`}>
      <Icon className="size-3" />
      {config.label}
    </Badge>
  );
}

export function isAdmin(role: string | null) {
  return role === "OWNER" || role === "ADMIN";
}
