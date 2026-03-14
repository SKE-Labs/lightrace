"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, splitLink, wsLink, createWSClient } from "@trpc/client";
import { useState, useEffect, useRef } from "react";
import superjson from "superjson";
import { trpc } from "./trpc";

function useWsClient() {
  const wsClientRef = useRef<ReturnType<typeof createWSClient> | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initWs() {
      try {
        const res = await fetch("/api/ws-auth");
        if (!res.ok) return;
        const { wsUrl } = await res.json();
        if (cancelled) return;

        wsClientRef.current = createWSClient({ url: wsUrl });
        setReady(true);
      } catch {
        // WS auth failed — subscriptions will not work, queries still function via HTTP
        console.warn("[trpc] WebSocket auth failed, real-time updates disabled");
      }
    }

    initWs();

    return () => {
      cancelled = true;
      if (wsClientRef.current) {
        wsClientRef.current.close();
      }
    };
  }, []);

  return { wsClient: wsClientRef.current, ready };
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const { wsClient } = useWsClient();

  const [trpcClient, setTrpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
        }),
      ],
    }),
  );

  // Upgrade to split link once WS client is ready
  useEffect(() => {
    if (!wsClient) return;

    setTrpcClient(
      trpc.createClient({
        links: [
          splitLink({
            condition: (op) => op.type === "subscription",
            true: wsLink({
              transformer: superjson,
              client: wsClient,
            }),
            false: httpBatchLink({
              url: "/api/trpc",
              transformer: superjson,
            }),
          }),
        ],
      }),
    );
  }, [wsClient]);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
