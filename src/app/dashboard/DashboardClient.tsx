"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { getDashboardData } from "@/lib/actions/dashboard";
import { recordRecurringDebit } from "@/lib/actions/expenses";
import { formatINR } from "@/lib/finance";

type Dash = Awaited<ReturnType<typeof getDashboardData>>;
type Tile = Dash["tiles"][number];
type RecurringTile = Dash["recurringTiles"][number];

type RecurringEditState = {
  id: string;
  title: string;
  amount: string;
  date: string;
  nextDate: string;
  remarks: string;
  customFields: string;
};

export default function DashboardClient() {
  const search = useSearchParams();
  const router = useRouter();
  const initialMonth = search.get("month") || undefined;
  const initialFy = search.get("fy") || undefined;
  const [data, setData] = useState<Dash | null>(null);
  const [pending, startTransition] = useTransition();
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [recurringEdit, setRecurringEdit] = useState<RecurringEditState | null>(null);
  const [recurringError, setRecurringError] = useState<string | null>(null);
  const [savingRecurring, setSavingRecurring] = useState(false);
  const [recurringSavedFlash, setRecurringSavedFlash] = useState(false);

  useEffect(() => {
    startTransition(async () => {
      const d = await getDashboardData(initialMonth, initialFy);
      setData(d);
      setHoveredLabel(null);
      setSelectedLabel(null);
      setRecurringEdit(null);
      setRecurringError(null);
      setRecurringSavedFlash(false);
    });
  }, [initialMonth, initialFy]);

  function startRecurringEdit(tile: RecurringTile) {
    setRecurringEdit({
      id: tile.id,
      title: tile.title,
      amount: String(tile.amount),
      date: tile.date,
      nextDate: tile.nextDate,
      remarks: tile.remarks || "",
      customFields: tile.customFields || "{}",
    });
    setRecurringError(null);
  }

  async function saveRecurringEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!recurringEdit) return;

    const fd = new FormData();
    fd.set("date", recurringEdit.date);
    fd.set("label", recurringEdit.title.trim());
    fd.set("amount", recurringEdit.amount);
    fd.set("remarks", recurringEdit.remarks);
    fd.set("recurring", "true");
    fd.set("renewalDate", recurringEdit.nextDate);
    fd.set("customFields", recurringEdit.customFields || "{}");

    setSavingRecurring(true);
    setRecurringError(null);
    const res = await recordRecurringDebit(recurringEdit.id, fd);
    if (res?.error) {
      setRecurringError(res.error);
      setSavingRecurring(false);
      return;
    }

    const refreshed = await getDashboardData(initialMonth, initialFy);
    setData(refreshed);
    setRecurringEdit(null);
    setSavingRecurring(false);
    setRecurringSavedFlash(true);
    setTimeout(() => setRecurringSavedFlash(false), 1800);
  }

  function pushDashboardQuery(next: { month?: string; fy?: string }) {
    const params = new URLSearchParams(search.toString());
    if (next.month) params.set("month", next.month);
    else params.delete("month");
    if (next.fy) params.set("fy", next.fy);
    else params.delete("fy");
    router.push(`/dashboard?${params.toString()}`);
  }

  if (!data) {
    return (
      <AppShell title="Dashboard" subtitle="Loading your monthly math…">
        <p className="font-mono text-sm text-ink-soft">Calculating…</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Dashboard"
      subtitle="Live monthly math — income, spend, buffer, and renewals that need attention."
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 anim-rise">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">
              Month
            </span>
            <select
              className="field w-auto py-2"
              value={data.monthKey}
              disabled={pending}
              onChange={(e) =>
                pushDashboardQuery({
                  month: e.target.value,
                  fy: String(data.financialYear.selectedStartYear),
                })
              }
            >
              {data.months.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">
              Financial year
            </span>
            <select
              className="field w-auto py-2"
              value={String(data.financialYear.selectedStartYear)}
              disabled={pending}
              onChange={(e) =>
                pushDashboardQuery({
                  month: data.monthKey,
                  fy: e.target.value,
                })
              }
            >
              {data.financialYear.options.map((fy) => (
                <option key={fy.startYear} value={fy.startYear}>
                  {fy.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <span className="font-mono text-xs text-ink-soft">
          {data.isCurrent ? "Showing current month" : `Historical view · ${data.monthLabel}`}
        </span>
      </div>

      <section className="grid gap-4 md:grid-cols-4 anim-rise-delay-1">
        <Stat label="Income" value={data.incomeTotal} note="all sources" />
        <Stat label="Expenses" value={data.expenseTotal} note="this month" />
        <Stat label="Buffer" value={data.health.balance} note="income − expenses" accent />
        <div className="border border-line bg-white/50 p-5">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Status</p>
          <p
            className={`mt-3 inline-block px-3 py-1 text-sm font-semibold status-${data.health.status}`}
          >
            {data.health.label}
          </p>
          <p className="mt-3 text-sm text-ink-soft">{data.health.note}</p>
        </div>
      </section>

      <section className="mt-10 anim-rise-delay-1">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-bold text-ink">{data.financialYear.selectedLabel} summary</h2>
          <p className="font-mono text-xs text-ink-soft">
            Apr to Mar view across {data.financialYear.months.length} months
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="border border-mint/35 bg-gradient-to-b from-white/80 to-mint/5 p-5 shadow-[0_10px_24px_rgba(26,143,110,0.08)]">
            <p className="font-mono text-[11px] uppercase tracking-wider text-mint">FY Income</p>
            <p className="mt-3 text-3xl font-bold number-tick text-mint">
              <AnimatedNumber value={data.financialYear.totals.income} format={(n) => formatINR(n)} />
            </p>
            <p className="mt-2 font-mono text-xs text-ink-soft">{data.financialYear.months.length}-month inflow</p>
          </div>
          <div className="border border-coral/35 bg-gradient-to-b from-white/80 to-coral/5 p-5 shadow-[0_10px_24px_rgba(212,85,58,0.08)]">
            <p className="font-mono text-[11px] uppercase tracking-wider text-coral">FY Expenses</p>
            <p className="mt-3 text-3xl font-bold number-tick text-coral">
              <AnimatedNumber value={data.financialYear.totals.expense} format={(n) => formatINR(n)} />
            </p>
            <p className="mt-2 font-mono text-xs text-ink-soft">{data.financialYear.months.length}-month outflow</p>
          </div>
          <div className={`border p-5 shadow-[0_10px_24px_rgba(20,36,30,0.08)] ${data.financialYear.totals.profit >= 0 ? "border-mint/35 bg-gradient-to-b from-white/80 to-mint/5" : "border-coral/35 bg-gradient-to-b from-white/80 to-coral/5"}`}>
            <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">FY P/L</p>
            <p className={`mt-3 text-3xl font-bold number-tick ${data.financialYear.totals.profit >= 0 ? "text-mint" : "text-coral"}`}>
              <AnimatedNumber value={data.financialYear.totals.profit} format={(n) => formatINR(n)} />
            </p>
            <p className="mt-2 font-mono text-xs text-ink-soft">Net position</p>
          </div>
          <div className="border border-line bg-white/75 p-5 shadow-[0_10px_24px_rgba(20,36,30,0.05)]">
            <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">FY Trend</p>
            <p className="mt-2 font-mono text-sm text-ink-soft">
              Avg P/L {formatINR(data.financialYear.totals.averageMonthlyProfit)} / month
            </p>
            <p className="mt-2 text-sm text-mint">
              Best {data.financialYear.bestMonth.shortLabel}: {formatINR(data.financialYear.bestMonth.profit)}
            </p>
            <p className="mt-1 text-sm text-coral">
              Worst {data.financialYear.worstMonth.shortLabel}: {formatINR(data.financialYear.worstMonth.profit)}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-10 anim-rise-delay-2">
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="text-xl font-bold text-ink">Month on month profit / loss</h2>
          <p className="font-mono text-xs text-ink-soft">ledger view · {data.financialYear.selectedLabel}</p>
        </div>
        <MonthPnLGraph months={data.financialYear.months} />
      </section>

      {data.recurringTiles.length > 0 ? (
        <section className="mt-10 anim-rise-delay-2">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 className="text-xl font-bold text-ink">Upcoming recurring</h2>
            <p className="font-mono text-xs text-[#c45f12]">orange · click card to edit</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.recurringTiles.map((tile) => (
              <button
                key={tile.id}
                type="button"
                onClick={() => startRecurringEdit(tile)}
                className="border border-[#e67e22]/40 bg-[rgba(230,126,34,0.08)] p-3"
              >
                <p className="text-sm font-semibold text-ink">{tile.title}</p>
                <p className="mt-1 font-mono text-lg font-bold text-ink">
                  {formatINR(tile.amount)}
                </p>
                <p className="mt-1 font-mono text-[11px] text-[#c45f12]">
                  next {tile.nextDate}
                  {tile.daysLeft <= 30 ? ` · ${tile.daysLeft}d` : ""}
                </p>
                {tile.remarks ? (
                  <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{tile.remarks}</p>
                ) : null}
                <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-[#c45f12]">
                  edit and save
                </p>
              </button>
            ))}
          </div>

          {recurringSavedFlash ? (
            <p className="mt-3 inline-block border border-mint/40 bg-mint/10 px-3 py-1 font-mono text-xs text-mint">
              Saved to Expenses and next recurring updated.
            </p>
          ) : null}

          {recurringEdit ? (
            <form
              className="mt-4 border border-[#e67e22]/40 bg-[rgba(230,126,34,0.08)] p-4"
              onSubmit={saveRecurringEdit}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">Edit recurring entry</p>
                  <p className="text-xs text-ink-soft">{recurringEdit.title}</p>
                </div>
                <button
                  type="button"
                  className="text-xs text-ink-soft hover:text-ink"
                  onClick={() => {
                    setRecurringEdit(null);
                    setRecurringError(null);
                  }}
                >
                  Cancel
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <label className="block">
                  <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                    Debited date
                  </span>
                  <input
                    className="field"
                    type="date"
                    required
                    value={recurringEdit.date}
                    onChange={(e) =>
                      setRecurringEdit((current) =>
                        current ? { ...current, date: e.target.value } : current,
                      )
                    }
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                    Amount (₹)
                  </span>
                  <input
                    className="field"
                    type="number"
                    step="any"
                    required
                    value={recurringEdit.amount}
                    onChange={(e) =>
                      setRecurringEdit((current) =>
                        current ? { ...current, amount: e.target.value } : current,
                      )
                    }
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                    Next recurring date
                  </span>
                  <input
                    className="field"
                    type="date"
                    required
                    value={recurringEdit.nextDate}
                    onChange={(e) =>
                      setRecurringEdit((current) =>
                        current ? { ...current, nextDate: e.target.value } : current,
                      )
                    }
                  />
                </label>

                <label className="block md:col-span-4">
                  <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                    Remarks
                  </span>
                  <textarea
                    className="field min-h-20 resize-y"
                    value={recurringEdit.remarks}
                    onChange={(e) =>
                      setRecurringEdit((current) =>
                        current ? { ...current, remarks: e.target.value } : current,
                      )
                    }
                  />
                </label>
              </div>

              {recurringError ? <p className="mt-3 text-sm text-coral">{recurringError}</p> : null}

              <button
                type="submit"
                disabled={savingRecurring}
                className="btn-primary mt-4 px-4 py-2 text-sm disabled:opacity-60"
              >
                {savingRecurring ? "Saving..." : "Save recurring entry"}
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      <section className="mt-10 anim-rise-delay-2">
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="text-xl font-bold text-ink">Where money went</h2>
          <p className="font-mono text-xs text-ink-soft">
            hover or tap a tile · {data.monthLabel}
          </p>
        </div>
        {data.tiles.length === 0 ? (
          <p className="text-sm text-ink-soft">No expenses recorded for this month yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.tiles.map((tile) => {
              const isSelected = selectedLabel === tile.label;
              const showPopover =
                hoveredLabel === tile.label ||
                (hoveredLabel === null && isSelected);
              return (
                <button
                  key={tile.label}
                  type="button"
                  className={`tile-spend relative z-0 p-4 text-left ${
                    showPopover ? "z-40" : ""
                  } ${isSelected ? "border-mint" : ""}`}
                  onClick={() =>
                    setSelectedLabel((current) =>
                      current === tile.label ? null : tile.label,
                    )
                  }
                  onMouseEnter={() => setHoveredLabel(tile.label)}
                  onMouseLeave={() => setHoveredLabel(null)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-ink">{tile.label}</p>
                    <span className="font-mono text-[11px] text-ink-soft">{tile.share}%</span>
                  </div>
                  <p className="mt-3 text-2xl font-bold number-tick text-ink">
                    {formatINR(tile.amount)}
                  </p>
                  <div className="mt-3 h-1.5 w-full bg-paper-deep">
                    <div
                      className="h-full bg-mint"
                      style={{ width: `${Math.min(100, tile.share * 2.8)}%` }}
                    />
                  </div>
                  <p className="mt-2 font-mono text-[10px] text-ink-soft">
                    {tile.items.length} entr{tile.items.length === 1 ? "y" : "ies"}
                  </p>

                  {showPopover ? (
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl bg-[#14241e] p-4 text-left text-white shadow-[0_18px_40px_rgba(20,36,30,0.35)]">
                      <TilePopover tile={tile} />
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2 anim-rise-delay-3">
        <div>
          <h2 className="mb-4 text-xl font-bold text-ink">Renewals & reminders</h2>
          {data.renewals.length === 0 ? (
            <p className="text-sm text-ink-soft">No upcoming renewals in the next 45 days.</p>
          ) : (
            <ul className="space-y-2">
              {data.renewals.map((r) => (
                <li
                  key={r.id}
                  className={`border border-line bg-white/50 px-4 py-3 ${
                    r.recurring
                      ? "highlight-recurring"
                      : r.daysLeft <= 5
                        ? "highlight-renewal"
                        : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink">{r.title}</p>
                      <p className="font-mono text-xs text-ink-soft">
                        due {r.due}
                        {r.daysLeft <= 5 ? ` · ${r.daysLeft}d left` : ""}
                        {r.recurring ? " · recurring" : ""}
                      </p>
                      {r.remarks ? (
                        <p className="mt-1 text-sm text-ink-soft">{r.remarks}</p>
                      ) : null}
                    </div>
                    <p className="font-mono font-medium text-ink">{formatINR(r.amount)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="mb-4 text-xl font-bold text-ink">Recent with remarks</h2>
          {data.recent.length === 0 ? (
            <p className="text-sm text-ink-soft">No expenses yet — add one from Expenses.</p>
          ) : (
            <ul className="space-y-2">
              {data.recent.map((e) => (
                <li
                  key={e.id}
                  className={`border border-line bg-white/50 px-4 py-3 ${
                    e.recurring
                      ? "highlight-recurring"
                      : e.renewalDate
                        ? "highlight-renewal"
                        : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink">
                        {e.label}{" "}
                        <span className="font-mono text-xs font-normal text-ink-soft">
                          {e.date}
                        </span>
                      </p>
                      {e.remarks ? (
                        <p className="mt-1 text-sm text-ink-soft">{e.remarks}</p>
                      ) : null}
                    </div>
                    <p className="shrink-0 font-mono text-sm font-medium">
                      {formatINR(e.amount)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function MonthPnLGraph({
  months,
}: {
  months: Dash["financialYear"]["months"];
}) {
  const maxAbsProfit = Math.max(...months.map((month) => Math.abs(month.profit)), 1);
  const maxFlow = Math.max(...months.map((month) => Math.max(month.income, month.expense)), 1);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {months.map((month, index) => {
        const prev = index > 0 ? months[index - 1] : null;
        const delta = prev ? month.profit - prev.profit : null;
        const deltaLabel =
          delta === null ? "base" : delta > 0 ? `+${formatINR(delta)}` : formatINR(delta);
        const deltaTone = delta === null ? "text-ink-soft" : delta >= 0 ? "text-mint" : "text-coral";
        const bar = Math.max(6, Math.round((Math.abs(month.profit) / maxAbsProfit) * 100));
        const incomeBar = Math.max(8, Math.round((month.income / maxFlow) * 100));
        const expenseBar = Math.max(8, Math.round((month.expense / maxFlow) * 100));
        return (
          <div key={month.key} className="border border-line bg-white/80 p-4 shadow-[0_10px_24px_rgba(20,36,30,0.08)]">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-ink">{month.shortLabel}</p>
              <div className="text-right">
                <span
                  className={`block font-mono text-[10px] uppercase tracking-wide ${
                    month.status === "profit"
                      ? "text-mint"
                      : month.status === "loss"
                        ? "text-coral"
                        : "text-ink-soft"
                  }`}
                >
                  {month.status}
                </span>
                <span className={`mt-1 inline-block rounded-full border border-line/80 px-2 py-0.5 font-mono text-[10px] ${deltaTone}`}>
                  {deltaLabel}
                </span>
              </div>
            </div>
            <p className="mt-2 font-mono text-xs text-ink-soft">{month.label}</p>
            <div className="mt-3 h-2.5 w-full bg-paper-deep">
              <div
                className={month.status === "loss" ? "h-full bg-coral" : "h-full bg-mint"}
                style={{ width: `${bar}%` }}
              />
            </div>
            <p
              className={`mt-2 font-mono text-sm ${
                month.profit >= 0 ? "text-mint" : "text-coral"
              }`}
            >
              {formatINR(month.profit)}
            </p>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-7 shrink-0 font-mono text-[10px] text-mint">IN</span>
                <div className="h-1.5 flex-1 bg-paper-deep">
                  <div className="h-full bg-mint" style={{ width: `${incomeBar}%` }} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-7 shrink-0 font-mono text-[10px] text-coral">OUT</span>
                <div className="h-1.5 flex-1 bg-paper-deep">
                  <div className="h-full bg-coral" style={{ width: `${expenseBar}%` }} />
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-3 font-mono text-[11px]">
              <span className="text-mint">In {formatINR(month.income)}</span>
              <span className="text-ink-soft">·</span>
              <span className="text-coral">Out {formatINR(month.expense)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TilePopover({ tile }: { tile: Tile }) {
  return (
    <div>
      <p className="text-sm font-bold text-white">{tile.label}</p>
      <dl className="mt-3 space-y-1.5 font-mono text-[11px]">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-white/55">Share of spend</dt>
          <dd className="font-medium text-white">{tile.share}%</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-white/55">Total</dt>
          <dd className="font-medium text-white">{formatINR(tile.amount)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-white/55">Entries</dt>
          <dd className="font-medium text-white">{tile.items.length}</dd>
        </div>
      </dl>
      <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto border-t border-white/10 pt-3">
        {tile.items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 text-xs">
            <div className="min-w-0">
              <p className="font-mono text-[10px] text-white/45">{item.date}</p>
              <p className="truncate text-white/90">
                {item.remarks?.trim() ? item.remarks : tile.label}
                {item.recurring ? (
                  <span className="ml-1.5 font-mono text-[9px] text-[#f0a35a]">recurring</span>
                ) : null}
              </p>
            </div>
            <p className="shrink-0 font-mono font-medium text-white">{formatINR(item.amount)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: number;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className="border border-line bg-white/50 p-5">
      <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">{label}</p>
      <p className={`mt-3 text-3xl font-bold number-tick ${accent ? "text-mint" : "text-ink"}`}>
        <AnimatedNumber value={value} format={(n) => formatINR(n)} />
      </p>
      <p className="mt-2 font-mono text-xs text-ink-soft">{note}</p>
    </div>
  );
}
