"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { ListTree, Settings, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const navItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/traces", label: "Traces", icon: ListTree },
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-border bg-card">
      <Link
        href="/traces"
        className="flex h-14 items-center gap-2 px-4 hover:opacity-80 transition-opacity"
      >
        {/* Show white logo in dark mode, primary in light mode — pure CSS, no hydration flash */}
        <img src="/lr_primary.svg" alt="LightRace" className="h-7 w-auto dark:hidden" />
        <img src="/lr_white.svg" alt="LightRace" className="h-7 w-auto hidden dark:block" />
      </Link>
      <nav className="flex-1 space-y-1 px-2 py-3">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                isActive
                  ? "bg-accent/15 text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/10 hover:text-accent-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Demo Project</p>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
