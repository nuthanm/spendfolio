"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

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
  return prisma.incomeSource.findMany({
    where: { userId: user.id },
    orderBy: [{ recurring: "desc" }, { createdAt: "asc" }],
  });
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
  revalidatePath("/income");
  revalidatePath("/dashboard");
  return { ok: true };
}
