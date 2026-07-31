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
} from "@/lib/actions/expenses";
import { DEFAULT_EXPENSE_LABELS, formatINR } from "@/lib/finance";
import { currentMonthKey } from "@/lib/dates";

type Expense = Awaited<ReturnType<typeof listExpenses>>[number];
type FieldDef = Awaited<ReturnType<typeof listFieldDefs>>[number];

export default function ExpensesPage() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [defs, setDefs] = useState<FieldDef[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string | boolean>>({});
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const month = useMemo(() => currentMonthKey(), []);

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

  return (
    <AppShell
      title="Add expense"
      subtitle="Customizable form — start with Breakfast, Lunch, Dinner, Recharge… then add any field you need."
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div className="anim-rise">
          <form
            className="border border-line bg-white/50 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              fd.set("customFields", JSON.stringify(customValues));
              startTransition(async () => {
                const res = await addExpense(fd);
                if (res?.error) setError(res.error);
                else {
                  setError(null);
                  setSavedFlash(true);
                  setTimeout(() => setSavedFlash(false), 1600);
                  e.currentTarget.reset();
                  setCustomValues({});
                  refresh();
                }
              });
            }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-ink">Expense entry</h2>
              {savedFlash ? <span className="font-mono text-xs text-mint">saved ✓</span> : null}
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                  Date
                </span>
                <input
                  className="field"
                  type="date"
                  name="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                  Label
                </span>
                <select className="field" name="label" defaultValue="Lunch">
                  {DEFAULT_EXPENSE_LABELS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                  Amount (₹)
                </span>
                <input className="field" type="number" name="amount" min="0" step="1" required />
              </label>
              <label className="block">
                <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                  Remarks / reminder
                </span>
                <textarea
                  className="field min-h-24 resize-y"
                  name="remarks"
                  placeholder="e.g. bought domain — next renewal…"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                  Renewal date
                </span>
                <input className="field" type="date" name="renewalDate" />
              </label>

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
                        type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
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
              Save expense
            </button>
          </form>

          <form
            className="mt-4 border border-dashed border-mint/50 bg-mint/5 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                await addFieldDef(fd);
                e.currentTarget.reset();
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
          <h2 className="mb-4 text-lg font-bold text-ink">This month&apos;s entries</h2>
          <ul className="max-h-[640px] space-y-2 overflow-y-auto pr-1">
            {rows.map((e) => (
              <li
                key={e.id}
                className={`border border-line bg-white/50 px-4 py-3 ${
                  e.renewalDate ? "highlight-renewal" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink">
                      {e.label}{" "}
                      <span className="font-mono text-xs font-normal text-ink-soft">{e.date}</span>
                    </p>
                    {e.remarks ? <p className="mt-1 text-sm text-ink-soft">{e.remarks}</p> : null}
                    {e.renewalDate ? (
                      <p className="mt-1 font-mono text-[11px] text-coral">
                        renewal · {e.renewalDate}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold">{formatINR(e.amount)}</p>
                    <button
                      type="button"
                      className="mt-1 text-xs text-coral"
                      onClick={() =>
                        startTransition(async () => {
                          await deleteExpense(e.id);
                          refresh();
                        })
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
            {rows.length === 0 ? (
              <li className="text-sm text-ink-soft">No expenses this month yet.</li>
            ) : null}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
