"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatMonthLabel, isMonthKey } from "@/lib/dates";

const OVERRIDE_PREFIX = "__override__:";

function overrideCadenceForSource(sourceId: string) {
  return `${OVERRIDE_PREFIX}${sourceId}`;
}

function sourceIdFromOverrideCadence(cadence: string) {
  if (!cadence.startsWith(OVERRIDE_PREFIX)) return null;
  const sourceId = cadence.slice(OVERRIDE_PREFIX.length);
  return sourceId || null;
}

function isOverrideIncomeRow(row: { recurring: boolean; cadence: string }) {
  return !row.recurring && row.cadence.startsWith(OVERRIDE_PREFIX);
}

function parseIncomeForm(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  const recurring = String(formData.get("recurring") || "true") === "true";
  const cadence = recurring
    ? String(formData.get("cadence") || "Monthly")
    : "One-time";
  const nextDate = recurring
    ? String(formData.get("nextDate") || "") || null
    : null;
  const monthKey = !recurring
    ? String(formData.get("monthKey") || "") || null
    : null;

  return { name, amount, recurring, cadence, nextDate, monthKey };
}

function validateIncome(data: ReturnType<typeof parseIncomeForm>) {
  if (!data.name || !(data.amount >= 0)) {
    return "Name and amount are required.";
  }
  if (!data.recurring && !data.monthKey) {
    return "Select the month for one-time income.";
  }
  return null;
}

export async function listIncomeSources() {
  const user = await requireUser();
  const rows = await prisma.incomeSource.findMany({
    where: { userId: user.id },
    orderBy: [{ recurring: "desc" }, { createdAt: "asc" }],
  });
  return rows.filter((row) => !isOverrideIncomeRow(row));
}

export async function addIncomeSource(formData: FormData) {
  const user = await requireUser();
  const data = parseIncomeForm(formData);
  const error = validateIncome(data);
  if (error) return { error };

  await prisma.incomeSource.create({
    data: { userId: user.id, ...data },
  });
  revalidatePath("/income");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateIncomeSource(id: string, formData: FormData) {
  const user = await requireUser();
  const data = parseIncomeForm(formData);
  const error = validateIncome(data);
  if (error) return { error };

  const result = await prisma.incomeSource.updateMany({
    where: { id, userId: user.id },
    data,
  });
  if (result.count === 0) return { error: "Income source not found." };

  revalidatePath("/income");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteIncomeSource(id: string) {
  const user = await requireUser();
  await prisma.incomeSource.deleteMany({ where: { id, userId: user.id } });
  await prisma.incomeSource.deleteMany({
    where: {
      userId: user.id,
      recurring: false,
      cadence: overrideCadenceForSource(id),
    },
  });
  revalidatePath("/income");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function listIncomeOverrides() {
  const user = await requireUser();
  const [sources, overrides] = await Promise.all([
    prisma.incomeSource.findMany({
      where: { userId: user.id, recurring: true },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.incomeSource.findMany({
      where: {
        userId: user.id,
        recurring: false,
      },
      orderBy: [{ monthKey: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const sourceMap = new Map(sources.map((source) => [source.id, source.name]));

  return overrides
    .map((override) => {
      const sourceId = sourceIdFromOverrideCadence(override.cadence);
      if (!sourceId || !override.monthKey) return null;
      const sourceName = sourceMap.get(sourceId);
      if (!sourceName) return null;

      return {
        id: override.id,
        sourceId,
        sourceName,
        monthKey: override.monthKey,
        monthLabel: formatMonthLabel(override.monthKey),
        amount: override.amount,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export async function upsertIncomeOverride(formData: FormData) {
  const user = await requireUser();
  const sourceId = String(formData.get("sourceId") || "").trim();
  const monthKey = String(formData.get("monthKey") || "").trim();
  const amount = Number(formData.get("amount") || 0);

  if (!sourceId) return { error: "Select a recurring income source." };
  if (!isMonthKey(monthKey)) return { error: "Select a valid month." };
  if (!(amount >= 0)) return { error: "Amount must be zero or more." };

  const source = await prisma.incomeSource.findFirst({
    where: { id: sourceId, userId: user.id, recurring: true },
    select: { id: true, name: true },
  });

  if (!source) return { error: "Recurring income source not found." };

  const cadenceMarker = overrideCadenceForSource(source.id);
  const existing = await prisma.incomeSource.findFirst({
    where: {
      userId: user.id,
      recurring: false,
      cadence: cadenceMarker,
      monthKey,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.incomeSource.update({
      where: { id: existing.id },
      data: {
        name: source.name,
        amount,
      },
    });
  } else {
    await prisma.incomeSource.create({
      data: {
        userId: user.id,
        name: source.name,
        amount,
        recurring: false,
        cadence: cadenceMarker,
        nextDate: null,
        monthKey,
      },
    });
  }

  revalidatePath("/income");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteIncomeOverride(id: string) {
  const user = await requireUser();
  await prisma.incomeSource.deleteMany({
    where: {
      id,
      userId: user.id,
      recurring: false,
      cadence: { startsWith: OVERRIDE_PREFIX },
    },
  });
  revalidatePath("/income");
  revalidatePath("/dashboard");
  return { ok: true };
}
