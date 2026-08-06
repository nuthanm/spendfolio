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

type OverrideFormState = {
  sourceId: string;
  monthKey: string;
  amount: string;
};

const emptyForm = (): FormState => ({
  name: "",
  amount: "",
  recurring: true,
  cadence: "Monthly",
  nextDate: "",
  monthKey: currentMonthKey(),
});

const emptyOverrideForm = (): OverrideFormState => ({
  sourceId: "",
  monthKey: currentMonthKey(),
  amount: "",
});

function monthOptions() {
  const now = new Date();
  const options: { key: string; label: string }[] = [];
  for (let i = -18; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    options.push({ key, label: formatMonthLabel(key) });
  }
  return options.reverse();
}

export default function IncomePage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [overrideForm, setOverrideForm] = useState<OverrideFormState>(emptyOverrideForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const months = useMemo(() => monthOptions(), []);
  const recurringSources = useMemo(
    () => sources.filter((source) => source.recurring),
    [sources],
  );

  function refresh() {
    startTransition(async () => {
      const [nextSources, nextOverrides] = await Promise.all([
        listIncomeSources(),
        listIncomeOverrides(),
      ]);
      setSources(nextSources);
      setOverrides(nextOverrides);
      setOverrideForm((current) => {
        if (current.sourceId) return current;
        return {
          ...current,
          sourceId: nextSources.find((source) => source.recurring)?.id || "",
        };
      });
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  const recurringTotal = sources
    .filter((s) => s.recurring)
    .reduce((sum, s) => sum + s.amount, 0);

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

  function onSubmitOverride(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("sourceId", overrideForm.sourceId);
    fd.set("monthKey", overrideForm.monthKey);
    fd.set("amount", overrideForm.amount);

    startTransition(async () => {
      const res = await upsertIncomeOverride(fd);
      if (res?.error) {
        setOverrideError(res.error);
        return;
      }
      setOverrideError(null);
      setOverrideForm((current) => ({ ...current, amount: "" }));
      refresh();
    });
  }

  return (
    <AppShell
      title="Sources of income"
      subtitle="Recurring sources count every month. One-time income is tied to a specific month."
    >
      <div className="mb-6 border border-line bg-white/50 p-5 anim-rise">
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">
          Recurring monthly inflow
        </p>
        <p className="mt-2 text-3xl font-bold text-mint number-tick">
          {formatINR(recurringTotal)}
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          One-time entries only appear on their selected month in the dashboard.
        </p>
      </div>

      <section className="mb-8 border border-line bg-white/50 p-5 anim-rise-delay-1">
        <h2 className="text-lg font-bold text-ink">Month-wise recurring adjustments</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Override a recurring source amount for a specific month without changing other months.
        </p>

        {recurringSources.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">Add a recurring source first to set month-wise income.</p>
        ) : (
          <form className="mt-4 grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto]" onSubmit={onSubmitOverride}>
            <label className="block">
              <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                Source
              </span>
              <select
                className="field"
                required
                value={overrideForm.sourceId}
                onChange={(e) =>
                  setOverrideForm((state) => ({ ...state, sourceId: e.target.value }))
                }
              >
                <option value="" disabled>
                  Select source
                </option>
                {recurringSources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                Month
              </span>
              <select
                className="field"
                required
                value={overrideForm.monthKey}
                onChange={(e) =>
                  setOverrideForm((state) => ({ ...state, monthKey: e.target.value }))
                }
              >
                {months.map((month) => (
                  <option key={month.key} value={month.key}>
                    {month.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                Override amount (₹)
              </span>
              <input
                className="field"
                type="number"
                min="0"
                step="1"
                required
                value={overrideForm.amount}
                onChange={(e) =>
                  setOverrideForm((state) => ({ ...state, amount: e.target.value }))
                }
              />
            </label>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={pending}
                className="btn-secondary w-full px-4 py-3 text-sm font-medium disabled:opacity-60"
              >
                Save month value
              </button>
            </div>
          </form>
        )}

        {overrideError ? <p className="mt-3 text-sm text-coral">{overrideError}</p> : null}

        <ul className="mt-4 space-y-2">
          {overrides.map((item) => (
            <li key={item.id} className="border border-line bg-white/65 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink">
                  <span className="font-semibold">{item.sourceName}</span> · {item.monthLabel}
                </p>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-medium text-ink">
                    {formatINR(item.amount)}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-coral"
                    onClick={() =>
                      startTransition(async () => {
                        await deleteIncomeOverride(item.id);
                        refresh();
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
          {overrides.length === 0 ? (
            <li className="text-sm text-ink-soft">No month-wise overrides added yet.</li>
          ) : null}
        </ul>
      </section>

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
