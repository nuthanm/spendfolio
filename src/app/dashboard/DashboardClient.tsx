"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { getDashboardData } from "@/lib/actions/dashboard";
import { formatINR } from "@/lib/finance";

type Dash = Awaited<ReturnType<typeof getDashboardData>>;

export default function DashboardClient() {
  const search = useSearchParams();
  const router = useRouter();
  const initialMonth = search.get("month") || undefined;
  const [data, setData] = useState<Dash | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const d = await getDashboardData(initialMonth);
      setData(d);
    });
  }, [initialMonth]);

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
        <label className="flex items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">
            Month
          </span>
          <select
            className="field w-auto py-2"
            value={data.monthKey}
            disabled={pending}
            onChange={(e) => router.push(`/dashboard?month=${e.target.value}`)}
          >
            {data.months.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
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

      <section className="mt-10 anim-rise-delay-2">
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="text-xl font-bold text-ink">Where money went</h2>
          <p className="font-mono text-xs text-ink-soft">tiles · {data.monthLabel}</p>
        </div>
        {data.tiles.length === 0 ? (
          <p className="text-sm text-ink-soft">No expenses recorded for this month yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.tiles.map((tile) => (
              <div key={tile.label} className="tile-spend p-4">
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
              </div>
            ))}
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
                    r.daysLeft <= 5 ? "highlight-renewal" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink">{r.title}</p>
                      <p className="font-mono text-xs text-ink-soft">
                        due {r.due}
                        {r.daysLeft <= 5 ? ` · ${r.daysLeft}d left` : ""}
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
              {data.recent.map((e) => {
                const hot =
                  e.renewalDate &&
                  data.renewals.some((r) => r.id === e.id && r.daysLeft <= 5);
                return (
                  <li
                    key={e.id}
                    className={`border border-line bg-white/50 px-4 py-3 ${
                      hot ? "highlight-renewal" : ""
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
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </AppShell>
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
