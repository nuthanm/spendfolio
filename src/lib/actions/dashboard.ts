"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  buildFinancialYearMonths,
  currentMonthKey,
  formatFinancialYearLabel,
  formatMonthLabel,
  formatMonthShortLabel,
  getFinancialYearStartYear,
} from "@/lib/dates";
import { computeHealth, daysUntil } from "@/lib/finance";

const OVERRIDE_PREFIX = "__override__:";

function sourceIdFromOverrideCadence(cadence: string) {
  if (!cadence.startsWith(OVERRIDE_PREFIX)) return null;
  const sourceId = cadence.slice(OVERRIDE_PREFIX.length);
  return sourceId || null;
}

export async function getDashboardData(monthKey?: string, fyStartYear?: string) {
  const user = await requireUser();
  const nowMonthKey = currentMonthKey();
  const key = monthKey || nowMonthKey;

  const [incomes, expenses, expenseMonthRows, recurringExpenses] = await Promise.all([
    prisma.incomeSource.findMany({ where: { userId: user.id } }),
    prisma.expense.findMany({
      where: { userId: user.id, monthKey: key },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.expense.findMany({
      where: { userId: user.id },
      select: { monthKey: true, amount: true },
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

  const recurringIncomes = incomes.filter((income) => income.recurring);
  const oneTimeIncomes = incomes.filter(
    (income) => !income.recurring && !income.cadence.startsWith(OVERRIDE_PREFIX),
  );

  const recurringOverrides = incomes
    .filter((income) => !income.recurring && income.cadence.startsWith(OVERRIDE_PREFIX))
    .map((income) => {
      const sourceId = sourceIdFromOverrideCadence(income.cadence);
      if (!sourceId || !income.monthKey) return null;
      return {
        sourceId,
        monthKey: income.monthKey,
        amount: income.amount,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const overrideMap = new Map(recurringOverrides.map((item) => [`${item.sourceId}|${item.monthKey}`, item.amount]));

  const recurringStartBySource = new Map(
    recurringIncomes.map((income) => [income.id, currentMonthKey(income.createdAt)]),
  );

  function getMonthlyIncomeTotal(targetMonthKey: string) {
    const recurringTotal = recurringIncomes.reduce((sum, income) => {
      const startMonth = recurringStartBySource.get(income.id);
      const override = overrideMap.get(`${income.id}|${targetMonthKey}`);
      if (!override && startMonth && targetMonthKey < startMonth) return sum;
      return sum + (override ?? income.amount);
    }, 0);

    const oneTimeTotal = oneTimeIncomes
      .filter((income) => income.monthKey === targetMonthKey)
      .reduce((sum, income) => sum + income.amount, 0);

    return recurringTotal + oneTimeTotal;
  }

  const expenseTotalsByMonth = new Map<string, number>();
  for (const row of expenseMonthRows) {
    expenseTotalsByMonth.set(
      row.monthKey,
      (expenseTotalsByMonth.get(row.monthKey) || 0) + row.amount,
    );
  }

  const incomeTotal = getMonthlyIncomeTotal(key);
  const expenseTotal = expenseTotalsByMonth.get(key) || 0;
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

  const monthKeys = new Set(expenseMonthRows.map((row) => row.monthKey));
  for (const income of oneTimeIncomes) {
    if (income.monthKey) monthKeys.add(income.monthKey);
  }
  for (const override of recurringOverrides) {
    monthKeys.add(override.monthKey);
  }
  monthKeys.add(nowMonthKey);
  monthKeys.add(key);

  const financialYearOptions = [...new Set([...monthKeys].map((month) => getFinancialYearStartYear(month)))]
    .sort((a, b) => b - a)
    .map((startYear) => ({
      startYear,
      label: formatFinancialYearLabel(startYear),
    }));

  const parsedFy = Number(fyStartYear || "");
  const selectedFyStartYear =
    Number.isFinite(parsedFy) &&
    financialYearOptions.some((option) => option.startYear === parsedFy)
      ? parsedFy
      : financialYearOptions[0]?.startYear || getFinancialYearStartYear(nowMonthKey);

  const fyMonthKeys = buildFinancialYearMonths(selectedFyStartYear);
  const currentFyStartYear = getFinancialYearStartYear(nowMonthKey);
  const visibleFyMonthKeys =
    selectedFyStartYear === currentFyStartYear
      ? fyMonthKeys.filter((month) => month <= nowMonthKey)
      : fyMonthKeys;

  const fyMonths = visibleFyMonthKeys.map((month) => {
    const monthIncome = getMonthlyIncomeTotal(month);
    const monthExpense = expenseTotalsByMonth.get(month) || 0;
    const profit = monthIncome - monthExpense;
    return {
      key: month,
      shortLabel: formatMonthShortLabel(month),
      label: formatMonthLabel(month),
      income: monthIncome,
      expense: monthExpense,
      profit,
      status: profit > 0 ? "profit" : profit < 0 ? "loss" : "neutral",
    };
  });

  const fyIncomeTotal = fyMonths.reduce((sum, month) => sum + month.income, 0);
  const fyExpenseTotal = fyMonths.reduce((sum, month) => sum + month.expense, 0);
  const fyProfitTotal = fyIncomeTotal - fyExpenseTotal;
  const monthCount = fyMonths.length || 1;
  const fyAverageMonthlyProfit = fyProfitTotal / monthCount;
  const fyBestMonth = [...fyMonths].sort((a, b) => b.profit - a.profit)[0];
  const fyWorstMonth = [...fyMonths].sort((a, b) => a.profit - b.profit)[0];

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
    financialYear: {
      selectedStartYear: selectedFyStartYear,
      selectedLabel: formatFinancialYearLabel(selectedFyStartYear),
      options: financialYearOptions,
      totals: {
        income: fyIncomeTotal,
        expense: fyExpenseTotal,
        profit: fyProfitTotal,
        averageMonthlyProfit: fyAverageMonthlyProfit,
        status: fyProfitTotal > 0 ? "profit" : fyProfitTotal < 0 ? "loss" : "neutral",
      },
      bestMonth: fyBestMonth,
      worstMonth: fyWorstMonth,
      months: fyMonths,
    },
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
