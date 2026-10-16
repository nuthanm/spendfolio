"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import {
  addExpense,
  addFieldDef,
  deleteExpense,
  listExpenses,
  listFieldDefs,
  removeFieldDef,
  updateExpense,
} from "@/lib/actions/expenses";
import { DEFAULT_EXPENSE_LABELS, formatINR } from "@/lib/finance";
import { currentMonthKey, formatMonthLabel } from "@/lib/dates";

type Expense = Awaited<ReturnType<typeof listExpenses>>[number];
type FieldDef = Awaited<ReturnType<typeof listFieldDefs>>[number];

type FormState = {
  date: string;
  label: string;
  customLabel: string;
  amount: string;
  remarks: string;
  recurring: boolean;
  renewalDate: string;
};

const emptyForm = (): FormState => ({
  date: new Date().toISOString().slice(0, 10),
  label: "Lunch",
  customLabel: "",
  amount: "",
  remarks: "",
  recurring: false,
  renewalDate: "",
});

function isPresetLabel(label: string) {
  return (DEFAULT_EXPENSE_LABELS as readonly string[]).includes(label);
}

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

export default function ExpensesClient({
  readOnly = false,
  initialExpenses,
  initialFieldDefs,
  viewToken,
}: {
  readOnly?: boolean;
  initialExpenses?: Expense[];
  initialFieldDefs?: FieldDef[];
  viewToken?: string;
}) {
  const seeded = Array.isArray(initialExpenses);
  const [rows, setRows] = useState<Expense[]>(seeded ? initialExpenses : []);
  const [defs, setDefs] = useState<FieldDef[]>(
    Array.isArray(initialFieldDefs) ? initialFieldDefs : [],
  );
  const [loading, setLoading] = useState(!seeded && !readOnly);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [customValues, setCustomValues] = useState<Record<string, string | boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [selectedMonthKey, setSelectedMonthKey] = useState(() => currentMonthKey());
  const [loadedMonthKey, setLoadedMonthKey] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const months = useMemo(() => monthOptions(), []);
  const selectedMonthLabel = useMemo(
    () => formatMonthLabel(selectedMonthKey),
    [selectedMonthKey],
  );
  const monthReady = readOnly || (loadedMonthKey === selectedMonthKey && !loading);
  const monthRows = useMemo(() => {
    if (!monthReady) return [];
    if (readOnly) return rows.filter((row) => row.monthKey === selectedMonthKey);
    return rows;
  }, [monthReady, readOnly, rows, selectedMonthKey]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return monthRows;

    const digits = q.replace(/[^\d.]/g, "");

    return monthRows.filter((e) => {
      const haystack = [
        e.label,
        e.remarks,
        e.date,
        e.renewalDate,
        e.recurring ? "recurring" : "",
        formatINR(e.amount),
        String(e.amount),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (haystack.includes(q)) return true;
      if (digits && String(e.amount).includes(digits)) return true;
      return false;
    });
  }, [monthRows, query]);

  function refresh() {
    setReloadKey((key) => key + 1);
  }

  useEffect(() => {
    if (readOnly && !seeded && process.env.NODE_ENV === "development") {
      console.warn("ExpensesClient: readOnly is set without initial expenses.");
    }
  }, [readOnly, seeded]);

  useEffect(() => {
    if (seeded || readOnly) return undefined;
    let active = true;
    setLoading(true);
    startTransition(async () => {
      const [e, f] = await Promise.all([listExpenses(selectedMonthKey), listFieldDefs()]);
      if (!active) return;
      setRows(e);
      setDefs(f);
      setLoadedMonthKey(selectedMonthKey);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [seeded, readOnly, selectedMonthKey, reloadKey]);

  const monthTotal = useMemo(
    () => monthRows.reduce((sum, row) => sum + row.amount, 0),
    [monthRows],
  );

  function startEdit(expense: Expense) {
    const preset = isPresetLabel(expense.label);
    setEditingId(expense.id);
    setForm({
      date: expense.date,
      label: preset ? expense.label : "Other",
      customLabel: preset ? "" : expense.label,
      amount: String(expense.amount),
      remarks: expense.remarks || "",
      recurring: expense.recurring,
      renewalDate: expense.renewalDate || "",
    });
    try {
      setCustomValues(JSON.parse(expense.customFields || "{}"));
    } catch {
      setCustomValues({});
    }
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
    setCustomValues({});
    setError(null);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    const resolvedLabel =
      form.label === "Other" ? form.customLabel.trim() : form.label.trim();
    if (form.label === "Other" && !resolvedLabel) {
      setError("Enter a name for Other.");
      return;
    }

    const fd = new FormData();
    fd.set("date", form.date);
    fd.set("label", resolvedLabel);
    fd.set("amount", form.amount);
    fd.set("remarks", form.remarks);
    fd.set("recurring", form.recurring ? "true" : "false");
    fd.set("renewalDate", form.renewalDate);
    fd.set("customFields", JSON.stringify(customValues));

    startTransition(async () => {
      const res = editingId
        ? await updateExpense(editingId, fd)
        : await addExpense(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setError(null);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1600);
      cancelEdit();
      refresh();
    });
  }

  const body = (
    <>
      {readOnly ? <h2 className="mb-4 text-xl font-bold text-ink">Expenses</h2> : null}
      <div className="mb-6 border border-line bg-white/50 p-5 anim-rise">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">
              Month view
            </p>
            <p className="mt-2 text-3xl font-bold text-coral number-tick">
              {monthReady ? formatINR(monthTotal) : "…"}
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              {monthReady
                ? `${selectedMonthLabel} · ${monthRows.length} ${monthRows.length === 1 ? "entry" : "entries"}`
                : `Loading ${selectedMonthLabel}…`}
            </p>
          </div>
          <label className="block w-full min-w-0 sm:w-52">
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
      </div>

      <div className={readOnly ? "" : "grid gap-8 lg:grid-cols-[1fr_1fr]"}>
        {readOnly ? null : (
        <div className="anim-rise">
          <form className="border border-line bg-white/50 p-5" onSubmit={onSubmit}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-ink">
                {editingId ? "Edit expense" : "Expense entry"}
              </h2>
              <div className="flex items-center gap-3">
                {savedFlash ? <span className="font-mono text-xs text-mint">saved ✓</span> : null}
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
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                  Date
                </span>
                <input
                  className="field"
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                  Label
                </span>
                <select
                  className="field"
                  value={form.label}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      label: e.target.value,
                      customLabel: e.target.value === "Other" ? f.customLabel : "",
                    }))
                  }
                >
                  {DEFAULT_EXPENSE_LABELS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
              {form.label === "Other" ? (
                <label className="block">
                  <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                    Category name
                  </span>
                  <input
                    className="field border-mint/50 bg-mint/5"
                    required
                    autoFocus
                    placeholder="e.g. Domain renewal, Software license, etc."
                    value={form.customLabel}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, customLabel: e.target.value }))
                    }
                  />
                </label>
              ) : null}
              <label className="block">
                <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                  Amount (₹)
                </span>
                <input
                  className="field"
                  type="number"
                  step="any"
                  required
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                  Remarks / reminder
                </span>
                <textarea
                  className="field min-h-24 resize-y"
                  placeholder="e.g. bought domain — next renewal…"
                  value={form.remarks}
                  onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                />
              </label>

              <label className="flex items-center gap-3 border border-line px-3 py-3">
                <input
                  type="checkbox"
                  checked={form.recurring}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, recurring: e.target.checked }))
                  }
                />
                <span>
                  <span className="block text-sm font-medium text-ink">Recurring</span>
                  <span className="text-xs text-ink-soft">
                    Comes again next month — set the next date below
                  </span>
                </span>
              </label>

              {form.recurring ? (
                <label className="block">
                  <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                    Next date
                  </span>
                  <input
                    className="field"
                    type="date"
                    required={form.recurring}
                    value={form.renewalDate}
                    onChange={(e) => setForm((f) => ({ ...f, renewalDate: e.target.value }))}
                  />
                </label>
              ) : (
                <label className="block">
                  <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                    Renewal date (optional)
                  </span>
                  <input
                    className="field"
                    type="date"
                    value={form.renewalDate}
                    onChange={(e) => setForm((f) => ({ ...f, renewalDate: e.target.value }))}
                  />
                </label>
              )}

              {defs.map((field) => {
                const options = JSON.parse(field.options || "[]") as string[];
                return (
                  <label key={field.id} className="block">
                    <span className="mb-1.5 flex items-center justify-between gap-2 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                      {field.label}
                      <button
                        type="button"
                        className="normal-case tracking-normal text-coral"
                        onClick={() =>
                          startTransition(async () => {
                            await removeFieldDef(field.id);
                            refresh();
                          })
                        }
                      >
                        remove
                      </button>
                    </span>
                    {field.type === "textarea" ? (
                      <textarea
                        className="field min-h-20"
                        value={String(customValues[field.id] ?? "")}
                        onChange={(e) =>
                          setCustomValues((v) => ({ ...v, [field.id]: e.target.value }))
                        }
                      />
                    ) : field.type === "dropdown" ? (
                      <select
                        className="field"
                        value={String(customValues[field.id] ?? options[0] ?? "")}
                        onChange={(e) =>
                          setCustomValues((v) => ({ ...v, [field.id]: e.target.value }))
                        }
                      >
                        {options.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    ) : field.type === "checkbox" ? (
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(customValues[field.id])}
                          onChange={(e) =>
                            setCustomValues((v) => ({ ...v, [field.id]: e.target.checked }))
                          }
                        />
                        <span className="text-sm text-ink-soft">Yes</span>
                      </span>
                    ) : (
                      <input
                        className="field"
                        type={
                          field.type === "number"
                            ? "number"
                            : field.type === "date"
                              ? "date"
                              : "text"
                        }
                        step={field.type === "number" ? "any" : undefined}
                        value={String(customValues[field.id] ?? "")}
                        onChange={(e) =>
                          setCustomValues((v) => ({ ...v, [field.id]: e.target.value }))
                        }
                      />
                    )}
                  </label>
                );
              })}
            </div>

            {error ? <p className="mt-3 text-sm text-coral">{error}</p> : null}
            <button
              type="submit"
              disabled={pending}
              className="btn-primary mt-5 w-full py-3 text-sm font-medium disabled:opacity-60"
            >
              {editingId ? "Save changes" : "Save expense"}
            </button>
          </form>

          <form
            className="mt-4 border border-dashed border-mint/50 bg-mint/5 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const formEl = e.currentTarget;
              const fd = new FormData(formEl);
              startTransition(async () => {
                await addFieldDef(fd);
                formEl.reset();
                refresh();
              });
            }}
          >
            <h3 className="text-sm font-semibold text-ink">Dynamically add a field</h3>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input className="field" name="label" placeholder="Field label" required />
              <select className="field sm:w-40" name="type" defaultValue="text">
                <option value="text">Textbox</option>
                <option value="textarea">Textarea</option>
                <option value="dropdown">Dropdown</option>
                <option value="checkbox">Checkbox</option>
                <option value="date">Date</option>
                <option value="number">Number</option>
              </select>
              <input
                className="field"
                name="options"
                placeholder="Dropdown options (comma-separated)"
              />
              <button type="submit" className="btn-secondary px-4 py-2 text-sm whitespace-nowrap">
                Add field
              </button>
            </div>
          </form>
        </div>
        )}

        <div className="anim-rise-delay-1">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-bold text-ink">{selectedMonthLabel} entries</h2>
            <label className="relative block w-full max-w-xs">
              <span className="sr-only">Search entries</span>
              <input
                className="field py-2 text-sm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search amount, text, or date"
              />
            </label>
          </div>
          <ul className="max-h-[640px] space-y-2 overflow-y-auto pr-1">
            {monthReady
              ? filteredRows.map((e) => (
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
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {viewToken ? (
                        <Link href={`/view/${viewToken}/expenses/${e.id}`} className="hover:text-mint">
                          {e.label}
                        </Link>
                      ) : (
                        e.label
                      )}{" "}
                      <span className="font-mono text-xs font-normal text-ink-soft">{e.date}</span>
                    </p>
                    {e.remarks ? <p className="mt-1 text-sm text-ink-soft">{e.remarks}</p> : null}
                    {e.recurring && e.renewalDate ? (
                      <p className="mt-1 font-mono text-[11px] text-[#c45f12]">
                        recurring · next {e.renewalDate}
                      </p>
                    ) : e.renewalDate ? (
                      <p className="mt-1 font-mono text-[11px] text-coral">
                        renewal · {e.renewalDate}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-semibold">{formatINR(e.amount)}</p>
                    {readOnly ? null : (
                    <div className="mt-1 flex justify-end gap-2">
                      <button
                        type="button"
                        className="text-xs text-mint"
                        onClick={() => startEdit(e)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-xs text-coral"
                        onClick={() =>
                          startTransition(async () => {
                            await deleteExpense(e.id);
                            if (editingId === e.id) cancelEdit();
                            refresh();
                          })
                        }
                      >
                        Delete
                      </button>
                    </div>
                    )}
                  </div>
                </div>
              </li>
            ))
              : (
              <li className="text-sm text-ink-soft">Loading {selectedMonthLabel}…</li>
            )}
            {monthReady && monthRows.length === 0 ? (
              <li className="text-sm text-ink-soft">No expenses for {selectedMonthLabel} yet.</li>
            ) : monthReady && filteredRows.length === 0 ? (
              <li className="text-sm text-ink-soft">No entries match {query.trim()}.</li>
            ) : null}
          </ul>
        </div>
      </div>
    </>
  );

  if (readOnly) return body;
  return (
    <AppShell
      title="Add expense"
      subtitle="Edit any entry. Mark recurring with a next date — those highlight in orange and appear on the dashboard."
    >
      {body}
    </AppShell>
  );
}
