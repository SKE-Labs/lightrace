/*
  Warnings:

  - You are about to drop the `scores` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "scores" DROP CONSTRAINT "scores_observation_id_fkey";

-- DropForeignKey
ALTER TABLE "scores" DROP CONSTRAINT "scores_project_id_fkey";

-- DropForeignKey
ALTER TABLE "scores" DROP CONSTRAINT "scores_trace_id_fkey";

-- DropTable
DROP TABLE "scores";
