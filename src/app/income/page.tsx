"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AppShell } from "@/components/AppShell";
import {
  addIncomeSource,
  deleteIncomeSource,
  listIncomeSources,
  updateIncomeSource,
} from "@/lib/actions/income";
import { currentMonthKey, formatMonthLabel } from "@/lib/dates";
import { formatINR } from "@/lib/finance";

type Source = Awaited<ReturnType<typeof listIncomeSources>>[number];

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
  for (let i = -18; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    options.push({ key, label: formatMonthLabel(key) });
  }
  return options.reverse();
}

export default function IncomePage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const months = useMemo(() => monthOptions(), []);

  function refresh() {
    startTransition(async () => {
      setSources(await listIncomeSources());
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

      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <ul className="space-y-2 anim-rise-delay-1">
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
          className="border border-line bg-white/50 p-5 anim-rise-delay-2"
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
