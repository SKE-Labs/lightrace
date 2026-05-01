"use client";

import { createTRPCReact } from "@trpc/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { type AppRouter } from "@lightrace/backend";

export const trpc = createTRPCReact<AppRouter>();

export type RouterOutputs = inferRouterOutputs<AppRouter>;
