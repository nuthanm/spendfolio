import { generateSecret, generateURI, verify } from "otplib";
import { prisma } from "@/lib/db";

export function generateTotpSecret() {
  return generateSecret();
}

export function totpUri(email: string, secret: string) {
  return generateURI({
    issuer: "Spendfolio",
    label: email,
    secret,
  });
}

/**
 * Checks a code and burns it so the same code (or an older one) can never be
 * accepted again for this user. The time-step update is conditional, so two
 * concurrent requests with the same code cannot both succeed.
 */
export async function verifyAndConsumeTotp(userId: string, code: string): Promise<boolean> {
  const token = String(code || "").replace(/\D/g, "");
  if (token.length !== 6) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpLastStep: true },
  });
  if (!user?.totpSecret) return false;

  const result = await verify({
    token,
    secret: user.totpSecret,
    ...(user.totpLastStep != null ? { afterTimeStep: user.totpLastStep } : {}),
  });
  if (!result.valid || !("timeStep" in result)) return false;

  const claimed = await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [{ totpLastStep: null }, { totpLastStep: { lt: result.timeStep } }],
    },
    data: { totpLastStep: result.timeStep },
  });
  return claimed.count === 1;
}
