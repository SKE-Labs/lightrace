/**
 * Langfuse OTel span attribute keys.
 * Must match the Python/JS SDK attribute names exactly.
 *
 * Source: langfuse/packages/shared/src/server/otel/attributes.ts
 */
export enum LangfuseOtelSpanAttributes {
  // Trace attributes
  TRACE_NAME = "langfuse.trace.name",
  TRACE_USER_ID = "user.id",
  TRACE_SESSION_ID = "session.id",
  TRACE_TAGS = "langfuse.trace.tags",
  TRACE_PUBLIC = "langfuse.trace.public",
  TRACE_METADATA = "langfuse.trace.metadata",
  TRACE_INPUT = "langfuse.trace.input",
  TRACE_OUTPUT = "langfuse.trace.output",

  // Observation attributes
  OBSERVATION_TYPE = "langfuse.observation.type",
  OBSERVATION_METADATA = "langfuse.observation.metadata",
  OBSERVATION_LEVEL = "langfuse.observation.level",
  OBSERVATION_STATUS_MESSAGE = "langfuse.observation.status_message",
  OBSERVATION_INPUT = "langfuse.observation.input",
  OBSERVATION_OUTPUT = "langfuse.observation.output",

  // Generation attributes
  OBSERVATION_COMPLETION_START_TIME = "langfuse.observation.completion_start_time",
  OBSERVATION_MODEL = "langfuse.observation.model.name",
  OBSERVATION_MODEL_PARAMETERS = "langfuse.observation.model.parameters",
  OBSERVATION_USAGE_DETAILS = "langfuse.observation.usage_details",
  OBSERVATION_COST_DETAILS = "langfuse.observation.cost_details",

  // General
  RELEASE = "langfuse.release",
  VERSION = "langfuse.version",

  // Internal
  AS_ROOT = "langfuse.internal.as_root",

  // Compat (older SDK docs)
  TRACE_COMPAT_USER_ID = "langfuse.user.id",
  TRACE_COMPAT_SESSION_ID = "langfuse.session.id",
}

export enum LightraceOtelSpanAttributes {
  TRACE_NAME = "lightrace.trace.name",
  TRACE_USER_ID = "lightrace.trace.user_id",
  TRACE_SESSION_ID = "lightrace.trace.session_id",
  TRACE_TAGS = "lightrace.trace.tags",
  TRACE_PUBLIC = "lightrace.trace.public",
  TRACE_METADATA = "lightrace.trace.metadata",
  TRACE_INPUT = "lightrace.trace.input",
  TRACE_OUTPUT = "lightrace.trace.output",

  OBSERVATION_TYPE = "lightrace.observation.type",
  OBSERVATION_METADATA = "lightrace.observation.metadata",
  OBSERVATION_LEVEL = "lightrace.observation.level",
  OBSERVATION_STATUS_MESSAGE = "lightrace.observation.status_message",
  OBSERVATION_INPUT = "lightrace.observation.input",
  OBSERVATION_OUTPUT = "lightrace.observation.output",

  OBSERVATION_COMPLETION_START_TIME = "lightrace.observation.completion_start_time",
  OBSERVATION_MODEL = "lightrace.observation.model",
  OBSERVATION_MODEL_PARAMETERS = "lightrace.observation.model_parameters",
  OBSERVATION_USAGE_DETAILS = "lightrace.observation.usage_details",
  OBSERVATION_COST_DETAILS = "lightrace.observation.cost_details",

  RELEASE = "lightrace.release",
  VERSION = "lightrace.version",
  AS_ROOT = "lightrace.internal.as_root",
}
