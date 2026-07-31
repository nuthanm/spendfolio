"use server";

import { prisma } from "@/lib/db";
import { currentMonthKey, formatMonthLabel, requireUser } from "@/lib/auth";
import { computeHealth, daysUntil } from "@/lib/finance";

export async function getDashboardData(monthKey?: string) {
  const user = await requireUser();
  const key = monthKey || currentMonthKey();

  const [incomes, expenses, monthsRaw, recurringExpenses] = await Promise.all([
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
    prisma.expense.findMany({
      where: {
        userId: user.id,
        recurring: true,
        renewalDate: { not: null },
      },
      orderBy: { renewalDate: "asc" },
      take: 12,
    }),
  ]);

  const incomeTotal = incomes
    .filter((i) => i.recurring || i.monthKey === key)
    .reduce((s, i) => s + i.amount, 0);
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const health = computeHealth(incomeTotal, expenseTotal);

  const tileMap = new Map<
    string,
    {
      amount: number;
      items: { id: string; date: string; amount: number; remarks: string; recurring: boolean }[];
    }
  >();
  for (const e of expenses) {
    const bucket = tileMap.get(e.label) || { amount: 0, items: [] };
    bucket.amount += e.amount;
    bucket.items.push({
      id: e.id,
      date: e.date,
      amount: e.amount,
      remarks: e.remarks,
      recurring: e.recurring,
    });
    tileMap.set(e.label, bucket);
  }
  const tiles = [...tileMap.entries()]
    .map(([label, bucket]) => ({
      label,
      amount: bucket.amount,
      share: expenseTotal > 0 ? Math.round((bucket.amount / expenseTotal) * 100) : 0,
      items: bucket.items.sort((a, b) => b.date.localeCompare(a.date)),
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
    recurring: e.recurring,
  }));

  const recurringTiles = recurringExpenses.map((e) => ({
    id: e.id,
    title: e.label,
    amount: e.amount,
    nextDate: e.renewalDate!,
    daysLeft: daysUntil(e.renewalDate) ?? 999,
    remarks: e.remarks,
  }));

  const monthKeys = new Set(monthsRaw.map((m) => m.monthKey));
  for (const income of incomes) {
    if (income.monthKey) monthKeys.add(income.monthKey);
  }
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
    recurringTiles,
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
