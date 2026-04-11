import { observable } from "@trpc/server/observable";
import { router, projectProcedure } from "../context";
import { realtimeEmitter, type TraceUpdateEvent } from "../../realtime/pubsub";

export const realtimeRouter = router({
  onTraceUpdate: projectProcedure.subscription(({ ctx }) => {
    return observable<TraceUpdateEvent>((emit) => {
      const handler = (event: TraceUpdateEvent) => {
        emit.next(event);
      };

      realtimeEmitter.on(`project:${ctx.projectId}`, handler);

      return () => {
        realtimeEmitter.off(`project:${ctx.projectId}`, handler);
      };
    });
  }),
});
