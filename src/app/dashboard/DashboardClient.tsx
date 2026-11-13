"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { DATA_CHANGED_EVENT } from "@/components/QuickAddSheet";
import { Badge, Card, CardHeader, MiniStat, ProgressBar, type Tone } from "@/components/ui";
import { CloseIcon } from "@/components/icons";
import { getDashboardData } from "@/lib/actions/dashboard";
import { recordRecurringDebit } from "@/lib/actions/expenses";
import { OutflowChart } from "@/components/OutflowChart";
import { formatINR } from "@/lib/finance";

type Dash = Awaited<ReturnType<typeof getDashboardData>>;
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

const STATUS_TONE: Record<Dash["health"]["status"], Tone> = {
  safe: "safe",
  tight: "tight",
  debt: "debt",
};

const STATUS_LABEL: Record<Dash["health"]["status"], string> = {
  safe: "On track",
  tight: "Tight",
  debt: "Over budget",
};

function previousMonthKey(key: string) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysLeftInCurrentMonth() {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return last - now.getDate() + 1;
}

export default function DashboardClient({
  readOnly = false,
  initialData = null,
  viewBasePath,
}: {
  readOnly?: boolean;
  initialData?: Dash | null;
  viewBasePath?: string;
} = {}) {
  const search = useSearchParams();
  const router = useRouter();
  const initialMonth = search.get("month") || undefined;
  const initialFy = search.get("fy") || undefined;
  const [fetched, setData] = useState<Dash | null>(null);
  // The shared read-only view is handed its data; signed-in owners fetch it here.
  const data = readOnly ? initialData : fetched;
  const [pending, startTransition] = useTransition();
  const [reloadKey, setReloadKey] = useState(0);
  const [recurringEdit, setRecurringEdit] = useState<RecurringEditState | null>(null);
  const [recurringSavedFlash, setRecurringSavedFlash] = useState(false);

  useEffect(() => {
    if (readOnly) {
      if (!initialData && process.env.NODE_ENV === "development") {
        console.warn("DashboardClient: readOnly is set without initial summary data.");
      }
      return undefined;
    }
    let active = true;
    startTransition(async () => {
      const d = await getDashboardData(initialMonth, initialFy);
      if (!active) return;
      setData(d);
    });
    return () => {
      active = false;
    };
  }, [readOnly, initialData, initialMonth, initialFy, reloadKey]);

  useEffect(() => {
    if (readOnly) return undefined;
    const onChanged = () => setReloadKey((key) => key + 1);
    window.addEventListener(DATA_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, onChanged);
  }, [readOnly]);

  function startRecurringEdit(tile: RecurringTile) {
    if (readOnly) return;
    setRecurringEdit({
      id: tile.id,
      title: tile.title,
      amount: String(tile.amount),
      date: tile.date,
      nextDate: tile.nextDate,
      remarks: tile.remarks || "",
      customFields: tile.customFields || "{}",
    });
  }

  function pushDashboardQuery(next: { month?: string; fy?: string }) {
    const params = new URLSearchParams(search.toString());
    if (next.month) params.set("month", next.month);
    else params.delete("month");
    if (next.fy) params.set("fy", next.fy);
    else params.delete("fy");
    const base = viewBasePath || "/dashboard";
    router.push(`${base}?${params.toString()}`);
  }

  if (!data) {
    if (readOnly) {
      return <p className="font-mono text-sm text-ink-soft">No summary for this view.</p>;
    }
    return (
      <AppShell title="Home" subtitle="Loading your monthly math…">
        <p className="font-mono text-sm text-ink-soft">Calculating…</p>
      </AppShell>
    );
  }

  const recurringById = new Map(data.recurringTiles.map((tile) => [tile.id, tile]));

  const dashboard = (
    <div className="flex flex-col gap-5">
      {readOnly ? <h2 className="text-xl font-bold text-ink">Summaries</h2> : null}

      <PeriodPicker data={data} pending={pending} onChange={pushDashboardQuery} />

      <BufferHero data={data} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <WhereItWent data={data} />
        <ComingUp
          data={data}
          readOnly={readOnly}
          onEditRecurring={(id) => {
            const tile = recurringById.get(id);
            if (tile) startRecurringEdit(tile);
          }}
          savedFlash={recurringSavedFlash}
        />
        <VersusLastMonth data={data} />
      </div>

      <HouseSummary data={data} />

      <RecentWithRemarks data={data} readOnly={readOnly} />

      <YearView data={data} />

      {!readOnly ? (
        <RecurringEditDialog
          edit={recurringEdit}
          onChange={setRecurringEdit}
          onClose={() => setRecurringEdit(null)}
          onSaved={async () => {
            const refreshed = await getDashboardData(initialMonth, initialFy);
            setData(refreshed);
            setRecurringEdit(null);
            setRecurringSavedFlash(true);
            setTimeout(() => setRecurringSavedFlash(false), 2400);
          }}
        />
      ) : null}
    </div>
  );

  if (readOnly) return dashboard;
  return (
    <AppShell title="Home" subtitle={data.isCurrent ? undefined : `Looking back at ${data.monthLabel}`}>
      {dashboard}
    </AppShell>
  );
}

function PeriodPicker({
  data,
  pending,
  onChange,
}: {
  data: Dash;
  pending: boolean;
  onChange: (next: { month?: string; fy?: string }) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2">
        <span className="whitespace-nowrap text-sm text-ink-soft">Month</span>
        <select
          className="field w-auto rounded-xl py-2"
          value={data.monthKey}
          disabled={pending}
          onChange={(e) =>
            onChange({ month: e.target.value, fy: String(data.financialYear.selectedStartYear) })
          }
        >
          {data.months.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <span className="whitespace-nowrap text-sm text-ink-soft">Financial year</span>
        <select
          className="field w-auto rounded-xl py-2"
          value={String(data.financialYear.selectedStartYear)}
          disabled={pending}
          onChange={(e) => onChange({ month: data.monthKey, fy: e.target.value })}
        >
          {data.financialYear.options.map((fy) => (
            <option key={fy.startYear} value={fy.startYear}>
              {fy.label}
            </option>
          ))}
        </select>
      </label>
      {pending ? <span className="text-sm text-ink-soft">Updating…</span> : null}
    </div>
  );
}

function BufferHero({ data }: { data: Dash }) {
  const { health, incomeTotal, expenseTotal, isCurrent, monthLabel } = data;
  const tone = STATUS_TONE[health.status];
  const spentPct = Math.round(health.ratio * 100);
  const daysLeft = isCurrent ? daysLeftInCurrentMonth() : 0;
  const perDay = isCurrent && health.balance > 0 ? health.balance / daysLeft : 0;

  return (
    <Card className="anim-rise p-5 md:p-7" labelledBy="buffer-heading">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
        <div className="flex min-w-0 flex-[2] flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 id="buffer-heading" className="font-sans text-sm font-medium text-ink-soft">
              Buffer {isCurrent ? "this month" : `in ${monthLabel}`}
            </h2>
            <Badge tone={tone}>{STATUS_LABEL[health.status]}</Badge>
          </div>
          <p
            className={`font-display text-5xl font-extrabold leading-none tracking-tight md:text-6xl ${
              health.balance < 0 ? "text-coral" : "text-ink"
            }`}
          >
            <AnimatedNumber value={health.balance} duration={700} format={(n) => formatINR(n)} />
          </p>
          <p className="font-mono text-xs text-ink-soft">income − expenses</p>
          <div className="mt-1 flex flex-col gap-1.5">
            <ProgressBar value={spentPct} tone={tone} label="Share of income spent" />
            <div className="flex flex-wrap justify-between gap-x-4 text-sm text-ink-soft">
              <span>{spentPct}% of income spent</span>
              {isCurrent ? <span>{daysLeft} {daysLeft === 1 ? "day" : "days"} left</span> : null}
            </div>
          </div>
          {perDay > 0 ? (
            <p className="text-sm text-ink-soft">
              You can spend <strong className="font-semibold text-ink">{formatINR(perDay)} a day</strong> and
              still end the month in the green.
            </p>
          ) : health.balance < 0 ? (
            <p className="text-sm text-ink-soft">
              Expenses are <strong className="font-semibold text-ink">{formatINR(-health.balance)}</strong> more than
              income.
            </p>
          ) : null}
        </div>
        <div className="grid flex-1 grid-cols-2 content-start gap-3">
          <MiniStat label="Income" value={formatINR(incomeTotal)} note="all sources" />
          <MiniStat label="Spent" value={formatINR(expenseTotal)} note={isCurrent ? "so far" : "this month"} />
        </div>
      </div>
    </Card>
  );
}

function WhereItWent({ data }: { data: Dash }) {
  const [showAll, setShowAll] = useState(false);
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const tiles = showAll ? data.tiles : data.tiles.slice(0, 5);

  return (
    <Card className="anim-rise-delay-1" labelledBy="where-heading">
      <CardHeader
        id="where-heading"
        title="Where it went"
        action={
          data.tiles.length > 5 ? (
            <button
              type="button"
              className="min-h-10 text-sm font-medium text-mint hover:underline"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? "Top 5" : `All ${data.tiles.length}`}
            </button>
          ) : null
        }
      />
      {data.tiles.length === 0 ? (
        <p className="text-sm text-ink-soft">No expenses recorded for {data.monthLabel} yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {tiles.map((tile) => {
            const open = openLabel === tile.label;
            return (
              <li key={tile.label}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenLabel(open ? null : tile.label)}
                  className="flex w-full flex-col gap-1.5 rounded-lg py-2 text-left hover:bg-paper-deep/40"
                >
                  <span className="flex w-full justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-ink">{tile.label}</span>
                    <span className="shrink-0 font-mono text-ink-soft">
                      {formatINR(tile.amount)} · {tile.share}%
                    </span>
                  </span>
                  <ProgressBar value={tile.share} size="sm" label={`${tile.label} share of spending`} />
                </button>
                {open ? (
                  <ul className="mb-2 mt-1 flex flex-col gap-1.5 rounded-lg bg-paper-deep/40 p-3">
                    {tile.items.map((item) => (
                      <li key={item.id} className="flex items-start justify-between gap-3 text-xs">
                        <span className="min-w-0">
                          <span className="block font-mono text-ink-soft">{item.date}</span>
                          <span className="block truncate text-ink">
                            {item.remarks?.trim() ? item.remarks : tile.label}
                            {item.recurring ? <span className="ml-1.5 text-warn">recurring</span> : null}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono font-medium text-ink">{formatINR(item.amount)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function ComingUp({
  data,
  readOnly,
  onEditRecurring,
  savedFlash,
}: {
  data: Dash;
  readOnly: boolean;
  onEditRecurring: (id: string) => void;
  savedFlash: boolean;
}) {
  const items = data.renewals.slice(0, 6);
  return (
    <Card className="anim-rise-delay-1" labelledBy="coming-heading">
      <CardHeader id="coming-heading" title="Coming up" />
      {savedFlash ? (
        <p role="status" className="mb-2 rounded-lg bg-mint-bright/15 px-3 py-2 text-sm text-mint">
          Recorded in Expenses. Next date updated.
        </p>
      ) : null}
      {items.length === 0 ? (
        <p className="text-sm text-ink-soft">Nothing due in the next 45 days.</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((r) => {
            const urgent = r.daysLeft <= 5;
            const editable = !readOnly && r.recurring;
            const when =
              r.daysLeft === 0 ? "Today" : r.daysLeft === 1 ? "Tomorrow" : `in ${r.daysLeft} days`;
            const body = (
              <>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{r.title}</span>
                  <span className={`block text-xs ${urgent ? "text-warn" : "text-ink-soft"}`}>
                    {r.due} · {when}
                    {r.recurring ? " · monthly" : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-sm text-ink">{formatINR(r.amount)}</span>
                  {editable ? <span className="block text-xs font-medium text-mint">Record</span> : null}
                </span>
              </>
            );
            return (
              <li key={r.id} className="border-t border-line first:border-t-0">
                {editable ? (
                  <button
                    type="button"
                    onClick={() => onEditRecurring(r.id)}
                    className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-paper-deep/40"
                  >
                    {body}
                  </button>
                ) : (
                  <div className="flex items-center justify-between gap-3 py-2.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function VersusLastMonth({ data }: { data: Dash }) {
  const prevKey = previousMonthKey(data.monthKey);
  const prev = data.financialYear.months.find((m) => m.key === prevKey);
  const months = data.financialYear.months.slice(-6);
  const maxSpend = Math.max(1, ...months.map((m) => m.expense));

  return (
    <Card className="anim-rise-delay-2" labelledBy="vs-heading">
      <CardHeader id="vs-heading" title="Compared with last month" />
      {prev ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-ink-soft">
            {prev.label}: <span className="font-mono text-ink">{formatINR(prev.expense)}</span> spent
          </p>
          <p className="text-sm text-ink-soft">
            {data.isCurrent ? "This month so far" : data.monthLabel}:{" "}
            <span className="font-mono text-ink">{formatINR(data.expenseTotal)}</span>
          </p>
          <div className="mt-1">
            {data.expenseTotal === prev.expense ? null : data.expenseTotal < prev.expense ? (
              <Badge tone="safe">{formatINR(prev.expense - data.expenseTotal)} less</Badge>
            ) : (
              <Badge tone="tight">{formatINR(data.expenseTotal - prev.expense)} more</Badge>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-soft">No data for the previous month in this financial year.</p>
      )}
      {months.length > 1 ? (
        <figure className="mt-4">
          <div
            role="img"
            aria-label={`Spending by month: ${months.map((m) => `${m.shortLabel} ${formatINR(m.expense)}`).join(", ")}`}
            className="flex h-24 items-end gap-2"
          >
            {months.map((m) => (
              <div key={m.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <div
                  className={`w-full max-w-7 rounded-t-md ${m.key === data.monthKey ? "bg-mint-bright" : "bg-paper-deep"}`}
                  style={{ height: `${Math.max(4, Math.round((m.expense / maxSpend) * 100))}%` }}
                />
                <span className="text-[11px] text-ink-soft">{m.shortLabel}</span>
              </div>
            ))}
          </div>
          <figcaption className="sr-only">Monthly spending, last {months.length} months</figcaption>
        </figure>
      ) : null}
    </Card>
  );
}

function HouseSummary({ data }: { data: Dash }) {
  const { house } = data;
  if (!(house.currentMonthExpenses > 0 || house.totalExpenses > 0 || house.loanInfo.sanctioned > 0)) return null;
  return (
    <Card labelledBy="house-heading">
      <CardHeader id="house-heading" title="House" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {house.currentMonthExpenses > 0 ? (
          <MiniStat label="This month" value={formatINR(house.currentMonthExpenses)} />
        ) : null}
        {house.totalExpenses > 0 ? <MiniStat label="All months" value={formatINR(house.totalExpenses)} /> : null}
        {house.loanInfo.sanctioned > 0 ? (
          <MiniStat
            label="Loan outstanding"
            value={formatINR(house.loanInfo.outstanding)}
            note={`${house.loanInfo.percentagePending}% of ${formatINR(house.loanInfo.sanctioned)}`}
          />
        ) : null}
        {house.loanInfo.emorTotal > 0 ? (
          <MiniStat
            label="EMIs remaining"
            value={`${house.loanInfo.emorOutstanding} / ${house.loanInfo.emorTotal}`}
            note="months"
          />
        ) : null}
      </div>
    </Card>
  );
}

function RecentWithRemarks({ data, readOnly }: { data: Dash; readOnly: boolean }) {
  return (
    <Card labelledBy="recent-heading">
      <CardHeader id="recent-heading" title="Recent expenses" />
      {data.recent.length === 0 ? (
        <p className="text-sm text-ink-soft">
          {readOnly ? "No expenses yet." : "No expenses yet. Tap + to add your first one."}
        </p>
      ) : (
        <ul className="flex flex-col">
          {data.recent.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 border-t border-line py-2.5 first:border-t-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  {e.label}
                  <span className="ml-2 font-mono text-xs font-normal text-ink-soft">{e.date}</span>
                  {e.recurring ? <span className="ml-2 text-xs text-warn">monthly</span> : null}
                </p>
                {e.remarks ? <p className="mt-0.5 text-sm text-ink-soft">{e.remarks}</p> : null}
              </div>
              <p className="shrink-0 font-mono text-sm font-medium text-ink">{formatINR(e.amount)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** The financial-year detail, kept but folded away so the month comes first. */
function YearView({ data }: { data: Dash }) {
  const fy = data.financialYear;
  return (
    <details className="group rounded-2xl border border-line bg-white/50">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3">
        <span>
          <span className="block font-display text-base font-semibold text-ink">{fy.selectedLabel} at a glance</span>
          <span className="block text-sm text-ink-soft">
            Net {formatINR(fy.totals.profit)} over {fy.months.length} months · tap to{" "}
            <span className="group-open:hidden">open</span>
            <span className="hidden group-open:inline">close</span>
          </span>
        </span>
        <span aria-hidden="true" className="text-xl text-ink-soft transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="flex flex-col gap-6 border-t border-line px-5 pb-6 pt-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniStat label="Income" value={formatINR(fy.totals.income)} note={`${fy.months.length} months`} />
          <MiniStat label="Expenses" value={formatINR(fy.totals.expense)} note={`${fy.months.length} months`} />
          <MiniStat label="Net" value={formatINR(fy.totals.profit)} note={`avg ${formatINR(fy.totals.averageMonthlyProfit)} / month`} />
          <MiniStat
            label="Best / worst"
            value={fy.bestMonth.shortLabel + " / " + fy.worstMonth.shortLabel}
            note={`${formatINR(fy.bestMonth.profit)} / ${formatINR(fy.worstMonth.profit)}`}
          />
        </div>
        <OutflowChart analysis={data.outflow} periodLabel={fy.selectedLabel} />
        <div>
          <h3 className="mb-3 text-base font-semibold text-ink">Month by month</h3>
          <MonthPnLGraph months={fy.months} />
        </div>
      </div>
    </details>
  );
}

function RecurringEditDialog({
  edit,
  onChange,
  onClose,
  onSaved,
}: {
  edit: RecurringEditState | null;
  onChange: (next: RecurringEditState | null) => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (edit && !dialog.open) dialog.showModal();
    else if (!edit && dialog.open) dialog.close();
  }, [edit]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    const fd = new FormData();
    fd.set("date", edit.date);
    fd.set("label", edit.title.trim());
    fd.set("amount", edit.amount);
    fd.set("remarks", edit.remarks);
    fd.set("recurring", "true");
    fd.set("renewalDate", edit.nextDate);
    fd.set("customFields", edit.customFields || "{}");
    setSaving(true);
    setError(null);
    const res = await recordRecurringDebit(edit.id, fd);
    if (res?.error) {
      setError(res.error);
      setSaving(false);
      return;
    }
    await onSaved();
    setSaving(false);
  }

  const set = (patch: Partial<RecurringEditState>) => edit && onChange({ ...edit, ...patch });

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onClose={() => {
        setError(null);
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {edit ? (
        <form onSubmit={save} className="flex flex-col gap-4 p-5 pb-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={titleId} className="text-lg font-semibold">
                Record {edit.title}
              </h2>
              <p className="text-sm text-ink-soft">Adds this month&apos;s payment to Expenses and moves the next date.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-paper-deep"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-soft">Paid on</span>
              <input className="field rounded-xl" type="date" required value={edit.date} onChange={(e) => set({ date: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-soft">Amount (₹)</span>
              <input
                className="field rounded-xl"
                type="number"
                step="any"
                inputMode="decimal"
                required
                value={edit.amount}
                onChange={(e) => set({ amount: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm text-ink-soft">Next date</span>
              <input className="field rounded-xl" type="date" required value={edit.nextDate} onChange={(e) => set({ nextDate: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm text-ink-soft">Remarks</span>
              <textarea className="field min-h-20 resize-y rounded-xl" value={edit.remarks} onChange={(e) => set({ remarks: e.target.value })} />
            </label>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-coral">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={saving} className="btn-primary min-h-12 rounded-2xl text-base font-semibold disabled:opacity-60">
            {saving ? "Saving…" : "Record payment"}
          </button>
        </form>
      ) : null}
    </dialog>
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <div key={month.key} className="min-w-0 rounded-xl border border-line bg-white/70 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-ink">{month.shortLabel}</p>
              <div className="min-w-0 text-right">
                <span
                  className={`block text-xs font-medium ${
                    month.status === "profit"
                      ? "text-mint"
                      : month.status === "loss"
                        ? "text-coral"
                        : "text-ink-soft"
                  }`}
                >
                  {month.status === "profit" ? "Saved" : month.status === "loss" ? "Overspent" : "Even"}
                </span>
                <span className={`mt-1 inline-block max-w-full whitespace-nowrap rounded-full border border-line/80 px-2 py-0.5 font-mono text-[11px] ${deltaTone}`}>
                  {deltaLabel}
                </span>
              </div>
            </div>
            <div className="mt-3 h-2.5 w-full rounded-full bg-paper-deep">
              <div
                className={`h-full rounded-full ${month.status === "loss" ? "bg-coral" : "bg-mint-bright"}`}
                style={{ width: `${bar}%` }}
              />
            </div>
            <p
              className={`mt-2 whitespace-nowrap font-mono text-sm ${
                month.profit >= 0 ? "text-mint" : "text-coral"
              }`}
            >
              {formatINR(month.profit)}
            </p>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-8 shrink-0 text-[11px] text-ink-soft">In</span>
                <div className="h-1.5 flex-1 rounded-full bg-paper-deep">
                  <div className="h-full rounded-full bg-mint-bright" style={{ width: `${incomeBar}%` }} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-8 shrink-0 text-[11px] text-ink-soft">Out</span>
                <div className="h-1.5 flex-1 rounded-full bg-paper-deep">
                  <div className="h-full rounded-full bg-coral" style={{ width: `${expenseBar}%` }} />
                </div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-ink-soft">
              <span className="whitespace-nowrap">In {formatINR(month.income)}</span>
              <span>·</span>
              <span className="whitespace-nowrap">Out {formatINR(month.expense)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
