import { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

/** Recompute denormalized aggregates on a trace from its observations. */
export async function updateTraceAggregates(tx: TxClient, traceId: string) {
  await tx.$queryRaw`
    UPDATE traces SET
      total_tokens = COALESCE((SELECT SUM(total_tokens) FROM observations WHERE trace_id = ${traceId}), 0),
      total_cost = (SELECT SUM(total_cost) FROM observations WHERE trace_id = ${traceId}),
      latency_ms = (
        SELECT (EXTRACT(EPOCH FROM (MAX(COALESCE(end_time, start_time)) - MIN(start_time))) * 1000)::int
        FROM observations WHERE trace_id = ${traceId}
      ),
      observation_count = (SELECT COUNT(*)::int FROM observations WHERE trace_id = ${traceId}),
      primary_model = (SELECT model FROM observations WHERE trace_id = ${traceId} AND type = 'GENERATION' AND model IS NOT NULL LIMIT 1),
      level = COALESCE(
        (SELECT CASE
          WHEN EXISTS (SELECT 1 FROM observations WHERE trace_id = ${traceId} AND level = 'ERROR') THEN 'ERROR'::"ObservationLevel"
          WHEN EXISTS (SELECT 1 FROM observations WHERE trace_id = ${traceId} AND level = 'WARNING') THEN 'WARNING'::"ObservationLevel"
          ELSE 'DEFAULT'::"ObservationLevel"
        END),
        'DEFAULT'::"ObservationLevel"
      ),
      updated_at = NOW()
    WHERE id = ${traceId}
  `;
}
