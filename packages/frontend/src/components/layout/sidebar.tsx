"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { ListTree, Settings, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SidebarProps {
  projectId: string;
}

export function Sidebar({ projectId }: SidebarProps) {
  const pathname = usePathname();

  const navItems: { href: string; label: string; icon: LucideIcon }[] = [
    { href: `/project/${projectId}/traces`, label: "Traces", icon: ListTree },
    { href: `/project/${projectId}/tools`, label: "Tools", icon: Wrench },
    { href: `/project/${projectId}/settings`, label: "Settings", icon: Settings },
  ];

  return (
    <TooltipProvider delay={0}>
      <aside className="flex w-12 shrink-0 flex-col items-center border-r border-border bg-card py-3 gap-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Tooltip key={item.href}>
              <TooltipTrigger
                render={
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center justify-center size-9 rounded-md transition-colors",
                      isActive
                        ? "bg-accent/15 text-foreground"
                        : "text-muted-foreground hover:bg-accent/10 hover:text-foreground",
                    )}
                  />
                }
              >
                <Icon className="size-4" />
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </aside>
    </TooltipProvider>
  );
}
