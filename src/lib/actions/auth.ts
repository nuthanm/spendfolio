"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  PENDING_COOKIE,
  SESSION_COOKIE,
  createSession,
  getPendingUser,
  getSessionUser,
  revokeAllUserSessions,
  revokeSessionByJwt,
} from "@/lib/auth";
import {
  LOCKED_MESSAGE,
  clearAuthFailures,
  isLocked,
  recordAuthFailure,
} from "@/lib/auth-lockout";
import { generateTotpSecret, totpUri, verifyAndConsumeTotp } from "@/lib/totp";
import QRCode from "qrcode";

/**
 * Compared against when the email is unknown, so a missing account takes as
 * long to reject as a wrong password (no account discovery by timing).
 */
const DUMMY_PASSWORD_HASH = "$2b$12$/HffPAbcmnTZbfu/8J3OG.J2DC.nXVRPLreM9oTn0pwnK8SF6BNcW";

async function setCookie(name: string, jwt: string, expiresAt: Date) {
  const jar = await cookies();
  jar.set(name, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

async function clearCookie(name: string) {
  const jar = await cookies();
  jar.set(name, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

async function qrFor(email: string, secret: string) {
  return QRCode.toDataURL(totpUri(email, secret), {
    margin: 1,
    color: { dark: "#14241e", light: "#e7f1ec" },
  });
}

/**
 * Checks a 2FA code for a sensitive action by a signed-in user. Wrong codes
 * spend the same lockout budget as sign-in, so a stolen session cannot be used
 * to guess codes for account deletion, password change or 2FA removal.
 */
async function checkActionCode(
  user: { id: string; authLockedUntil: Date | null },
  code: string,
): Promise<string | null> {
  if (isLocked(user)) return LOCKED_MESSAGE;
  if (await verifyAndConsumeTotp(user.id, code)) return null;
  await recordAuthFailure(user.id);
  return "Invalid or already-used 2FA code.";
}

export async function registerAction(formData: FormData) {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || password.length < 8) {
    return { error: "Use a valid email and password (8+ characters)." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with this email already exists." };

  const passwordHash = await bcrypt.hash(password, 12);
  const totpSecret = generateTotpSecret();

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      totpSecret,
      totpEnabled: true,
    },
  });

  const { jwt, expiresAt } = await createSession(user.id, "pending_2fa");
  await setCookie(PENDING_COOKIE, jwt, expiresAt);
  redirect("/login/2fa?setup=1");
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    return { error: "Invalid email or password." };
  }
  if (isLocked(user)) return { error: LOCKED_MESSAGE };

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    await recordAuthFailure(user.id);
    return { error: "Invalid email or password." };
  }

  const jar = await cookies();
  await revokeSessionByJwt(jar.get(SESSION_COOKIE)?.value);
  await revokeSessionByJwt(jar.get(PENDING_COOKIE)?.value);
  await clearCookie(SESSION_COOKIE);

  if (user.totpEnabled) {
    // The failure budget is only cleared after the 2FA step succeeds, so a
    // correct password does not buy an attacker fresh code guesses.
    const { jwt, expiresAt } = await createSession(user.id, "pending_2fa");
    await setCookie(PENDING_COOKIE, jwt, expiresAt);
    redirect(user.totpConfirmedAt ? "/login/2fa" : "/login/2fa?setup=1");
  }

  await clearAuthFailures(user.id);
  const { jwt, expiresAt } = await createSession(user.id, "full");
  await setCookie(SESSION_COOKIE, jwt, expiresAt);
  redirect("/dashboard");
}

export async function verify2faAction(formData: FormData) {
  const code = String(formData.get("code") || "").replace(/\D/g, "");
  const pending = await getPendingUser();
  if (!pending) return { error: "Session expired. Sign in again." };
  if (!pending.totpSecret) return { error: "2FA is not configured." };

  const jar = await cookies();
  if (isLocked(pending)) {
    await revokeSessionByJwt(jar.get(PENDING_COOKIE)?.value);
    await clearCookie(PENDING_COOKIE);
    return { error: LOCKED_MESSAGE };
  }
  if (code.length !== 6) return { error: "Enter the 6-digit authenticator code." };

  const valid = await verifyAndConsumeTotp(pending.id, code);
  if (!valid) {
    await recordAuthFailure(pending.id);
    return { error: "Invalid authenticator code." };
  }

  await revokeSessionByJwt(jar.get(PENDING_COOKIE)?.value);
  await clearCookie(PENDING_COOKIE);

  await prisma.user.update({
    where: { id: pending.id },
    data: {
      failedAuthCount: 0,
      authLockedUntil: null,
      ...(pending.totpConfirmedAt ? {} : { totpConfirmedAt: new Date() }),
    },
  });

  const { jwt, expiresAt } = await createSession(pending.id, "full");
  await setCookie(SESSION_COOKIE, jwt, expiresAt);
  redirect("/dashboard");
}

export async function logoutAction() {
  const jar = await cookies();
  await revokeSessionByJwt(jar.get(SESSION_COOKIE)?.value);
  await revokeSessionByJwt(jar.get(PENDING_COOKIE)?.value);
  await clearCookie(SESSION_COOKIE);
  await clearCookie(PENDING_COOKIE);
  redirect("/login");
}

/**
 * Shows the authenticator QR only while the account is still enrolling.
 * Once a first code has been accepted, the secret is never revealed again —
 * otherwise anyone holding just the password could re-read it here.
 */
export async function getSetupQr() {
  const pending = await getPendingUser();
  if (!pending?.totpSecret || pending.totpConfirmedAt) return null;
  const qrDataUrl = await qrFor(pending.email, pending.totpSecret);
  return { qrDataUrl, secret: pending.totpSecret, email: pending.email };
}

export async function changePasswordAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };
  if (isLocked(user)) return { error: LOCKED_MESSAGE };

  const current = String(formData.get("current") || "");
  const next = String(formData.get("next") || "");
  const code = String(formData.get("code") || "");

  const full = await prisma.user.findUnique({ where: { id: user.id } });
  if (!full) return { error: "User not found." };

  const ok = await bcrypt.compare(current, full.passwordHash);
  if (!ok) {
    await recordAuthFailure(user.id);
    return { error: "Current password is incorrect." };
  }
  if (next.length < 8) return { error: "New password must be 8+ characters." };

  if (full.totpEnabled) {
    const codeError = await checkActionCode(full, code);
    if (codeError) return { error: codeError };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, 12) },
  });

  return { ok: true };
}

export async function setTotpEnabledAction(enabled: boolean, code?: string) {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

  const full = await prisma.user.findUnique({ where: { id: user.id } });
  if (!full) return { error: "User not found." };

  if (!enabled) {
    if (!full.totpEnabled || !full.totpSecret) return { ok: true, totpEnabled: false };
    const codeError = await checkActionCode(full, code || "");
    if (codeError) return { error: codeError };
    await prisma.user.update({
      where: { id: user.id },
      data: { totpEnabled: false, totpSecret: null, totpConfirmedAt: null, totpLastStep: null },
    });
    return { ok: true, totpEnabled: false };
  }

  if (full.totpEnabled && full.totpConfirmedAt) {
    return { error: "2FA is already on." };
  }

  // Always issue a fresh secret. 2FA stays off until the user proves the
  // authenticator works with confirmTotpSetupAction.
  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: secret, totpEnabled: false, totpConfirmedAt: null, totpLastStep: null },
  });

  return { ok: true, totpEnabled: false, qrDataUrl: await qrFor(full.email, secret), secret };
}

export async function confirmTotpSetupAction(code: string) {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

  const full = await prisma.user.findUnique({ where: { id: user.id } });
  if (!full?.totpSecret) return { error: "Start 2FA setup first." };
  if (full.totpEnabled && full.totpConfirmedAt) return { ok: true, totpEnabled: true };

  const codeError = await checkActionCode(full, code);
  if (codeError) return { error: codeError };

  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: true, totpConfirmedAt: new Date() },
  });
  return { ok: true, totpEnabled: true };
}

export async function deleteAccountAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

  const confirm = String(formData.get("confirm") || "");
  const code = String(formData.get("code") || "");
  if (confirm !== "DELETE") return { error: 'Type DELETE to confirm.' };

  const full = await prisma.user.findUnique({ where: { id: user.id } });
  if (!full) return { error: "User not found." };

  if (full.totpEnabled) {
    const codeError = await checkActionCode(full, code);
    if (codeError) return { error: codeError };
  }

  await revokeAllUserSessions(user.id);
  await prisma.user.delete({ where: { id: user.id } });

  await clearCookie(SESSION_COOKIE);
  await clearCookie(PENDING_COOKIE);
  redirect("/");
}

export async function hasAnyUser() {
  return (await prisma.user.count()) > 0;
}
