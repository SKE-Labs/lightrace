-- AlterTable
ALTER TABLE "traces" ADD COLUMN     "latency_ms" INTEGER,
ADD COLUMN     "level" "ObservationLevel" NOT NULL DEFAULT 'DEFAULT',
ADD COLUMN     "observation_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "primary_model" TEXT,
ADD COLUMN     "total_cost" DOUBLE PRECISION,
ADD COLUMN     "total_tokens" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "observations_trace_id_type_idx" ON "observations"("trace_id", "type");

-- CreateIndex
CREATE INDEX "observations_trace_id_level_idx" ON "observations"("trace_id", "level");

-- CreateIndex
CREATE INDEX "traces_project_id_level_timestamp_idx" ON "traces"("project_id", "level", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "traces_project_id_user_id_idx" ON "traces"("project_id", "user_id");
