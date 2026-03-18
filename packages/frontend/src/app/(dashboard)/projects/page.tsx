"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
              "p-1.5 rounded-md transition-colors",
              view === "grid"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              view === "list"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <List className="size-4" />
          </button>
          <Button size="sm" className="gap-1.5 ml-2" onClick={() => router.push("/projects/new")}>
            <Plus className="size-4" />
            New project
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            {projects?.length === 0 ? (
              <>
                <ListTree className="size-10 mb-3 opacity-50" />
                <p className="text-sm font-medium">No projects yet</p>
                <p className="text-xs mt-1">Create your first project to start tracing.</p>
                <Button
                  size="sm"
                  className="mt-4 gap-1.5"
                  onClick={() => router.push("/projects/new")}
                >
                  <Plus className="size-4" />
                  New project
                </Button>
              </>
            ) : null}
          </div>
        )}

        {/* Grid View */}
        {!isLoading && filtered.length > 0 && view === "grid" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((project) => (
              <Card
                key={project.id}
                className="cursor-pointer hover:ring-foreground/20 transition-all"
                onClick={() => router.push(`/project/${project.id}/traces`)}
              >
                <CardHeader>
                  <CardTitle className="text-base">{project.name}</CardTitle>
                  {project.description && (
                    <CardDescription className="line-clamp-2">
                      {project.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="size-3.5" />
                      {project.memberCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <ListTree className="size-3.5" />
                      {project.traceCount}
                    </span>
                    <span className="ml-auto">
                      <RoleBadge role={project.role} />
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* List View */}
        {!isLoading && filtered.length > 0 && view === "list" && (
          <div className="rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Project</th>
                  <th className="px-4 py-3 text-left font-medium">Members</th>
                  <th className="px-4 py-3 text-left font-medium">Traces</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((project) => (
                  <tr
                    key={project.id}
                    className="border-b border-border/50 hover:bg-accent/30 transition-colors cursor-pointer"
                    onClick={() => router.push(`/project/${project.id}/traces`)}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium">{project.name}</span>
                        {project.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {project.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{project.memberCount}</td>
                    <td className="px-4 py-3 text-muted-foreground">{project.traceCount}</td>
                    <td className="px-4 py-3">
                      <RoleBadge role={project.role} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
