-- DropTable
DROP TABLE IF EXISTS "checkpoints";

-- AlterTable
ALTER TABLE "observations" DROP COLUMN IF EXISTS "checkpoint_id";
