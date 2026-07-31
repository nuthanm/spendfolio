import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "spendfolio_session";
export const PENDING_COOKIE = "spendfolio_pending";

const DAY_MS = 24 * 60 * 60 * 1000;

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET must be set (16+ chars)");
  }
  return new TextEncoder().encode(secret);
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken() {
  return randomBytes(32).toString("hex");
}

export async function createSession(userId: string, kind: "pending_2fa" | "full") {
  const token = newToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + (kind === "full" ? 14 : 0.25) * DAY_MS);

  await prisma.session.create({
    data: {
      token: tokenHash,
      userId,
      kind,
      expiresAt,
    },
  });

  const jwt = await new SignJWT({ sid: tokenHash, kind })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setExpirationTime(expiresAt)
    .sign(secretKey());

  return { jwt, expiresAt, kind };
}

export async function revokeSessionByJwt(jwt: string | undefined) {
  if (!jwt) return;
  try {
    const { payload } = await jwtVerify(jwt, secretKey());
    const sid = payload.sid as string | undefined;
    if (sid) {
      await prisma.session.updateMany({
        where: { token: sid, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  } catch {
    // already invalid
  }
}

export async function revokeAllUserSessions(userId: string) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export type AuthUser = {
  id: string;
  email: string;
  totpEnabled: boolean;
  totpSecret: string | null;
};

export async function getSessionUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  const jwt = jar.get(SESSION_COOKIE)?.value;
  if (!jwt) return null;

  try {
    const { payload } = await jwtVerify(jwt, secretKey());
    const sid = payload.sid as string;
    const kind = payload.kind as string;
    const userId = payload.sub as string;
    if (kind !== "full" || !sid || !userId) return null;

    const session = await prisma.session.findFirst({
      where: {
        token: sid,
        userId,
        kind: "full",
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: { id: true, email: true, totpEnabled: true, totpSecret: true },
        },
      },
    });

    if (!session) return null;
    return session.user;
  } catch {
    return null;
  }
}

export async function getPendingUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  const jwt = jar.get(PENDING_COOKIE)?.value;
  if (!jwt) return null;

  try {
    const { payload } = await jwtVerify(jwt, secretKey());
    const sid = payload.sid as string;
    const kind = payload.kind as string;
    const userId = payload.sub as string;
    if (kind !== "pending_2fa" || !sid || !userId) return null;

    const session = await prisma.session.findFirst({
      where: {
        token: sid,
        userId,
        kind: "pending_2fa",
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: { id: true, email: true, totpEnabled: true, totpSecret: true },
        },
      },
    });

    if (!session) return null;
    return session.user;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export function monthKeyFromDate(dateStr: string) {
  return dateStr.slice(0, 7);
}

export function currentMonthKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function formatMonthLabel(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
}
