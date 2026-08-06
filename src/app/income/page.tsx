"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AppShell } from "@/components/AppShell";
import {
  addIncomeSource,
  deleteIncomeOverride,
  deleteIncomeSource,
  listIncomeOverrides,
  listIncomeSources,
  upsertIncomeOverride,
  updateIncomeSource,
} from "@/lib/actions/income";
import { currentMonthKey, formatMonthLabel } from "@/lib/dates";
import { formatINR } from "@/lib/finance";

type Source = Awaited<ReturnType<typeof listIncomeSources>>[number];
type Override = Awaited<ReturnType<typeof listIncomeOverrides>>[number];

type FormState = {
  name: string;
  amount: string;
  recurring: boolean;
  cadence: string;
  nextDate: string;
  monthKey: string;
};

const emptyForm = (): FormState => ({
  name: "",
  amount: "",
  recurring: true,
  cadence: "Monthly",
  nextDate: "",
  monthKey: currentMonthKey(),
});

function monthOptions() {
  const now = new Date();
  const options: { key: string; label: string }[] = [];
  for (let i = -24; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    options.push({ key, label: formatMonthLabel(key) });
  }
  return options.reverse();
}

function monthKeyFromValue(value: string | Date | null | undefined) {
  if (!value) return null;
  return currentMonthKey(new Date(value));
}

export default function IncomePage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(currentMonthKey());
  const [monthDrafts, setMonthDrafts] = useState<Record<string, string>>({});
  const [monthError, setMonthError] = useState<string | null>(null);
  const months = useMemo(() => monthOptions(), []);
  const recurringSources = useMemo(
    () => sources.filter((source) => source.recurring),
    [sources],
  );
  const selectedMonthLabel = useMemo(() => formatMonthLabel(selectedMonthKey), [selectedMonthKey]);
  const selectedMonthOverrides = useMemo(
    () =>
      new Map(
        overrides
          .filter((override) => override.monthKey === selectedMonthKey)
          .map((override) => [override.sourceId, override]),
      ),
    [overrides, selectedMonthKey],
  );
  const selectedMonthRecurringTotal = useMemo(() => {
    return recurringSources.reduce((sum, source) => {
      const override = selectedMonthOverrides.get(source.id);
      const sourceStartMonth = monthKeyFromValue(source.createdAt);
      if (!override && sourceStartMonth && selectedMonthKey < sourceStartMonth) return sum;
      return sum + (override?.amount ?? source.amount);
    }, 0);
  }, [recurringSources, selectedMonthOverrides, selectedMonthKey]);
  const selectedMonthOneTimeTotal = useMemo(
    () =>
      sources
        .filter((source) => !source.recurring && source.monthKey === selectedMonthKey)
        .reduce((sum, source) => sum + source.amount, 0),
    [sources, selectedMonthKey],
  );
  const selectedMonthTotal = selectedMonthRecurringTotal + selectedMonthOneTimeTotal;

  function refresh() {
    startTransition(async () => {
      const [nextSources, nextOverrides] = await Promise.all([
        listIncomeSources(),
        listIncomeOverrides(),
      ]);
      setSources(nextSources);
      setOverrides(nextOverrides);
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  function startEdit(source: Source) {
    setEditingId(source.id);
    setForm({
      name: source.name,
      amount: String(source.amount),
      recurring: source.recurring,
      cadence: source.recurring ? source.cadence : "Monthly",
      nextDate: source.nextDate || "",
      monthKey: source.monthKey || currentMonthKey(),
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
  }

  function monthDraftKey(sourceId: string) {
    return `${sourceId}|${selectedMonthKey}`;
  }

  function getMonthValueForSource(source: Source) {
    const draft = monthDrafts[monthDraftKey(source.id)];
    if (draft !== undefined) return draft;

    const override = selectedMonthOverrides.get(source.id);
    if (override) return String(override.amount);

    const sourceStartMonth = monthKeyFromValue(source.createdAt);
    if (sourceStartMonth && selectedMonthKey < sourceStartMonth) return "0";

    return String(source.amount);
  }

  function commitMonthValue(source: Source) {
    const rawAmount = getMonthValueForSource(source).trim();
    if (!rawAmount) {
      setMonthError("Enter an amount for the selected month.");
      return;
    }

    const amount = Number(rawAmount);
    if (!(amount >= 0)) {
      setMonthError("Amount must be zero or more.");
      return;
    }

    const fd = new FormData();
    fd.set("sourceId", source.id);
    fd.set("monthKey", selectedMonthKey);
    fd.set("amount", String(amount));

    startTransition(async () => {
      const res = await upsertIncomeOverride(fd);
      if (res?.error) {
        setMonthError(res.error);
        return;
      }
      setMonthError(null);
      refresh();
    });
  }

  function removeMonthValue(source: Source) {
    const override = selectedMonthOverrides.get(source.id);
    if (!override) return;

    startTransition(async () => {
      await deleteIncomeOverride(override.id);
      setMonthError(null);
      refresh();
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("name", form.name);
    fd.set("amount", form.amount);
    fd.set("recurring", form.recurring ? "true" : "false");
    fd.set("cadence", form.cadence);
    fd.set("nextDate", form.nextDate);
    fd.set("monthKey", form.monthKey);

    startTransition(async () => {
      const res = editingId
        ? await updateIncomeSource(editingId, fd)
        : await addIncomeSource(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setError(null);
      cancelEdit();
      refresh();
    });
  }

  return (
    <AppShell
      title="Sources of income"
      subtitle="Recurring sources count every month. One-time income is tied to a specific month."
    >
      <div className="mb-6 border border-line bg-white/50 p-5 anim-rise">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">
              Month view
            </p>
            <p className="mt-2 text-3xl font-bold text-mint number-tick">
              {formatINR(selectedMonthTotal)}
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              {selectedMonthLabel} · Recurring {formatINR(selectedMonthRecurringTotal)} · One-time {formatINR(selectedMonthOneTimeTotal)}
            </p>
          </div>
          <label className="block min-w-52">
            <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
              Month
            </span>
            <select
              className="field"
              value={selectedMonthKey}
              onChange={(e) => setSelectedMonthKey(e.target.value)}
            >
              {months.map((month) => (
                <option key={month.key} value={month.key}>
                  {month.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-sm text-ink-soft">
          Use the selected month to review past or future values, then save or remove the month-specific amount inline on each recurring source.
        </p>
        {selectedMonthTotal === 0 ? (
          <p className="mt-2 text-sm text-coral">
            This month has no income recorded yet, so the total is 0 until you add or override a value.
          </p>
        ) : null}
        {monthError ? <p className="mt-3 text-sm text-coral">{monthError}</p> : null}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <ul className="space-y-2 anim-rise-delay-2">
          {sources.map((s) => (
            <li key={s.id} className="border border-line bg-white/50 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">{s.name}</p>
                  <p className="mt-1 font-mono text-xs text-ink-soft">
                    {s.recurring ? (
                      <>
                        Recurring · {s.cadence}
                        {s.nextDate ? ` · next ${s.nextDate}` : ""}
                      </>
                    ) : (
                      <>
                        One-time ·{" "}
                        {s.monthKey ? formatMonthLabel(s.monthKey) : "no month"}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-mono text-lg font-semibold">{formatINR(s.amount)}</p>
                  <button
                    type="button"
                    className="text-xs text-mint"
                    onClick={() => startEdit(s)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-xs text-coral"
                    onClick={() =>
                      startTransition(async () => {
                        await deleteIncomeSource(s.id);
                        if (editingId === s.id) cancelEdit();
                        refresh();
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>

              {s.recurring ? (
                <div className="mt-4 border-t border-line pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                        {selectedMonthLabel}
                      </p>
                      <p className="mt-1 text-sm text-ink-soft">
                        {selectedMonthOverrides.get(s.id)
                          ? "Saved override for this month."
                          : monthKeyFromValue(s.createdAt) && selectedMonthKey < monthKeyFromValue(s.createdAt)!
                            ? "This month is before the source started. Save an override to backfill it."
                            : "Changes here only affect the selected month."}
                      </p>
                    </div>
                    <p className="font-mono text-sm font-semibold text-ink">
                      {formatINR(
                        (() => {
                          const override = selectedMonthOverrides.get(s.id);
                          const sourceStartMonth = monthKeyFromValue(s.createdAt);
                          if (!override && sourceStartMonth && selectedMonthKey < sourceStartMonth) return 0;
                          return override?.amount ?? s.amount;
                        })(),
                      )}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <label className="block min-w-52 flex-1">
                      <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                        Month value (₹)
                      </span>
                      <input
                        className="field"
                        type="number"
                        min="0"
                        step="1"
                        value={getMonthValueForSource(s)}
                        onChange={(e) => {
                          const key = monthDraftKey(s.id);
                          setMonthDrafts((state) => ({ ...state, [key]: e.target.value }));
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      disabled={pending}
                      className="btn-secondary px-4 py-3 text-sm font-medium disabled:opacity-60"
                      onClick={() => commitMonthValue(s)}
                    >
                      Save month value
                    </button>

                    {selectedMonthOverrides.get(s.id) ? (
                      <button
                        type="button"
                        className="text-xs text-coral"
                        onClick={() => removeMonthValue(s)}
                      >
                        Remove month value
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </li>
          ))}
          {sources.length === 0 ? (
            <li className="text-sm text-ink-soft">No income sources yet.</li>
          ) : null}
        </ul>

        <form
          className="border border-line bg-white/50 p-5 anim-rise-delay-3"
          onSubmit={onSubmit}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-ink">
              {editingId ? "Edit income source" : "Add income source"}
            </h2>
            {editingId ? (
              <button
                type="button"
                className="text-xs text-ink-soft hover:text-ink"
                onClick={cancelEdit}
              >
                Cancel
              </button>
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                Name
              </span>
              <input
                className="field"
                required
                placeholder="e.g. Consulting retainer"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>

            <label className="block">
              <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                Amount (₹)
              </span>
              <input
                className="field"
                type="number"
                min="0"
                step="1"
                required
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </label>

            <fieldset>
              <legend className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                Type
              </legend>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`border px-3 py-2 text-sm ${
                    form.recurring
                      ? "border-mint bg-mint/10 text-mint"
                      : "border-line text-ink-soft"
                  }`}
                  onClick={() => setForm((f) => ({ ...f, recurring: true }))}
                >
                  Recurring (every month)
                </button>
                <button
                  type="button"
                  className={`border px-3 py-2 text-sm ${
                    !form.recurring
                      ? "border-mint bg-mint/10 text-mint"
                      : "border-line text-ink-soft"
                  }`}
                  onClick={() => setForm((f) => ({ ...f, recurring: false }))}
                >
                  One-time
                </button>
              </div>
            </fieldset>

            {form.recurring ? (
              <>
                <label className="block">
                  <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                    Cadence
                  </span>
                  <select
                    className="field"
                    value={form.cadence}
                    onChange={(e) => setForm((f) => ({ ...f, cadence: e.target.value }))}
                  >
                    <option>Monthly</option>
                    <option>Weekly</option>
                    <option>Variable</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                    Next date
                  </span>
                  <input
                    className="field"
                    type="date"
                    value={form.nextDate}
                    onChange={(e) => setForm((f) => ({ ...f, nextDate: e.target.value }))}
                  />
                </label>
              </>
            ) : (
              <label className="block">
                <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                  Month
                </span>
                <select
                  className="field"
                  required
                  value={form.monthKey}
                  onChange={(e) => setForm((f) => ({ ...f, monthKey: e.target.value }))}
                >
                  {months.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {error ? <p className="text-sm text-coral">{error}</p> : null}
            <button
              type="submit"
              disabled={pending}
              className="btn-primary w-full py-3 text-sm font-medium disabled:opacity-60"
            >
              {editingId ? "Save changes" : "Add source"}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
