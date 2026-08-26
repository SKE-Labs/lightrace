"use client";

import { useRef } from "react";
import { trpc } from "./trpc";
import { useWsReady } from "./trpc-provider";
import { REALTIME_THROTTLE_MS, REALTIME_DETAIL_THROTTLE_MS } from "./constants";

/**
 * Subscribe to real-time trace updates for a project.
 * Invalidates the relevant tRPC queries when updates arrive.
 */
export function useRealtimeTraceUpdates(projectId: string) {
  const utils = trpc.useUtils();
  const lastInvalidation = useRef(0);
  const wsReady = useWsReady();

  trpc.realtime.onTraceUpdate.useSubscription(
    { projectId },
    {
      enabled: wsReady && !!projectId,
      onData: () => {
        const now = Date.now();
        if (now - lastInvalidation.current < REALTIME_THROTTLE_MS) return;
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
 * Filters before throttling so unrelated traces don't suppress streaming updates.
 */
export function useRealtimeTraceDetail(projectId: string, traceId: string) {
  const utils = trpc.useUtils();
  const lastInvalidation = useRef(0);
  const wsReady = useWsReady();

  trpc.realtime.onTraceUpdate.useSubscription(
    { projectId },
    {
      enabled: wsReady && !!projectId && !!traceId,
      onData: (event) => {
        if (event.traceId !== traceId) return;

        const now = Date.now();
        if (now - lastInvalidation.current < REALTIME_DETAIL_THROTTLE_MS) return;
        lastInvalidation.current = now;

        // Invalidate the specific trace; include projectId to match query key
        // Fallback to no-args invalidate if strict key matching fails
        const anyUtils = utils as unknown as {
          traces: { byId: { invalidate: (args?: unknown) => void } };
        };
        try {
          anyUtils.traces.byId.invalidate({ projectId, id: traceId } as never);
        } catch {
          utils.traces.byId.invalidate();
        }
      },
      onError: (err) => {
        console.warn("[realtime] Subscription error:", err.message);
      },
    },
  );
}
