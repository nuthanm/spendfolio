"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function listIncomeSources() {
  const user = await requireUser();
  return prisma.incomeSource.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
}

export async function addIncomeSource(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  const cadence = String(formData.get("cadence") || "Monthly");
  const nextDate = String(formData.get("nextDate") || "") || null;

  if (!name || !(amount >= 0)) return { error: "Name and amount are required." };

  await prisma.incomeSource.create({
    data: { userId: user.id, name, amount, cadence, nextDate },
  });
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
