"use client";

import { useEffect, useRef } from "react";
import { trpc } from "./trpc";

/**
 * Subscribe to real-time trace updates for a project.
 * Invalidates the relevant tRPC queries when updates arrive.
 */
export function useRealtimeTraceUpdates(projectId: string) {
  const utils = trpc.useUtils();
  const lastInvalidation = useRef(0);

  trpc.realtime.onTraceUpdate.useSubscription(
    { projectId },
    {
      onData: () => {
        // Debounce invalidations to avoid hammering the server
        const now = Date.now();
        if (now - lastInvalidation.current < 500) return;
        lastInvalidation.current = now;

        utils.traces.list.invalidate();
      },
      onError: (err) => {
        console.warn("[realtime] Subscription error:", err.message);
      },
    },
  );
}

/**
 * Subscribe to real-time updates for a specific trace.
 * Invalidates the trace detail query when the trace is updated.
 */
export function useRealtimeTraceDetail(projectId: string, traceId: string) {
  const utils = trpc.useUtils();
  const lastInvalidation = useRef(0);

  trpc.realtime.onTraceUpdate.useSubscription(
    { projectId },
    {
      onData: (event) => {
        if (event.traceId !== traceId) return;

        const now = Date.now();
        if (now - lastInvalidation.current < 500) return;
        lastInvalidation.current = now;

        utils.traces.byId.invalidate({ id: traceId });
      },
      onError: (err) => {
        console.warn("[realtime] Subscription error:", err.message);
      },
    },
  );
}
