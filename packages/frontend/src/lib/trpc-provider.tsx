"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, createWSClient, wsLink, splitLink } from "@trpc/client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import superjson from "superjson";
import { trpc } from "./trpc";

const WsReadyContext = createContext(false);
export const useWsReady = () => useContext(WsReadyContext);

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
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
                // This is called lazily when the first subscription connects.
                // By then, wsUrlRef should be populated.
                return wsUrlRef.current ?? "ws://localhost:3003";
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
        const res = await fetch("/api/ws-auth");
        if (!res.ok || cancelled) return;
        const { wsUrl } = await res.json();
        if (cancelled) return;

        wsUrlRef.current = wsUrl;
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
