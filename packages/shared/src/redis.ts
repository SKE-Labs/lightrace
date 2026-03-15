import "dotenv/config";
import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export function createRedisClient(): Redis {
  const client = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 5) return null; // Stop retrying after 5 attempts
      return Math.min(times * 500, 3000);
    },
  });

  // Suppress unhandled error events (connection failures are expected when Redis is down)
  client.on("error", (err) => {
    if (err.message?.includes("ECONNREFUSED")) {
      // Only log once, not on every retry
      if ((client as unknown as Record<string, boolean>).__errorLogged) return;
      (client as unknown as Record<string, boolean>).__errorLogged = true;
      console.warn("[redis] Connection refused — real-time updates disabled");
    } else {
      console.error("[redis] Error:", err.message);
    }
  });

  return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
