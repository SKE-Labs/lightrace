-- AlterTable
ALTER TABLE "traces" ADD COLUMN     "is_fork" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "trace_forks" (
    "id" TEXT NOT NULL,
    "source_trace_id" TEXT NOT NULL,
    "forked_trace_id" TEXT NOT NULL,
    "fork_point_id" TEXT NOT NULL,
    "modified_input" JSONB,
    "observation_id_map" JSONB,
    "project_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trace_forks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trace_forks_forked_trace_id_key" ON "trace_forks"("forked_trace_id");

-- CreateIndex
CREATE INDEX "trace_forks_source_trace_id_idx" ON "trace_forks"("source_trace_id");

-- CreateIndex
CREATE INDEX "trace_forks_project_id_created_at_idx" ON "trace_forks"("project_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "trace_forks" ADD CONSTRAINT "trace_forks_source_trace_id_fkey" FOREIGN KEY ("source_trace_id") REFERENCES "traces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trace_forks" ADD CONSTRAINT "trace_forks_forked_trace_id_fkey" FOREIGN KEY ("forked_trace_id") REFERENCES "traces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trace_forks" ADD CONSTRAINT "trace_forks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
