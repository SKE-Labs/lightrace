-- AlterTable
ALTER TABLE "observations" ADD COLUMN     "error_handled" BOOLEAN,
ADD COLUMN     "error_stacktrace" TEXT,
ADD COLUMN     "error_type" TEXT;
