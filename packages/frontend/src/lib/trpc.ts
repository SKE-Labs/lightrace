"use client";

import { createTRPCReact } from "@trpc/react-query";
import { type AppRouter } from "@lightrace/backend";

export const trpc = createTRPCReact<AppRouter>();
