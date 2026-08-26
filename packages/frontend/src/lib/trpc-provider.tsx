"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, createWSClient, wsLink, splitLink } from "@trpc/client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import superjson from "superjson";
import { trpc } from "./trpc";

const WsReadyContext = createContext(false);
export const useWsReady = () => useContext(WsReadyContext);

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  const [wsReady, setWsReady] = useState(false);
  const wsUrlRef = useRef<string | null>(null);

  // Create tRPC client once — wsLink uses a lazy URL that resolves after auth
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        splitLink({
          condition: (op) => op.type === "subscription",
          true: wsLink({
            transformer: superjson,
            client: createWSClient({
              url() {
                if (wsUrlRef.current) return wsUrlRef.current;
                // Not ready yet — subscription is disabled via enabled: wsReady, so this
                // placeholder is never used to actually connect. Keep it lazy.
                // In prod (Caddy same-port) the real URL will be wss://host/ws,
                // in dev it will be ws://localhost:3003.
                if (typeof window !== "undefined") {
                  const host = window.location.host; // includes :3000 in prod via Caddy
                  const proto = window.location.protocol === "https:" ? "wss" : "ws";
                  // Heuristic: if window.host is :3000 (prod gateway) use /ws, else direct
                  if (host.endsWith(":3000") || host === window.location.hostname) {
                    // Use same-port ws path in prod; dev will be overwritten by ws-auth quickly
                    return `${proto}://${host}/ws`;
                  }
                }
                return "ws://localhost:3003";
              },
              lazy: { enabled: true, closeMs: 0 },
              retryDelayMs: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
              onOpen() {
                console.log("[trpc] WS connected");
              },
              onClose(cause) {
                if (cause?.code !== 1000) console.warn("[trpc] WS closed", cause);
              },
            }),
          }),
          false: httpBatchLink({
            url: "/api/trpc",
            transformer: superjson,
          }),
        }),
      ],
    }),
  );

  useEffect(() => {
    let cancelled = false;

    async function initWs() {
      try {
        const res = await fetch("/api/ws-auth", { credentials: "include" });
        if (cancelled) return;
        if (!res.ok) {
          if (res.status === 401) console.warn("[trpc] ws-auth 401 — not logged in");
          else console.warn("[trpc] ws-auth failed", res.status);
          return;
        }
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
          console.warn("[trpc] ws-auth non-JSON (likely redirect to /login)", ct);
          return;
        }
        const body = await res.json();
        if (cancelled) return;
        if (!body.response?.wsUrl) {
          console.warn("[trpc] ws-auth missing wsUrl", body);
          return;
        }
        wsUrlRef.current = body.response.wsUrl;
        setWsReady(true);
      } catch {
        console.warn("[trpc] WebSocket unavailable, real-time updates disabled");
      }
    }

    initWs();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <WsReadyContext.Provider value={wsReady}>{children}</WsReadyContext.Provider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
