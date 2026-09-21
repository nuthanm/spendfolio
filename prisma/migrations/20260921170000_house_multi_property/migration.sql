-- AlterTable
ALTER TABLE "HouseProfile"
ADD COLUMN "propertyType" TEXT NOT NULL DEFAULT 'Apartment',
ADD COLUMN "carpetArea" DOUBLE PRECISION,
ADD COLUMN "builtupArea" DOUBLE PRECISION,
ADD COLUMN "superBuiltupArea" DOUBLE PRECISION,
ADD COLUMN "landArea" DOUBLE PRECISION,
ADD COLUMN "udsPercent" DOUBLE PRECISION,
ADD COLUMN "monthlyBudget" DOUBLE PRECISION,
ADD COLUMN "tdsApplicable" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "HouseExpense"
ADD COLUMN "monthKey" TEXT NOT NULL DEFAULT '',
ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'purchase',
ADD COLUMN "customLabel" TEXT NOT NULL DEFAULT '';

-- Backfill month keys from existing dates
UPDATE "HouseExpense"
SET "monthKey" = substring("date" from 1 for 7)
WHERE "monthKey" = '' AND char_length("date") >= 7;

-- Split old mixed categories into purchase / living / maintenance
UPDATE "HouseExpense"
SET "kind" = 'maintenance'
WHERE "category" = 'Maintenance';

UPDATE "HouseExpense"
SET "kind" = 'living'
WHERE "category" IN ('Maid', 'Household expense', 'House item purchase');

UPDATE "HouseExpense"
SET "category" = 'Raised request'
WHERE "category" = 'Raised request payment';

UPDATE "HouseExpense"
SET "category" = 'Modification'
WHERE "category" = 'Modification amount';

UPDATE "HouseExpense"
SET "category" = 'Registration'
WHERE "category" = 'Registration cost';

UPDATE "HouseExpense"
SET "category" = 'Interior'
WHERE "category" IN ('Interior design cost', 'Interior execution cost');

UPDATE "HouseExpense"
SET "category" = 'Household items'
WHERE "category" IN ('Household expense', 'House item purchase');

UPDATE "HouseExpense"
SET "category" = 'Loan EMI',
    "note" = CASE
      WHEN "note" = '' THEN 'Mapped from loan principal prepayment'
      ELSE "note"
    END
WHERE "category" = 'Loan principal prepayment';

UPDATE "HouseExpense"
SET "category" = 'Other',
    "customLabel" = 'Housewarming',
    "kind" = 'purchase'
WHERE "category" = 'Housewarming';

-- CreateIndex
CREATE INDEX "HouseExpense_userId_houseId_kind_monthKey_idx"
ON "HouseExpense"("userId", "houseId", "kind", "monthKey");
