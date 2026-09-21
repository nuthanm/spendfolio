"use client";

import { useEffect, useMemo, useState } from "react";
import { formatINR } from "@/lib/finance";
import { currentMonthKey, formatMonthLabel } from "@/lib/dates";
import { LIVING_CATEGORIES, shiftMonthKey } from "@/lib/house";
import type { HouseTrackerData, HouseTrackerExpense } from "@/lib/actions/house";
import { MONTH_OPTIONS, NumberField, toInput } from "@/components/house/fields";

type LivingRow = {
  id?: string;
  category: string;
  customLabel: string;
  amount: string;
  note: string;
};

function livingRowsForMonth(expenses: HouseTrackerExpense[], monthKey: string): LivingRow[] {
  const monthRows = expenses.filter(
    (row) => (row.kind === "living" || row.kind === "maintenance") && row.monthKey === monthKey,
  );

  const usedIds = new Set<string>();
  const rows: LivingRow[] = LIVING_CATEGORIES.filter((category) => category !== "Other").map((category) => {
    const match = monthRows.find((row) => row.category === category);
    if (match) usedIds.add(match.id);
    return {
      id: match?.id,
      category,
      customLabel: "",
      amount: match ? String(match.amount) : "",
      note: match?.note || "",
    };
  });

  const others = monthRows.filter((row) => row.category === "Other" || !usedIds.has(row.id));
  if (others.length === 0) {
    rows.push({ category: "Other", customLabel: "", amount: "", note: "" });
  } else {
    for (const row of others) {
      rows.push({
        id: row.id,
        category: row.category === "Other" ? "Other" : row.category,
        customLabel: row.customLabel || (row.category === "Other" ? "" : row.category),
        amount: String(row.amount),
        note: row.note,
      });
    }
  }

  return rows;
}

function varianceTone(spent: number, budget: number | null) {
  if (!budget || budget <= 0) return { label: "No budget set", className: "text-ink", extra: null as number | null };
  const extra = spent - budget;
  if (Math.abs(extra) < 0.5) return { label: "On budget", className: "text-gold", extra: 0 };
  if (extra > 0) return { label: "Over budget", className: "text-coral", extra };
  return { label: "Under budget", className: "text-mint", extra };
}

export function LivingExpensesTab({
  data,
  pending,
  onSaveMonth,
  onSaveBudget,
}: {
  data: HouseTrackerData;
  pending: boolean;
  onSaveMonth: (monthKey: string, rows: { id?: string; category: string; customLabel: string; amount: number; note: string }[]) => void;
  onSaveBudget: (budget: string) => void;
}) {
  const nowMonth = currentMonthKey();
  const [monthKey, setMonthKey] = useState(nowMonth);
  const [budget, setBudget] = useState(toInput(data.profile.monthlyBudget));
  const [rows, setRows] = useState<LivingRow[]>(() => livingRowsForMonth(data.expenses, nowMonth));
  const [compareOn, setCompareOn] = useState(false);
  const [compareMonths, setCompareMonths] = useState<string[]>([]);

  useEffect(() => {
    setRows(livingRowsForMonth(data.expenses, monthKey));
    setBudget(toInput(data.profile.monthlyBudget));
  }, [data, monthKey]);

  const [year, month] = monthKey.split("-");

  const livingExpenses = useMemo(
    () => data.expenses.filter((row) => row.kind === "living" || row.kind === "maintenance"),
    [data.expenses],
  );

  const spent = useMemo(
    () => livingExpenses.filter((row) => row.monthKey === monthKey).reduce((sum, row) => sum + row.amount, 0),
    [livingExpenses, monthKey],
  );

  const budgetValue = data.profile.monthlyBudget;
  const tone = varianceTone(spent, budgetValue);

  const availableMonths = useMemo(() => {
    const keys = new Set(data.totals.livingByMonth.map((row) => row.monthKey));
    keys.add(nowMonth);
    keys.add(monthKey);
    return [...keys].sort((a, b) => b.localeCompare(a));
  }, [data.totals.livingByMonth, monthKey, nowMonth]);

  const compareTable = useMemo(() => {
    if (!compareOn || compareMonths.length < 2) return null;
    const selected = [...compareMonths].sort();
    const categories = new Set<string>();
    const byMonth = new Map<string, Map<string, number>>();

    for (const key of selected) {
      const map = new Map<string, number>();
      for (const row of livingExpenses.filter((item) => item.monthKey === key)) {
        const label = row.customLabel || row.category;
        map.set(label, (map.get(label) || 0) + row.amount);
        categories.add(label);
      }
      byMonth.set(key, map);
    }

    const table = [...categories].map((category) => {
      const values = selected.map((key) => byMonth.get(key)?.get(category) || 0);
      const present = values.filter((value) => value > 0);
      const common = present.length === selected.length ? Math.min(...present) : 0;
      const last = values.at(-1) || 0;
      const prev = values.at(-2) || 0;
      const delta = last - prev;
      const maxValue = Math.max(...values);
      return { category, values, common, delta, maxValue };
    });

    const largestCategory = [...table].sort((a, b) => {
      const aSum = a.values.reduce((sum, value) => sum + value, 0);
      const bSum = b.values.reduce((sum, value) => sum + value, 0);
      return bSum - aSum;
    })[0]?.category;

    return { selected, table, largestCategory };
  }, [compareMonths, compareOn, livingExpenses]);

  function loadMonth(nextKey: string) {
    setMonthKey(nextKey);
    setRows(livingRowsForMonth(data.expenses, nextKey));
  }

  function updateRow(index: number, patch: Partial<LivingRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="space-y-6">
      <section className="border border-line bg-white/50 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink">Living expenses</h2>
            <p className="mt-1 text-sm text-ink-soft">Post-handover monthly household spend for {formatMonthLabel(monthKey)}.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => loadMonth(shiftMonthKey(monthKey, -1))}>
              Previous
            </button>
            <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => loadMonth(shiftMonthKey(monthKey, 1))}>
              Next
            </button>
            {monthKey !== nowMonth ? (
              <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => loadMonth(nowMonth)}>
                Current month
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs text-ink-soft">Year</span>
            <select
              className="field"
              value={year}
              onChange={(e) => loadMonth(`${e.target.value}-${month}`)}
            >
              {[Number(year) - 1, Number(year), Number(year) + 1]
                .filter((value, index, all) => all.indexOf(value) === index)
                .map((value) => (
                  <option key={value} value={String(value)}>
                    {value}
                  </option>
                ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-ink-soft">Month</span>
            <select className="field" value={month} onChange={(e) => loadMonth(`${year}-${e.target.value}`)}>
              {MONTH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="border border-line bg-white/50 p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Budget allocated</p>
          <p className="mt-2 text-2xl font-bold text-ink">{formatINR(budgetValue || 0)}</p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onSaveBudget(budget);
            }}
          >
            <input className="field" type="number" step="any" value={budget} onChange={(e) => setBudget(e.target.value)} />
            <button className="btn-secondary px-3 py-2 text-sm" disabled={pending} type="submit">
              Save
            </button>
          </form>
        </div>
        <div className="border border-line bg-white/50 p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Current spend</p>
          <p className="mt-2 text-2xl font-bold text-ink">{formatINR(spent)}</p>
          <p className="mt-1 text-xs text-ink-soft">{formatMonthLabel(monthKey)}</p>
        </div>
        <div className="border border-line bg-white/50 p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Variance</p>
          <p className={`mt-2 text-2xl font-bold ${tone.className}`}>{tone.label}</p>
          <p className="mt-1 text-xs text-ink-soft">
            {tone.extra === null
              ? "Set a monthly budget to compare."
              : tone.extra > 0
                ? `${formatINR(tone.extra)} extra spent`
                : tone.extra < 0
                  ? `${formatINR(Math.abs(tone.extra))} left`
                  : "Spend matches the budget."}
          </p>
        </div>
      </section>

      <section className="border border-line bg-white/50 p-5">
        <h2 className="text-lg font-bold text-ink">Month entry</h2>
        <p className="mt-1 text-sm text-ink-soft">Fill the amounts you spent this month. Empty categories are skipped.</p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSaveMonth(
              monthKey,
              rows
                .filter((row) => Number(row.amount || 0) > 0 || Boolean(row.customLabel))
                .map((row) => ({
                  id: row.id,
                  category: row.category === "Other" || LIVING_CATEGORIES.includes(row.category as (typeof LIVING_CATEGORIES)[number])
                    ? row.category
                    : "Other",
                  customLabel: row.customLabel,
                  amount: Number(row.amount || 0),
                  note: row.note,
                })),
            );
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            {rows.map((row, index) => (
              <div key={`${row.category}-${row.id || index}`} className="border border-line/70 bg-white/40 p-3">
                {row.category === "Other" ? (
                  <label className="block">
                    <span className="mb-1 block text-xs text-ink-soft">Other item</span>
                    <input
                      className="field"
                      value={row.customLabel}
                      placeholder="Any household item"
                      onChange={(e) => updateRow(index, { customLabel: e.target.value })}
                    />
                  </label>
                ) : (
                  <p className="text-sm font-medium text-ink">{row.category}</p>
                )}
                <div className="mt-2">
                  <NumberField label="Amount" value={row.amount} onChange={(value) => updateRow(index, { amount: value })} />
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn-secondary px-3 py-2 text-sm"
            onClick={() => setRows((prev) => [...prev, { category: "Other", customLabel: "", amount: "", note: "" }])}
          >
            Add another item
          </button>
          <div>
            <button disabled={pending} className="btn-primary px-4 py-2 text-sm" type="submit">
              {pending ? "Saving..." : `Save ${formatMonthLabel(monthKey)}`}
            </button>
          </div>
        </form>
      </section>

      <section className="border border-line bg-white/50 p-5">
        <h2 className="text-lg font-bold text-ink">Month-wise expenses</h2>
        {data.totals.livingByMonth.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">No living expenses yet.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.totals.livingByMonth.map((row) => (
              <button
                key={row.monthKey}
                type="button"
                className={`border p-3 text-left ${
                  row.monthKey === monthKey ? "border-ink bg-white" : "border-line/70 bg-white/40"
                }`}
                onClick={() => loadMonth(row.monthKey)}
              >
                <p className="font-mono text-xs text-ink-soft">{formatMonthLabel(row.monthKey)}</p>
                <p className="mt-1 text-lg font-bold text-ink">{formatINR(row.total)}</p>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="border border-line bg-white/50 p-5">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={compareOn}
            onChange={(e) => {
              setCompareOn(e.target.checked);
              if (e.target.checked && compareMonths.length === 0) {
                const fallback = availableMonths.slice(0, 2);
                setCompareMonths(fallback.length >= 2 ? fallback : [monthKey, shiftMonthKey(monthKey, -1)]);
              }
            }}
          />
          Compare months
        </label>

        {compareOn ? (
          <div className="mt-4">
            <p className="mb-2 text-xs text-ink-soft">Select two or more months</p>
            <div className="flex flex-wrap gap-2">
              {availableMonths.map((key) => {
                const checked = compareMonths.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`px-3 py-1.5 text-xs font-medium ${checked ? "bg-ink text-white" : "border border-line text-ink-soft"}`}
                    onClick={() =>
                      setCompareMonths((prev) =>
                        prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
                      )
                    }
                  >
                    {formatMonthLabel(key)}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {compareTable ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-ink-soft">
                  <th className="py-2 pr-3 font-medium">Category</th>
                  {compareTable.selected.map((key) => (
                    <th key={key} className="py-2 pr-3 font-medium">
                      {formatMonthLabel(key)}
                    </th>
                  ))}
                  <th className="py-2 pr-3 font-medium">Common</th>
                  <th className="py-2 font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                {compareTable.table.map((row) => (
                  <tr
                    key={row.category}
                    className={`border-b border-line/60 ${
                      row.category === compareTable.largestCategory ? "bg-coral/10" : ""
                    }`}
                  >
                    <td className="py-2 pr-3 font-medium text-ink">{row.category}</td>
                    {row.values.map((value, index) => (
                      <td
                        key={`${row.category}-${index}`}
                        className={`py-2 pr-3 ${value === row.maxValue && value > 0 ? "font-semibold text-coral" : "text-ink"}`}
                      >
                        {formatINR(value)}
                      </td>
                    ))}
                    <td className="py-2 pr-3 text-ink-soft">{row.common > 0 ? formatINR(row.common) : "—"}</td>
                    <td className={`py-2 ${row.delta > 0 ? "text-coral" : row.delta < 0 ? "text-mint" : "text-ink-soft"}`}>
                      {row.delta > 0 ? "↑ " : row.delta < 0 ? "↓ " : "→ "}
                      {formatINR(Math.abs(row.delta))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : compareOn ? (
          <p className="mt-3 text-sm text-ink-soft">Select at least two months to compare category spend.</p>
        ) : null}
      </section>
    </div>
  );
}
