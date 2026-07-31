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
import { generateTotpSecret, totpUri, verifyTotp } from "@/lib/totp";
import QRCode from "qrcode";

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
  if (!user) return { error: "Invalid email or password." };

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return { error: "Invalid email or password." };

  const jar = await cookies();
  await revokeSessionByJwt(jar.get(SESSION_COOKIE)?.value);
  await revokeSessionByJwt(jar.get(PENDING_COOKIE)?.value);
  await clearCookie(SESSION_COOKIE);

  if (user.totpEnabled) {
    const { jwt, expiresAt } = await createSession(user.id, "pending_2fa");
    await setCookie(PENDING_COOKIE, jwt, expiresAt);
    redirect("/login/2fa");
  }

  const { jwt, expiresAt } = await createSession(user.id, "full");
  await setCookie(SESSION_COOKIE, jwt, expiresAt);
  redirect("/dashboard");
}

export async function verify2faAction(formData: FormData) {
  const code = String(formData.get("code") || "").replace(/\D/g, "");
  const pending = await getPendingUser();
  if (!pending) return { error: "Session expired. Sign in again." };
  if (!pending.totpSecret) return { error: "2FA is not configured." };
  if (code.length !== 6) return { error: "Enter the 6-digit authenticator code." };

  const valid = await verifyTotp(code, pending.totpSecret);
  if (!valid) return { error: "Invalid authenticator code." };

  const jar = await cookies();
  await revokeSessionByJwt(jar.get(PENDING_COOKIE)?.value);
  await clearCookie(PENDING_COOKIE);

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

export async function getSetupQr() {
  const pending = await getPendingUser();
  if (!pending?.totpSecret) return null;
  const uri = totpUri(pending.email, pending.totpSecret);
  const qrDataUrl = await QRCode.toDataURL(uri, {
    margin: 1,
    color: { dark: "#14241e", light: "#e7f1ec" },
  });
  return { qrDataUrl, secret: pending.totpSecret, email: pending.email };
}

export async function changePasswordAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

  const current = String(formData.get("current") || "");
  const next = String(formData.get("next") || "");
  const code = String(formData.get("code") || "").replace(/\D/g, "");

  const full = await prisma.user.findUnique({ where: { id: user.id } });
  if (!full) return { error: "User not found." };

  const ok = await bcrypt.compare(current, full.passwordHash);
  if (!ok) return { error: "Current password is incorrect." };
  if (next.length < 8) return { error: "New password must be 8+ characters." };

  if (full.totpEnabled) {
    if (!full.totpSecret || !(await verifyTotp(code, full.totpSecret))) {
      return { error: "Valid 2FA code is required to change password." };
    }
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
    if (!full.totpSecret || !code || !(await verifyTotp(code, full.totpSecret))) {
      return { error: "Enter a valid 2FA code to disable authenticator." };
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { totpEnabled: false },
    });
    return { ok: true, totpEnabled: false };
  }

  let secret = full.totpSecret;
  if (!secret) {
    secret = generateTotpSecret();
    await prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: secret, totpEnabled: true },
    });
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { totpEnabled: true },
    });
  }

  const uri = totpUri(full.email, secret);
  const qrDataUrl = await QRCode.toDataURL(uri, {
    margin: 1,
    color: { dark: "#14241e", light: "#e7f1ec" },
  });
  return { ok: true, totpEnabled: true, qrDataUrl, secret };
}

export async function deleteAccountAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

  const confirm = String(formData.get("confirm") || "");
  const code = String(formData.get("code") || "").replace(/\D/g, "");
  if (confirm !== "DELETE") return { error: 'Type DELETE to confirm.' };

  const full = await prisma.user.findUnique({ where: { id: user.id } });
  if (!full) return { error: "User not found." };

  if (full.totpEnabled) {
    if (!full.totpSecret || !(await verifyTotp(code, full.totpSecret))) {
      return { error: "Valid 2FA code is required to delete account." };
    }
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
