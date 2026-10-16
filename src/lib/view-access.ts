import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { unstable_noStore as noStore } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hashToken, newToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildDashboard } from "@/lib/dashboard-data";

export const VIEW_COOKIE = "spend_view";
const VIEW_MAX_AGE = 24 * 60 * 60;
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class ViewAccessError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ViewAccessError";
    this.status = status;
  }
}

export type ViewLinkStatus =
  | { active: false }
  | {
      active: true;
      createdAt: string;
      lastViewedAt: string | null;
      lockedUntil: string | null;
    };

export type ViewAccess = {
  userId: string;
  ownerName: string;
  expiresAt: string;
};

export type ViewCategory = {
  label: string;
  amount: number;
  count: number;
};

let tablesReady: Promise<void> | null = null;

function logViewEvent(
  event: "view_link_created" | "view_link_revoked" | "view_link_unlock",
  fields: Record<string, string | number | boolean | null>,
) {
  console.info(JSON.stringify({ event, ...fields }));
}

export function viewJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function normalizeViewToken(raw: string) {
  const token = String(raw || "").trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}

function normalizeViewPassword(raw: string) {
  const compact = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (compact.length !== 16) return String(raw || "").trim();
  return `${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}`;
}

function generateViewPassword() {
  const chars: string[] = [];
  const limit = 256 - (256 % PASSWORD_ALPHABET.length);
  while (chars.length < 16) {
    const bytes = randomBytes(32);
    for (const byte of bytes) {
      if (byte >= limit) continue;
      chars.push(PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]);
      if (chars.length === 16) break;
    }
  }
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}-${chars.slice(12, 16).join("")}`;
}

async function createViewTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "spend_view_links" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "tokenHash" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "failedAttempts" INTEGER NOT NULL DEFAULT 0,
      "lockedUntil" TIMESTAMP(3),
      "revokedAt" TIMESTAMP(3),
      "lastViewedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "spend_view_links_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "spend_view_links_tokenHash_key" UNIQUE ("tokenHash"),
      CONSTRAINT "spend_view_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "spend_view_links_userId_idx" ON "spend_view_links"("userId")`,
  );
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "spend_view_links_active_user_idx"
    ON "spend_view_links" ("userId")
    WHERE "revokedAt" IS NULL
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "spend_view_sessions" (
      "tokenHash" TEXT NOT NULL,
      "linkId" TEXT NOT NULL,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "spend_view_sessions_pkey" PRIMARY KEY ("tokenHash"),
      CONSTRAINT "spend_view_sessions_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "spend_view_links"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "spend_view_sessions_linkId_idx" ON "spend_view_sessions"("linkId")`,
  );
}

export function ensureViewTables() {
  if (!tablesReady) {
    tablesReady = createViewTables().catch((error) => {
      tablesReady = null;
      throw error;
    });
  }
  return tablesReady;
}

export async function getViewLinkStatus(userId: string): Promise<ViewLinkStatus> {
  await ensureViewTables();
  const link = await prisma.spendViewLink.findFirst({
    where: { userId, revokedAt: null },
  });
  if (!link) return { active: false };
  const lockedUntil =
    link.lockedUntil && link.lockedUntil.getTime() > Date.now() ? link.lockedUntil.toISOString() : null;
  return {
    active: true,
    createdAt: link.createdAt.toISOString(),
    lastViewedAt: link.lastViewedAt ? link.lastViewedAt.toISOString() : null,
    lockedUntil,
  };
}

export async function issueViewLink(userId: string) {
  await ensureViewTables();
  const rawToken = newToken();
  const password = generateViewPassword();
  const passwordHash = await bcrypt.hash(password, 12);
  const created = await prisma.$transaction(async (tx) => {
    const active = await tx.spendViewLink.findFirst({
      where: { userId, revokedAt: null },
    });
    if (active) {
      await tx.spendViewSession.deleteMany({ where: { linkId: active.id } });
      await tx.spendViewLink.update({
        where: { id: active.id },
        data: { revokedAt: new Date() },
      });
    }
    return tx.spendViewLink.create({
      data: {
        userId,
        tokenHash: hashToken(rawToken),
        passwordHash,
      },
    });
  });
  logViewEvent("view_link_created", { userId });
  return {
    path: `/view/${rawToken}`,
    password,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function revokeViewLink(userId: string) {
  await ensureViewTables();
  const active = await prisma.spendViewLink.findFirst({
    where: { userId, revokedAt: null },
  });
  if (!active) {
    logViewEvent("view_link_revoked", { userId, revoked: false });
    return false;
  }
  await prisma.spendViewSession.deleteMany({ where: { linkId: active.id } });
  await prisma.spendViewLink.update({
    where: { id: active.id },
    data: { revokedAt: new Date() },
  });
  logViewEvent("view_link_revoked", { userId, revoked: true });
  return true;
}

export async function unlockViewLink(rawToken: string, password: string) {
  await ensureViewTables();
  const token = normalizeViewToken(rawToken);
  const normalizedPassword = normalizeViewPassword(password);
  if (!normalizedPassword) {
    throw new ViewAccessError(400, "Password is required.");
  }
  if (!token) {
    logViewEvent("view_link_unlock", { ok: false, userId: null });
    throw new ViewAccessError(404, "This view link is inactive.");
  }

  const link = await prisma.spendViewLink.findFirst({
    where: { tokenHash: hashToken(token), revokedAt: null },
  });
  if (!link) {
    logViewEvent("view_link_unlock", { ok: false, userId: null });
    throw new ViewAccessError(404, "This view link is inactive.");
  }
  if (link.lockedUntil && link.lockedUntil.getTime() > Date.now()) {
    logViewEvent("view_link_unlock", { userId: link.userId, ok: false, locked: true });
    throw new ViewAccessError(429, "Too many attempts. This link is locked for 15 minutes.");
  }

  const matches = await bcrypt.compare(normalizedPassword, link.passwordHash);
  if (!matches) {
    await prisma.$executeRaw`
      UPDATE "spend_view_links"
      SET
        "failedAttempts" = CASE WHEN "failedAttempts" + 1 >= 5 THEN 0 ELSE "failedAttempts" + 1 END,
        "lockedUntil" = CASE
          WHEN "failedAttempts" + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
          ELSE "lockedUntil"
        END
      WHERE "id" = ${link.id}
    `;
    logViewEvent("view_link_unlock", { userId: link.userId, ok: false, locked: false });
    throw new ViewAccessError(401, "Incorrect password.");
  }

  const rawCookie = newToken();
  const expiresAt = new Date(Date.now() + VIEW_MAX_AGE * 1000);
  await prisma.$transaction([
    prisma.spendViewLink.update({
      where: { id: link.id },
      data: { failedAttempts: 0, lockedUntil: null, lastViewedAt: new Date() },
    }),
    prisma.spendViewSession.create({
      data: {
        tokenHash: hashToken(rawCookie),
        linkId: link.id,
        expiresAt,
      },
    }),
  ]);

  const jar = await cookies();
  jar.set(VIEW_COOKIE, rawCookie, cookieOptions(VIEW_MAX_AGE));
  logViewEvent("view_link_unlock", { userId: link.userId, ok: true, locked: false });
  return { ok: true as const, userId: link.userId };
}

export async function getViewAccess(rawToken: string): Promise<ViewAccess | null> {
  noStore();
  const token = normalizeViewToken(rawToken);
  if (!token) return null;
  const jar = await cookies();
  const rawCookie = jar.get(VIEW_COOKIE)?.value;
  if (!rawCookie) return null;

  await ensureViewTables();
  const session = await prisma.spendViewSession.findUnique({
    where: { tokenHash: hashToken(rawCookie) },
    include: {
      link: {
        include: {
          user: { select: { id: true, email: true } },
        },
      },
    },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  if (session.link.revokedAt) return null;
  if (session.link.tokenHash !== hashToken(token)) return null;

  return {
    userId: session.link.user.id,
    ownerName: session.link.user.email,
    expiresAt: session.expiresAt.toISOString(),
  };
}

export async function destroyViewSession() {
  const jar = await cookies();
  try {
    await ensureViewTables();
    const rawCookie = jar.get(VIEW_COOKIE)?.value;
    if (rawCookie) {
      await prisma.spendViewSession.deleteMany({
        where: { tokenHash: hashToken(rawCookie) },
      });
    }
  } finally {
    jar.set(VIEW_COOKIE, "", cookieOptions(0));
  }
}

export async function viewLinkIsActive(rawToken: string) {
  const token = normalizeViewToken(rawToken);
  if (!token) return false;
  await ensureViewTables();
  const link = await prisma.spendViewLink.findFirst({
    where: { tokenHash: hashToken(token), revokedAt: null },
    select: { id: true },
  });
  return Boolean(link);
}

export async function loadViewExpenses(userId: string) {
  await ensureViewTables();
  const rows = await prisma.expense.findMany({
    where: { userId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return plain(rows);
}

export async function loadViewExpense(userId: string, id: string) {
  await ensureViewTables();
  const row = await prisma.expense.findFirst({
    where: { id, userId },
  });
  return row ? plain(row) : null;
}

export async function loadViewFieldDefs(userId: string) {
  await ensureViewTables();
  const rows = await prisma.customFieldDef.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" },
  });
  return plain(rows);
}

export async function loadViewCategories(userId: string): Promise<ViewCategory[]> {
  await ensureViewTables();
  const rows = await prisma.expense.findMany({
    where: { userId },
    select: { label: true, amount: true },
  });
  const map = new Map<string, ViewCategory>();
  for (const row of rows) {
    const current = map.get(row.label) || { label: row.label, amount: 0, count: 0 };
    current.amount += row.amount;
    current.count += 1;
    map.set(row.label, current);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label));
}

export async function loadViewSummary(userId: string, monthKey?: string, fyStartYear?: string) {
  await ensureViewTables();
  const data = await buildDashboard(userId, monthKey, fyStartYear);
  return plain(data);
}
