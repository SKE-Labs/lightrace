-- AlterTable
ALTER TABLE "observations" ADD COLUMN     "checkpoint_id" TEXT,
ADD COLUMN     "tool_call_id" TEXT;

-- AlterTable
ALTER TABLE "tool_registrations" ADD COLUMN     "capabilities" JSONB;
