"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const createMutation = trpc.projects.create.useMutation({
    onSuccess: (project) => {
      router.push(`/project/${project.id}/traces`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-lg mx-auto">
          <div className="space-y-2 mb-8">
            <h2 className="text-base font-medium">Create a new project</h2>
            <p className="text-sm text-muted-foreground">
              Each project has its own API keys, traces, and team members.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-sm text-muted-foreground">Project name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Project"
                required
                autoFocus
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground">
                Description <span className="text-muted-foreground/60">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this project for?"
                rows={3}
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm resize-none"
              />
            </div>

            {createMutation.error && (
              <p className="text-sm text-destructive">{createMutation.error.message}</p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => router.push("/projects")}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create project"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
