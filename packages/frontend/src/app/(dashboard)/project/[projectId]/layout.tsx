"use client";

import { useEffect, useMemo } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useProjectStore } from "@/lib/project-store";
import { TopNav } from "@/components/layout/top-nav";
import { Sidebar } from "@/components/layout/sidebar";

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const projectId = params.projectId;
  const setProject = useProjectStore((s) => s.setProject);
  const clear = useProjectStore((s) => s.clear);

  const { data: project, isLoading, error } = trpc.projects.byId.useQuery({ projectId });

  // Derive breadcrumbs from pathname (must be before early returns)
  const breadcrumbs = useMemo(() => {
    const prefix = `/project/${projectId}`;
    const rest = pathname.slice(prefix.length);
    const segments = rest.split("/").filter(Boolean);

    const pageLabels: Record<string, string> = {
      traces: "Traces",
      tools: "Tools",
      settings: "Settings",
    };

    const crumbs: { label: string; href?: string }[] = [];

    if (segments[0] && pageLabels[segments[0]]) {
      if (segments.length > 1) {
        crumbs.push({
          label: pageLabels[segments[0]],
          href: `${prefix}/${segments[0]}`,
        });
        crumbs.push({ label: segments[1].slice(0, 12) });
      } else {
        crumbs.push({ label: pageLabels[segments[0]] });
      }
    }

    return crumbs;
  }, [pathname, projectId]);

  // Redirect to login on UNAUTHORIZED
  useEffect(() => {
    if (error?.data?.code === "UNAUTHORIZED") {
      router.push("/login");
    }
  }, [error, router]);

  // Sync project data to Zustand store
  useEffect(() => {
    if (project) {
      setProject({
        projectId,
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          createdAt: project.createdAt,
        },
        role: project.role,
      });
    }
  }, [project, projectId, setProject]);

  // Clear store on unmount
  useEffect(() => {
    return () => clear();
  }, [clear]);

  if (isLoading || (!project && !error)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading project...</p>
      </div>
    );
  }

  if (error) {
    if (error.data?.code === "UNAUTHORIZED") {
      return null;
    }
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-sm text-destructive">
            {error.message === "Not a member of this project"
              ? "You don't have access to this project."
              : "Project not found."}
          </p>
          <a href="/projects" className="text-sm text-muted-foreground hover:text-foreground">
            Back to projects
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopNav projectId={projectId} breadcrumbs={breadcrumbs} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar projectId={projectId} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
