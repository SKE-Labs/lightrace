import { z } from "zod";
import { observable } from "@trpc/server/observable";
import { router, publicProcedure } from "../context";
import { realtimeEmitter, type TraceUpdateEvent } from "../../realtime/pubsub";

export const realtimeRouter = router({
  onTraceUpdate: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
      }),
    )
    .subscription(({ input }) => {
      return observable<TraceUpdateEvent>((emit) => {
        const handler = (event: TraceUpdateEvent) => {
          emit.next(event);
        };

        realtimeEmitter.on(`project:${input.projectId}`, handler);

        return () => {
          realtimeEmitter.off(`project:${input.projectId}`, handler);
        };
      });
    }),
});
