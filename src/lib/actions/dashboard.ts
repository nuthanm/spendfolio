"use server";

import { prisma } from "@/lib/db";
import { currentMonthKey, formatMonthLabel, requireUser } from "@/lib/auth";
import { computeHealth, daysUntil } from "@/lib/finance";

export async function getDashboardData(monthKey?: string) {
  const user = await requireUser();
  const key = monthKey || currentMonthKey();

  const [incomes, expenses, monthsRaw] = await Promise.all([
    prisma.incomeSource.findMany({ where: { userId: user.id } }),
    prisma.expense.findMany({
      where: { userId: user.id, monthKey: key },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.expense.findMany({
      where: { userId: user.id },
      select: { monthKey: true },
      distinct: ["monthKey"],
      orderBy: { monthKey: "desc" },
    }),
  ]);

  const incomeTotal = incomes.reduce((s, i) => s + i.amount, 0);
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const health = computeHealth(incomeTotal, expenseTotal);

  const tileMap = new Map<string, number>();
  for (const e of expenses) {
    tileMap.set(e.label, (tileMap.get(e.label) || 0) + e.amount);
  }
  const tiles = [...tileMap.entries()]
    .map(([label, amount]) => ({
      label,
      amount,
      share: expenseTotal > 0 ? Math.round((amount / expenseTotal) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 45);
  const horizonStr = horizon.toISOString().slice(0, 10);

  const renewalCandidates = await prisma.expense.findMany({
    where: {
      userId: user.id,
      renewalDate: { not: null, gte: today, lte: horizonStr },
    },
    orderBy: { renewalDate: "asc" },
    take: 20,
  });

  const renewals = renewalCandidates.map((e) => ({
    id: e.id,
    title: e.label,
    amount: e.amount,
    due: e.renewalDate!,
    daysLeft: daysUntil(e.renewalDate) ?? 999,
    remarks: e.remarks,
  }));

  const monthKeys = new Set(monthsRaw.map((m) => m.monthKey));
  monthKeys.add(currentMonthKey());
  monthKeys.add(key);
  const months = [...monthKeys].sort().reverse().map((k) => ({
    key: k,
    label: formatMonthLabel(k),
  }));

  return {
    monthKey: key,
    monthLabel: formatMonthLabel(key),
    isCurrent: key === currentMonthKey(),
    incomeTotal,
    expenseTotal,
    health,
    tiles,
    renewals,
    recent: expenses.slice(0, 8),
    months,
  };
}

export async function exportAllData() {
  const user = await requireUser();
  const [incomes, expenses, fields] = await Promise.all([
    prisma.incomeSource.findMany({ where: { userId: user.id } }),
    prisma.expense.findMany({ where: { userId: user.id }, orderBy: { date: "asc" } }),
    prisma.customFieldDef.findMany({ where: { userId: user.id } }),
  ]);
  return { email: user.email, incomes, expenses, fields, exportedAt: new Date().toISOString() };
}
