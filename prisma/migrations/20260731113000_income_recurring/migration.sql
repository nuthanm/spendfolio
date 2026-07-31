-- AlterTable
ALTER TABLE "IncomeSource" ADD COLUMN "recurring" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "IncomeSource" ADD COLUMN "monthKey" TEXT;

-- CreateIndex
CREATE INDEX "IncomeSource_userId_monthKey_idx" ON "IncomeSource"("userId", "monthKey");
