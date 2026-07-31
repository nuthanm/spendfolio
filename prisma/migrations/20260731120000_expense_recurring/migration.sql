-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "recurring" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Expense_userId_recurring_idx" ON "Expense"("userId", "recurring");
