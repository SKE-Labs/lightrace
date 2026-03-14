import { z } from "zod";

const datetimeSchema = z.string().datetime({ offset: true }).or(z.date()).or(z.string());

const traceBody = z.object({
  id: z.string().optional(),
  timestamp: datetimeSchema.optional(),
  name: z.string().nullish(),
  input: z.any().optional(),
  output: z.any().optional(),
  metadata: z.any().optional(),
  sessionId: z.string().nullish(),
  userId: z.string().nullish(),
  release: z.string().nullish(),
  version: z.string().nullish(),
  tags: z.array(z.string()).optional(),
  public: z.boolean().optional(),
});

const usageSchema = z
  .object({
    input: z.number().int().nullish(),
    output: z.number().int().nullish(),
    total: z.number().int().nullish(),
    unit: z.string().nullish(),
    promptTokens: z.number().int().nullish(),
    completionTokens: z.number().int().nullish(),
    totalTokens: z.number().int().nullish(),
    inputCost: z.number().nullish(),
    outputCost: z.number().nullish(),
    totalCost: z.number().nullish(),
  })
  .nullish();

const observationBase = z.object({
  id: z.string(),
  traceId: z.string().nullish(),
  name: z.string().nullish(),
  startTime: datetimeSchema.optional(),
  endTime: datetimeSchema.nullish(),
  metadata: z.any().optional(),
  input: z.any().optional(),
  output: z.any().optional(),
  level: z.enum(["DEBUG", "DEFAULT", "WARNING", "ERROR"]).optional(),
  statusMessage: z.string().nullish(),
  parentObservationId: z.string().nullish(),
  version: z.string().nullish(),
});

const generationFields = z.object({
  completionStartTime: datetimeSchema.nullish(),
  model: z.string().nullish(),
  modelParameters: z.record(z.any()).nullish(),
  usage: usageSchema,
  promptName: z.string().nullish(),
  promptVersion: z.number().int().nullish(),
});

const createSpanBody = observationBase;
const updateSpanBody = observationBase.partial().extend({ id: z.string() });

const createGenerationBody = observationBase.merge(generationFields);
const updateGenerationBody = observationBase
  .partial()
  .merge(generationFields.partial())
  .extend({ id: z.string() });

const createEventBody = observationBase;

const scoreBody = z.object({
  id: z.string().optional(),
  traceId: z.string(),
  name: z.string(),
  value: z.number(),
  observationId: z.string().nullish(),
  comment: z.string().nullish(),
  source: z.string().optional(),
  dataType: z.string().optional(),
});

export const ingestionEvent = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("trace-create"),
    timestamp: z.string(),
    body: traceBody,
    metadata: z.any().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("span-create"),
    timestamp: z.string(),
    body: createSpanBody,
    metadata: z.any().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("span-update"),
    timestamp: z.string(),
    body: updateSpanBody,
    metadata: z.any().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("generation-create"),
    timestamp: z.string(),
    body: createGenerationBody,
    metadata: z.any().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("generation-update"),
    timestamp: z.string(),
    body: updateGenerationBody,
    metadata: z.any().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("event-create"),
    timestamp: z.string(),
    body: createEventBody,
    metadata: z.any().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("score-create"),
    timestamp: z.string(),
    body: scoreBody,
    metadata: z.any().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("sdk-log"),
    timestamp: z.string(),
    body: z.any(),
    metadata: z.any().optional(),
  }),
  // Accept but handle gracefully — map to SPAN
  z.object({
    id: z.string(),
    type: z.literal("observation-create"),
    timestamp: z.string(),
    body: observationBase,
    metadata: z.any().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("observation-update"),
    timestamp: z.string(),
    body: observationBase.partial().extend({ id: z.string() }),
    metadata: z.any().optional(),
  }),
]);

export const ingestionBatchSchema = z.object({
  batch: z.array(z.any()),
  metadata: z.any().optional(),
});

export type IngestionEvent = z.infer<typeof ingestionEvent>;

export function normalizeUsage(usage: z.infer<typeof usageSchema>) {
  if (!usage)
    return {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      inputCost: null,
      outputCost: null,
      totalCost: null,
    };

  const promptTokens = usage.promptTokens ?? usage.input ?? 0;
  const completionTokens = usage.completionTokens ?? usage.output ?? 0;
  const totalTokens = usage.totalTokens ?? usage.total ?? promptTokens + completionTokens;

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    inputCost: usage.inputCost ?? null,
    outputCost: usage.outputCost ?? null,
    totalCost: usage.totalCost ?? null,
  };
}
