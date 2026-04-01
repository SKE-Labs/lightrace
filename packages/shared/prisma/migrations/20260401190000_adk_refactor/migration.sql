-- Migrate tool_registrations from WebSocket to HTTP dev server architecture

-- Remove old WS-specific columns
ALTER TABLE "tool_registrations" DROP COLUMN IF EXISTS "sdk_instance_id";
ALTER TABLE "tool_registrations" DROP COLUMN IF EXISTS "status";
ALTER TABLE "tool_registrations" DROP COLUMN IF EXISTS "last_heartbeat";

-- Add new columns
ALTER TABLE "tool_registrations" ADD COLUMN "description" TEXT;
ALTER TABLE "tool_registrations" ADD COLUMN "callback_url" TEXT NOT NULL DEFAULT '';

-- Update unique constraint
ALTER TABLE "tool_registrations" DROP CONSTRAINT IF EXISTS "tool_registrations_project_id_sdk_instance_id_tool_name_key";
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tool_registrations_project_id_tool_name_key'
  ) THEN
    -- Delete duplicates before adding unique constraint (keep newest)
    DELETE FROM "tool_registrations" a USING "tool_registrations" b
    WHERE a.created_at < b.created_at AND a.project_id = b.project_id AND a.tool_name = b.tool_name;
    ALTER TABLE "tool_registrations" ADD CONSTRAINT "tool_registrations_project_id_tool_name_key" UNIQUE ("project_id", "tool_name");
  END IF;
END $$;

-- Update indexes
DROP INDEX IF EXISTS "tool_registrations_project_id_status_idx";
CREATE INDEX IF NOT EXISTS "tool_registrations_project_id_idx" ON "tool_registrations"("project_id");

-- Create conversation_messages table
CREATE TABLE "conversation_messages" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversation_messages_project_id_session_id_created_at_idx" ON "conversation_messages"("project_id", "session_id", "created_at");

ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
