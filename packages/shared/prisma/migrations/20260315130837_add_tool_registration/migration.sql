-- CreateTable
CREATE TABLE "tool_registrations" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "sdk_instance_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "input_schema" JSONB,
    "status" TEXT NOT NULL DEFAULT 'online',
    "last_heartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tool_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tool_registrations_project_id_status_idx" ON "tool_registrations"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tool_registrations_project_id_sdk_instance_id_tool_name_key" ON "tool_registrations"("project_id", "sdk_instance_id", "tool_name");

-- AddForeignKey
ALTER TABLE "tool_registrations" ADD CONSTRAINT "tool_registrations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
