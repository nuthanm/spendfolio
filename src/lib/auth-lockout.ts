import { prisma } from "@/lib/db";

/** Bad passwords and bad 2FA codes share one budget per account. */
export const MAX_FAILED_AUTH = 5;
export const LOCK_MINUTES = 15;

export const LOCKED_MESSAGE = `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.`;

export function isLocked(user: { authLockedUntil: Date | null }) {
  return Boolean(user.authLockedUntil && user.authLockedUntil.getTime() > Date.now());
}

/** Atomically counts a failure and locks the account once the budget is spent. */
export async function recordAuthFailure(userId: string) {
  await prisma.$executeRaw`
    UPDATE "User"
    SET
      "failedAuthCount" = CASE WHEN "failedAuthCount" + 1 >= ${MAX_FAILED_AUTH} THEN 0 ELSE "failedAuthCount" + 1 END,
      "authLockedUntil" = CASE
        WHEN "failedAuthCount" + 1 >= ${MAX_FAILED_AUTH}
          THEN NOW() + INTERVAL '15 minutes' -- keep in sync with LOCK_MINUTES
        ELSE "authLockedUntil"
      END
    WHERE "id" = ${userId}
  `;
}

/** Only a complete sign-in (password + 2FA where enabled) clears the budget. */
export async function clearAuthFailures(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { failedAuthCount: 0, authLockedUntil: null },
  });
}
