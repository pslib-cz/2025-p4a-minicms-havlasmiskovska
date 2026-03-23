/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `important_event` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `important_event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `important_event` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "important_event" ADD COLUMN     "publishDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "title" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CategoryToImportantEvent" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CategoryToImportantEvent_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_slug_key" ON "category"("slug");

-- CreateIndex
CREATE INDEX "_CategoryToImportantEvent_B_index" ON "_CategoryToImportantEvent"("B");

-- CreateIndex
CREATE UNIQUE INDEX "important_event_slug_key" ON "important_event"("slug");

-- CreateIndex
CREATE INDEX "important_event_publishDate_idx" ON "important_event"("publishDate");

-- AddForeignKey
ALTER TABLE "_CategoryToImportantEvent" ADD CONSTRAINT "_CategoryToImportantEvent_A_fkey" FOREIGN KEY ("A") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToImportantEvent" ADD CONSTRAINT "_CategoryToImportantEvent_B_fkey" FOREIGN KEY ("B") REFERENCES "important_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
