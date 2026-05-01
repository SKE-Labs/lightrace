"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SECTION_LABEL } from "@/lib/utils";

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
        <div className="max-w-md mx-auto">
          <div className="space-y-1.5 mb-8">
            <h2 className="text-lg font-semibold leading-tight tracking-tight">
              Create a new project
            </h2>
            <p className="text-sm text-muted-foreground">
              Each project has its own API keys, traces, and team members.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className={SECTION_LABEL}>Project name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Project"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className={SECTION_LABEL}>
                Description <span className="opacity-70">(optional)</span>
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this project for?"
                rows={3}
              />
            </div>

            {createMutation.error && (
              <p className="text-xs text-error">{createMutation.error.message}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => router.push("/projects")}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || createMutation.isPending}>
                {createMutation.isPending ? "Creating…" : "Create project"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
