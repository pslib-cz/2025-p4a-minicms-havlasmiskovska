CREATE TYPE "EventImpact" AS ENUM ('POSITIVE', 'NEGATIVE');

CREATE TABLE "important_event" (
    "id" TEXT NOT NULL,
    "userProfilePK" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "tags" TEXT[] NOT NULL,
    "expectedEffect" "EventImpact" NOT NULL,
    "descriptionHtml" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "important_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "important_event_userProfilePK_startDate_endDate_idx"
ON "important_event"("userProfilePK", "startDate", "endDate");

ALTER TABLE "important_event"
ADD CONSTRAINT "important_event_userProfilePK_fkey"
FOREIGN KEY ("userProfilePK") REFERENCES "User"("userProfilePK") ON DELETE CASCADE ON UPDATE CASCADE;
