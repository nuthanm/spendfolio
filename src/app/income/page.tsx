"use client";

import { useEffect, useState, useTransition } from "react";
import { AppShell } from "@/components/AppShell";
import { addIncomeSource, deleteIncomeSource, listIncomeSources } from "@/lib/actions/income";
import { formatINR } from "@/lib/finance";

type Source = Awaited<ReturnType<typeof listIncomeSources>>[number];

export default function IncomePage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      setSources(await listIncomeSources());
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  const total = sources.reduce((s, i) => s + i.amount, 0);

  return (
    <AppShell
      title="Sources of income"
      subtitle="Track every inflow separately — salary, freelance, interest — so the monthly equation stays honest."
    >
      <div className="mb-6 border border-line bg-white/50 p-5 anim-rise">
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">
          Total monthly inflow
        </p>
        <p className="mt-2 text-3xl font-bold text-mint number-tick">{formatINR(total)}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <ul className="space-y-2 anim-rise-delay-1">
          {sources.map((s) => (
            <li key={s.id} className="border border-line bg-white/50 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">{s.name}</p>
                  <p className="mt-1 font-mono text-xs text-ink-soft">
                    {s.cadence}
                    {s.nextDate ? ` · next ${s.nextDate}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-mono text-lg font-semibold">{formatINR(s.amount)}</p>
                  <button
                    type="button"
                    className="text-xs text-coral"
                    onClick={() =>
                      startTransition(async () => {
                        await deleteIncomeSource(s.id);
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
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              const res = await addIncomeSource(fd);
              if (res?.error) setError(res.error);
              else {
                setError(null);
                e.currentTarget.reset();
                refresh();
              }
            });
          }}
        >
          <h2 className="text-lg font-bold text-ink">Add income source</h2>
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                Name
              </span>
              <input className="field" name="name" required placeholder="e.g. Consulting retainer" />
            </label>
            <label className="block">
              <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                Amount (₹)
              </span>
              <input className="field" name="amount" type="number" min="0" step="1" required />
            </label>
            <label className="block">
              <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                Cadence
              </span>
              <select className="field" name="cadence" defaultValue="Monthly">
                <option>Monthly</option>
                <option>Weekly</option>
                <option>Variable</option>
                <option>One-time</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                Next date
              </span>
              <input className="field" name="nextDate" type="date" />
            </label>
            {error ? <p className="text-sm text-coral">{error}</p> : null}
            <button
              type="submit"
              disabled={pending}
              className="btn-primary w-full py-3 text-sm font-medium disabled:opacity-60"
            >
              Add source
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
