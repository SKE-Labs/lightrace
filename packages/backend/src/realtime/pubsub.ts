import { redis, createRedisClient } from "@lightrace/shared/redis";
import { EventEmitter } from "events";

export interface TraceUpdateEvent {
  type: "trace-updated";
  projectId: string;
  traceId: string;
  timestamp: number;
}

/**
 * In-process event emitter that bridges Redis Pub/Sub to tRPC subscriptions.
 * One Redis subscriber listens to all `trace:*` channels and emits events locally.
 */
class RealtimeEmitter extends EventEmitter {
  private subscriber: ReturnType<typeof createRedisClient> | null = null;
  private started = false;

  async start() {
    if (this.started) return;
    this.started = true;

    try {
      this.subscriber = createRedisClient();
      await this.subscriber.connect();
      await this.subscriber.psubscribe("trace:*");

      this.subscriber.on("pmessage", (_pattern, _channel, message) => {
        try {
          const event = JSON.parse(message) as TraceUpdateEvent;
          this.emit(`project:${event.projectId}`, event);
        } catch {
          // Ignore parse errors
        }
      });

      console.log("[realtime] Redis Pub/Sub subscriber started");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn("[realtime] Redis subscriber unavailable:", msg);
      this.started = false;
    }
  }

  async stop() {
    if (this.subscriber) {
      try {
        await this.subscriber.punsubscribe("trace:*");
        await this.subscriber.quit();
      } catch {
        // Ignore cleanup errors
      }
      this.subscriber = null;
    }
    this.started = false;
  }
}

export const realtimeEmitter = new RealtimeEmitter();

/**
 * Publish a trace update event to Redis.
 * Called after ingestion processing completes.
 * Silently fails if Redis is unavailable — ingestion still works without real-time.
 */
export async function publishTraceUpdate(projectId: string, traceId: string) {
  const event: TraceUpdateEvent = {
    type: "trace-updated",
    projectId,
    traceId,
    timestamp: Date.now(),
  };

  try {
    await redis.publish(`trace:${projectId}`, JSON.stringify(event));
  } catch {
    // Redis unavailable — real-time updates silently degrade
  }
}
