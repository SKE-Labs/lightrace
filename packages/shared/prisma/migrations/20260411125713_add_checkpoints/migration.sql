-- CreateTable
CREATE TABLE "checkpoints" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "trace_id" TEXT NOT NULL,
    "observation_id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "step_index" INTEGER NOT NULL,
    "state" JSONB NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "checkpoints_trace_id_step_index_idx" ON "checkpoints"("trace_id", "step_index");

-- CreateIndex
CREATE INDEX "checkpoints_thread_id_step_index_idx" ON "checkpoints"("thread_id", "step_index");

-- AddForeignKey
ALTER TABLE "checkpoints" ADD CONSTRAINT "checkpoints_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkpoints" ADD CONSTRAINT "checkpoints_trace_id_fkey" FOREIGN KEY ("trace_id") REFERENCES "traces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
