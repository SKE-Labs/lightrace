-- CreateIndex
CREATE UNIQUE INDEX "checkpoints_trace_id_observation_id_key" ON "checkpoints"("trace_id", "observation_id");
