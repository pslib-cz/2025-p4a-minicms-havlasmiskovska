-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "userProfilePK" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "body_battery" (
    "pk_date" DATE NOT NULL,
    "userProfilePK" INTEGER NOT NULL,
    "chargedValue" INTEGER,
    "drainedValue" INTEGER,
    "highest_statTimestamp" TIMESTAMP(3),
    "highest_statsValue" INTEGER,
    "lowest_statTimestamp" TIMESTAMP(3),
    "lowest_statsValue" INTEGER,
    "sleepend_statTimestamp" TIMESTAMP(3),
    "sleepend_statsValue" INTEGER,
    "sleepstart_statTimestamp" TIMESTAMP(3),
    "sleepstart_statsValue" INTEGER,

    CONSTRAINT "body_battery_pkey" PRIMARY KEY ("pk_date","userProfilePK")
);

-- CreateTable
CREATE TABLE "respiration" (
    "pk_date" DATE NOT NULL,
    "userProfilePK" INTEGER NOT NULL,
    "avgWakingRespirationValue" DOUBLE PRECISION,
    "highestRespirationValue" DOUBLE PRECISION,
    "lowestRespirationValue" DOUBLE PRECISION,

    CONSTRAINT "respiration_pkey" PRIMARY KEY ("pk_date","userProfilePK")
);

-- CreateTable
CREATE TABLE "sress" (
    "pk_date" DATE NOT NULL,
    "userProfilePK" INTEGER NOT NULL,
    "awake_averageStressLevel" DOUBLE PRECISION,
    "awake_averageStressLevelIntensity" DOUBLE PRECISION,
    "awake_highDuration" INTEGER,
    "awake_lowDuration" INTEGER,
    "awake_maxStressLevel" INTEGER,
    "awake_mediumDuration" INTEGER,
    "awake_restDuration" INTEGER,
    "awake_stressDuration" INTEGER,
    "awake_stressIntensityCount" INTEGER,
    "awake_totalDuration" INTEGER,
    "awake_totalStressCount" INTEGER,
    "awake_totalStressIntensity" INTEGER,

    CONSTRAINT "sress_pkey" PRIMARY KEY ("pk_date","userProfilePK")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_userProfilePK_key" ON "User"("userProfilePK");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "body_battery_pk_date_idx" ON "body_battery"("pk_date");

-- CreateIndex
CREATE INDEX "respiration_pk_date_idx" ON "respiration"("pk_date");

-- CreateIndex
CREATE INDEX "sress_pk_date_idx" ON "sress"("pk_date");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "body_battery" ADD CONSTRAINT "body_battery_userProfilePK_fkey" FOREIGN KEY ("userProfilePK") REFERENCES "User"("userProfilePK") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respiration" ADD CONSTRAINT "respiration_userProfilePK_fkey" FOREIGN KEY ("userProfilePK") REFERENCES "User"("userProfilePK") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sress" ADD CONSTRAINT "sress_userProfilePK_fkey" FOREIGN KEY ("userProfilePK") REFERENCES "User"("userProfilePK") ON DELETE CASCADE ON UPDATE CASCADE;
