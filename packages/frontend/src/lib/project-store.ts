"use client";

import { create } from "zustand";
import type { MemberRole } from "@prisma/client";

interface ProjectState {
  projectId: string | null;
  project: {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
  } | null;
  role: MemberRole | null;
  setProject: (params: {
    projectId: string;
    project: ProjectState["project"];
    role: MemberRole;
  }) => void;
  clear: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projectId: null,
  project: null,
  role: null,
  setProject: ({ projectId, project, role }) => set({ projectId, project, role }),
  clear: () => set({ projectId: null, project: null, role: null }),
}));
