"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Plus, ListTree, Box, LogOut, User } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface TopNavProps {
  projectId?: string;
  breadcrumbs?: BreadcrumbItem[];
}

export function TopNav({ projectId, breadcrumbs }: TopNavProps) {
  const router = useRouter();
  const { data: projects } = trpc.projects.list.useQuery(undefined, {
    enabled: !!projectId,
  });
  const currentProject = projects?.find((p) => p.id === projectId);

  return (
    <header className="flex h-12 shrink-0 items-center border-b border-border bg-card px-4">
      {/* Left: Logo + breadcrumb */}
      <div className="flex items-center gap-2">
        <Link href="/projects" className="flex items-center hover:opacity-80 transition-opacity">
          <img src="/lr_primary.svg" alt="LightRace" className="h-6 w-auto dark:hidden" />
          <img src="/lr_white.svg" alt="LightRace" className="h-6 w-auto hidden dark:block" />
        </Link>

        {projectId && (
          <>
            <span className="text-muted-foreground/40 text-lg font-light select-none">/</span>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium hover:bg-accent/10 transition-colors">
                <Box className="size-3.5 text-muted-foreground" />
                <span className="max-w-[200px] truncate">
                  {currentProject?.name ?? "Loading..."}
                </span>
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Projects</DropdownMenuLabel>
                  {projects?.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => router.push(`/project/${p.id}/traces`)}
                      className={cn(p.id === projectId && "bg-accent/50")}
                    >
                      <Box className="size-4" />
                      <span className="truncate">{p.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/projects")}>
                  <ListTree className="size-4" />
                  View all projects
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/projects/new")}>
                  <Plus className="size-4" />
                  New project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}

        {breadcrumbs?.map((crumb, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="text-muted-foreground/40 text-lg font-light select-none">/</span>
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="text-sm font-medium truncate max-w-[200px]">{crumb.label}</span>
            )}
          </span>
        ))}
      </div>

      {/* Right: Theme + User */}
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors">
            <User className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              variant="destructive"
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
