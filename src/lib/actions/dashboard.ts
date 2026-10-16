"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { buildDashboard } from "@/lib/dashboard-data";

export async function getDashboardData(monthKey?: string, fyStartYear?: string) {
  const user = await requireUser();
  return buildDashboard(user.id, monthKey, fyStartYear);
}

export async function exportAllData() {
  const user = await requireUser();
  const [incomes, expenses, fields, goldHolding, goldTransactions, silverHolding, silverTransactions, houseProfiles, houseExpenses] = await Promise.all([
    prisma.incomeSource.findMany({ where: { userId: user.id } }),
    prisma.expense.findMany({ where: { userId: user.id }, orderBy: { date: "asc" } }),
    prisma.customFieldDef.findMany({ where: { userId: user.id } }),
    prisma.metalHolding.findFirst({ where: { userId: user.id, metalType: "gold" } }),
    prisma.metalTransaction.findMany({ where: { userId: user.id, type: "gold" }, orderBy: { date: "asc" } }),
    prisma.metalHolding.findFirst({ where: { userId: user.id, metalType: "silver" } }),
    prisma.metalTransaction.findMany({ where: { userId: user.id, type: "silver" }, orderBy: { date: "asc" } }),
    prisma.houseProfile.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.houseExpense.findMany({ where: { userId: user.id }, orderBy: { date: "asc" } }),
  ]);
  return { 
    email: user.email, 
    incomes, 
    expenses, 
    fields,
    gold: { holding: goldHolding, transactions: goldTransactions },
    silver: { holding: silverHolding, transactions: silverTransactions },
    house: { profiles: houseProfiles, profile: houseProfiles[0] ?? null, expenses: houseExpenses },
    exportedAt: new Date().toISOString() 
  };
}
