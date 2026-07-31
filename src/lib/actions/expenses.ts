"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { monthKeyFromDate, requireUser } from "@/lib/auth";

export async function listExpenses(monthKey?: string) {
  const user = await requireUser();
  return prisma.expense.findMany({
    where: {
      userId: user.id,
      ...(monthKey ? { monthKey } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}

export async function listFieldDefs() {
  const user = await requireUser();
  return prisma.customFieldDef.findMany({
    where: { userId: user.id },
    orderBy: { sortOrder: "asc" },
  });
}

export async function addFieldDef(formData: FormData) {
  const user = await requireUser();
  const label = String(formData.get("label") || "").trim();
  const type = String(formData.get("type") || "text");
  const optionsRaw = String(formData.get("options") || "");
  const options =
    type === "dropdown"
      ? JSON.stringify(
          optionsRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        )
      : "[]";

  if (!label) return { error: "Label is required." };

  const count = await prisma.customFieldDef.count({ where: { userId: user.id } });
  await prisma.customFieldDef.create({
    data: {
      userId: user.id,
      label,
      type,
      options,
      sortOrder: count,
    },
  });
  revalidatePath("/expenses");
  return { ok: true };
}

export async function removeFieldDef(id: string) {
  const user = await requireUser();
  await prisma.customFieldDef.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/expenses");
  return { ok: true };
}

export async function addExpense(formData: FormData) {
  const user = await requireUser();
  const date = String(formData.get("date") || "");
  const label = String(formData.get("label") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  const remarks = String(formData.get("remarks") || "");
  const renewalDate = String(formData.get("renewalDate") || "") || null;
  const customRaw = String(formData.get("customFields") || "{}");

  if (!date || !label || !(amount >= 0)) {
    return { error: "Date, label, and amount are required." };
  }

  let customFields = "{}";
  try {
    customFields = JSON.stringify(JSON.parse(customRaw));
  } catch {
    customFields = "{}";
  }

  await prisma.expense.create({
    data: {
      userId: user.id,
      date,
      label,
      amount,
      remarks,
      renewalDate,
      customFields,
      monthKey: monthKeyFromDate(date),
    },
  });

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteExpense(id: string) {
  const user = await requireUser();
  await prisma.expense.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function commitImportRows(
  rows: {
    date: string;
    label: string;
    amount: number;
    remarks?: string;
    renewalDate?: string | null;
  }[],
) {
  const user = await requireUser();
  if (!rows.length) return { error: "No rows to import." };

  await prisma.expense.createMany({
    data: rows.map((r) => ({
      userId: user.id,
      date: r.date,
      label: r.label || "Other",
      amount: Number(r.amount) || 0,
      remarks: r.remarks || "",
      renewalDate: r.renewalDate || null,
      customFields: "{}",
      monthKey: monthKeyFromDate(r.date),
    })),
  });

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  revalidatePath("/import");
  return { ok: true, count: rows.length };
}
