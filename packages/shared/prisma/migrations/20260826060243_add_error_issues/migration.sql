-- CreateEnum
CREATE TYPE "ErrorStatus" AS ENUM ('UNRESOLVED', 'RESOLVED', 'ARCHIVED', 'ESCALATING', 'REGRESSED', 'FOR_REVIEW');

-- CreateEnum
CREATE TYPE "ErrorPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateTable
CREATE TABLE "error_issues" (
    "id" TEXT NOT NULL,
    "short_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "type" "ObservationType" NOT NULL,
    "tool_name" TEXT,
    "title" TEXT NOT NULL,
    "culprit" TEXT,
    "level" "ObservationLevel" NOT NULL DEFAULT 'ERROR',
    "status" "ErrorStatus" NOT NULL DEFAULT 'UNRESOLVED',
    "priority" "ErrorPriority" NOT NULL DEFAULT 'MEDIUM',
    "count" INTEGER NOT NULL DEFAULT 0,
    "trace_count" INTEGER NOT NULL DEFAULT 0,
    "user_count" INTEGER NOT NULL DEFAULT 0,
    "first_seen" TIMESTAMP(3) NOT NULL,
    "last_seen" TIMESTAMP(3) NOT NULL,
    "first_trace_id" TEXT,
    "last_trace_id" TEXT,
    "first_release" TEXT,
    "last_release" TEXT,
    "assignee_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "error_events" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "observation_id" TEXT NOT NULL,
    "trace_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "error_type" TEXT,
    "error_value" TEXT,
    "stacktrace" TEXT,
    "handled" BOOLEAN,
    "tags" JSONB,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "error_issues_short_id_key" ON "error_issues"("short_id");

-- CreateIndex
CREATE INDEX "error_issues_project_id_status_last_seen_idx" ON "error_issues"("project_id", "status", "last_seen" DESC);

-- CreateIndex
CREATE INDEX "error_issues_project_id_fingerprint_idx" ON "error_issues"("project_id", "fingerprint");

-- CreateIndex
CREATE INDEX "error_issues_project_id_type_last_seen_idx" ON "error_issues"("project_id", "type", "last_seen" DESC);

-- CreateIndex
CREATE INDEX "error_issues_project_id_tool_name_last_seen_idx" ON "error_issues"("project_id", "tool_name", "last_seen" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "error_events_observation_id_key" ON "error_events"("observation_id");

-- CreateIndex
CREATE INDEX "error_events_issue_id_timestamp_idx" ON "error_events"("issue_id", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "error_events_project_id_expires_at_idx" ON "error_events"("project_id", "expires_at");

-- CreateIndex
CREATE INDEX "error_events_project_id_timestamp_idx" ON "error_events"("project_id", "timestamp" DESC);

-- AddForeignKey
ALTER TABLE "error_issues" ADD CONSTRAINT "error_issues_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "error_issues" ADD CONSTRAINT "error_issues_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "error_events" ADD CONSTRAINT "error_events_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "error_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "error_events" ADD CONSTRAINT "error_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "error_events" ADD CONSTRAINT "error_events_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "error_events" ADD CONSTRAINT "error_events_trace_id_fkey" FOREIGN KEY ("trace_id") REFERENCES "traces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
