-- AlterTable
ALTER TABLE "User"
ADD COLUMN "totpConfirmedAt" TIMESTAMP(3),
ADD COLUMN "totpLastStep" INTEGER,
ADD COLUMN "failedAuthCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "authLockedUntil" TIMESTAMP(3);

-- Users who already completed a 2FA sign-in have enrolled their authenticator.
-- Their secret must never be shown again on the login screen.
UPDATE "User" u
SET "totpConfirmedAt" = CURRENT_TIMESTAMP
WHERE u."totpSecret" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "Session" s WHERE s."userId" = u."id" AND s."kind" = 'full');
