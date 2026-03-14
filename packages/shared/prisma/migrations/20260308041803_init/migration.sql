-- CreateEnum
CREATE TYPE "ObservationType" AS ENUM ('SPAN', 'GENERATION', 'EVENT');

-- CreateEnum
CREATE TYPE "ObservationLevel" AS ENUM ('DEBUG', 'DEFAULT', 'WARNING', 'ERROR');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "hashed_secret_key" TEXT NOT NULL,
    "display_secret_key" TEXT NOT NULL,
    "note" TEXT,
    "project_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traces" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT,
    "input" JSONB,
    "output" JSONB,
    "metadata" JSONB,
    "session_id" TEXT,
    "user_id" TEXT,
    "release" TEXT,
    "version" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observations" (
    "id" TEXT NOT NULL,
    "trace_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" "ObservationType" NOT NULL,
    "name" TEXT,
    "start_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_time" TIMESTAMP(3),
    "completion_start_time" TIMESTAMP(3),
    "input" JSONB,
    "output" JSONB,
    "metadata" JSONB,
    "model" TEXT,
    "model_parameters" JSONB,
    "parent_observation_id" TEXT,
    "level" "ObservationLevel" NOT NULL DEFAULT 'DEFAULT',
    "status_message" TEXT,
    "version" TEXT,
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "completion_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "input_cost" DOUBLE PRECISION,
    "output_cost" DOUBLE PRECISION,
    "total_cost" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scores" (
    "id" TEXT NOT NULL,
    "trace_id" TEXT NOT NULL,
    "observation_id" TEXT,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'API',
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_public_key_key" ON "api_keys"("public_key");

-- CreateIndex
CREATE INDEX "api_keys_public_key_idx" ON "api_keys"("public_key");

-- CreateIndex
CREATE INDEX "traces_project_id_timestamp_idx" ON "traces"("project_id", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "traces_session_id_idx" ON "traces"("session_id");

-- CreateIndex
CREATE INDEX "traces_name_idx" ON "traces"("name");

-- CreateIndex
CREATE INDEX "observations_trace_id_idx" ON "observations"("trace_id");

-- CreateIndex
CREATE INDEX "observations_project_id_start_time_idx" ON "observations"("project_id", "start_time" DESC);

-- CreateIndex
CREATE INDEX "observations_parent_observation_id_idx" ON "observations"("parent_observation_id");

-- CreateIndex
CREATE INDEX "scores_trace_id_idx" ON "scores"("trace_id");

-- CreateIndex
CREATE INDEX "scores_observation_id_idx" ON "scores"("observation_id");

-- CreateIndex
CREATE INDEX "scores_project_id_name_idx" ON "scores"("project_id", "name");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traces" ADD CONSTRAINT "traces_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_trace_id_fkey" FOREIGN KEY ("trace_id") REFERENCES "traces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scores" ADD CONSTRAINT "scores_trace_id_fkey" FOREIGN KEY ("trace_id") REFERENCES "traces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scores" ADD CONSTRAINT "scores_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "observations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scores" ADD CONSTRAINT "scores_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
