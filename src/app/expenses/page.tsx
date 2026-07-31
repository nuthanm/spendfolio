"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
import { currentMonthKey } from "@/lib/dates";

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

export default function ExpensesPage() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [defs, setDefs] = useState<FieldDef[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [customValues, setCustomValues] = useState<Record<string, string | boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const month = useMemo(() => currentMonthKey(), []);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;

    const digits = q.replace(/[^\d.]/g, "");

    return rows.filter((e) => {
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
  }, [rows, query]);

  function refresh() {
    startTransition(async () => {
      const [e, f] = await Promise.all([listExpenses(month), listFieldDefs()]);
      setRows(e);
      setDefs(f);
    });
  }

  useEffect(() => {
    refresh();
  }, []);

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

  return (
    <AppShell
      title="Add expense"
      subtitle="Edit any entry. Mark recurring with a next date — those highlight in orange and appear on the dashboard."
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
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
                    Defined name
                  </span>
                  <input
                    className="field"
                    required
                    placeholder="e.g. Domain for 1 year"
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
                  min="0"
                  step="1"
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

        <div className="anim-rise-delay-1">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-bold text-ink">This month&apos;s entries</h2>
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
            {filteredRows.map((e) => (
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
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold">{formatINR(e.amount)}</p>
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
                  </div>
                </div>
              </li>
            ))}
            {rows.length === 0 ? (
              <li className="text-sm text-ink-soft">No expenses this month yet.</li>
            ) : filteredRows.length === 0 ? (
              <li className="text-sm text-ink-soft">No entries match {query.trim()}.</li>
            ) : null}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
