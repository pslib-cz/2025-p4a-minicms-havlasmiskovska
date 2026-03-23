-- CreateEnum
CREATE TYPE "EventVisibility" AS ENUM ('PUBLISHED', 'NOT_PUBLIC', 'PRIVATE');

-- AlterTable
ALTER TABLE "important_event" ADD COLUMN     "visibility" "EventVisibility" NOT NULL DEFAULT 'NOT_PUBLIC';

-- CreateIndex
CREATE INDEX "important_event_visibility_idx" ON "important_event"("visibility");
