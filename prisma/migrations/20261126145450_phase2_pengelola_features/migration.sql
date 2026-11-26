-- AlterTable
ALTER TABLE "PaymentTransaction" ADD COLUMN     "manual" JSONB;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "district" TEXT,
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "needs" TEXT,
ADD COLUMN     "subjects" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "TutorProfile" ADD COLUMN     "district" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "NotificationSetting" (
    "id" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "screenTitle" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "activeNote" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "channel" TEXT NOT NULL,
    "timing" JSONB NOT NULL,
    "template" TEXT NOT NULL,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sample" JSONB NOT NULL,
    "previewNote" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipients" JSONB NOT NULL DEFAULT '[]',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'terkirim',
    "message" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "reasonShort" TEXT,
    "permanent" BOOLEAN NOT NULL DEFAULT false,
    "resentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationSetting_group_idx" ON "NotificationSetting"("group");

-- CreateIndex
CREATE INDEX "NotificationLog_status_sentAt_idx" ON "NotificationLog"("status", "sentAt");

-- CreateIndex
CREATE INDEX "NotificationLog_kind_idx" ON "NotificationLog"("kind");
