"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, LayoutGrid, List, Users, ListTree } from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleBadge } from "@/lib/role-config";

export default function ProjectsPage() {
  const router = useRouter();
  const { data: projects, isLoading } = trpc.projects.list.useQuery();
  const [view, setView] = useState<"grid" | "list">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("lr-projects-view") as "grid" | "list") ?? "grid";
    }
    return "grid";
  });

  const setViewMode = (mode: "grid" | "list") => {
    setView(mode);
    localStorage.setItem("lr-projects-view", mode);
  };

  const filtered = projects ?? [];

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3">
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "flex items-center justify-center size-7 rounded-md transition-colors duration-150",
              view === "grid"
                ? "bg-foreground/[0.07] text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]",
            )}
            title="Grid view"
          >
            <LayoutGrid className="size-3.5" strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "flex items-center justify-center size-7 rounded-md transition-colors duration-150",
              view === "list"
                ? "bg-foreground/[0.07] text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]",
            )}
            title="List view"
          >
            <List className="size-3.5" strokeWidth={1.5} />
          </button>
          <Button size="sm" className="gap-1.5 ml-2" onClick={() => router.push("/projects/new")}>
            <Plus className="size-3.5" strokeWidth={1.5} />
            New project
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 pt-0">
        <div className="mx-auto max-w-6xl">
          {isLoading && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-[100px] rounded-lg bg-foreground/[0.04] animate-pulse border border-border"
                />
              ))}
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <ListTree className="size-10 mb-3 opacity-50" strokeWidth={1.5} />
              <p className="text-sm font-medium">No projects yet</p>
              <p className="text-xs mt-1">Create your first project to start tracing.</p>
              <Button
                size="sm"
                className="mt-4 gap-1.5"
                onClick={() => router.push("/projects/new")}
              >
                <Plus className="size-3.5" strokeWidth={1.5} />
                New project
              </Button>
            </div>
          )}

          {/* Grid View */}
          {!isLoading && filtered.length > 0 && view === "grid" && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
              {filtered.map((project) => (
                <Link
                  key={project.id}
                  href={`/project/${project.id}/traces`}
                  className="group flex flex-col rounded-lg bg-card border border-border p-4 hover:border-foreground/20 transition-colors duration-150"
                >
                  <div className="text-sm font-medium text-foreground mb-1 truncate">
                    {project.name}
                  </div>
                  {project.description && (
                    <div className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
                      {project.description}
                    </div>
                  )}
                  <div className="mt-auto flex items-center gap-3 text-[11px] text-muted-foreground pt-2">
                    <span className="flex items-center gap-1">
                      <Users className="size-3" strokeWidth={1.5} />
                      {project.memberCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <ListTree className="size-3" strokeWidth={1.5} />
                      {project.traceCount}
                    </span>
                    <span className="ml-auto">
                      <RoleBadge role={project.role} />
                    </span>
                  </div>
                </Link>
              ))}

              {/* New project dashed slot */}
              <Link
                href="/projects/new"
                className="group flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-foreground/[0.02] p-4 min-h-[100px] hover:bg-foreground/[0.05] hover:border-foreground/20 transition-colors duration-150"
              >
                <Plus
                  className="size-5 text-muted-foreground group-hover:text-foreground transition-colors"
                  strokeWidth={1.5}
                />
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                  New project
                </span>
              </Link>
            </div>
          )}

          {/* List View */}
          {!isLoading && filtered.length > 0 && view === "list" && (
            <div className="rounded-md border border-border overflow-hidden">
              <Table density="tight">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Project</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Traces</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((project) => (
                    <TableRow
                      key={project.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/project/${project.id}/traces`)}
                    >
                      <TableCell>
                        <div>
                          <span className="font-medium text-foreground">{project.name}</span>
                          {project.description && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                              {project.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{project.memberCount}</TableCell>
                      <TableCell className="text-muted-foreground">{project.traceCount}</TableCell>
                      <TableCell>
                        <RoleBadge role={project.role} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(project.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
