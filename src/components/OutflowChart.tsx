"use client";

import { useMemo, useState } from "react";
import { formatINR } from "@/lib/finance";
import {
  OUTFLOW_BUCKETS,
  type OutflowAnalysis,
  type OutflowBucketId,
  type OutflowCategory,
  type OutflowMonth,
} from "@/lib/outflow";

const BUCKET_COLOR: Record<OutflowBucketId, string> = {
  obligations: "#1e4b8a",
  card: "#4f86c6",
  aside: "#9ec3e6",
  living: "#e07a2f",
};

const LIVING_COLORS = ["#1e4b8a", "#e07a2f", "#7c6bb5", "#d4567a", "#1a8f6e", "#c9a227", "#3d5249"];

type View = "cash" | "living";

function compactINR(amount: number) {
  const abs = Math.abs(amount);
  if (abs >= 100000) {
    const lakhs = amount / 100000;
    return `${lakhs.toFixed(lakhs >= 10 ? 1 : 2)}L`;
  }
  if (abs >= 1000) {
    const thousands = amount / 1000;
    return `${thousands.toFixed(abs >= 10000 ? 0 : 1)}k`;
  }
  return formatINR(amount);
}

function shareOf(amount: number, total: number) {
  if (total <= 0) return "0%";
  return `${((amount / total) * 100).toFixed(1)}%`;
}

export function OutflowChart({
  analysis,
  periodLabel,
}: {
  analysis: OutflowAnalysis;
  periodLabel: string;
}) {
  const [view, setView] = useState<View>("cash");
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const livingCategories = useMemo(
    () => analysis.categories.filter((category) => category.bucket === "living" && category.amount > 0),
    [analysis.categories],
  );
  const cashCategories = analysis.categories.filter((category) => category.amount > 0);
  const visibleCategories = view === "living" ? livingCategories : cashCategories;
  const visibleTotal = view === "living" ? analysis.livingTotal : analysis.total;
  const activeMonth =
    analysis.months.find((month) => month.key === activeKey) ||
    analysis.months[analysis.months.length - 1] ||
    null;

  if (analysis.total <= 0 || analysis.months.length === 0) {
    return (
      <section className="mt-10">
        <h2 className="text-xl font-bold text-ink">Where the cash went</h2>
        <p className="mt-2 text-sm text-ink-soft">No expenses recorded in {periodLabel} yet.</p>
      </section>
    );
  }

  const peakLiving = analysis.months.reduce((best, month) => (month.living > best.living ? month : best), analysis.months[0]);

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink">Where the cash went</h2>
          <p className="mt-1 font-mono text-xs text-ink-soft">
            {periodLabel} · {analysis.txns} transaction{analysis.txns === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2" role="group" aria-label="Outflow view">
          <ViewButton active={view === "cash"} onClick={() => setView("cash")}>
            Cash that left
          </ViewButton>
          <ViewButton active={view === "living"} onClick={() => setView("living")}>
            Living only
          </ViewButton>
        </div>
      </div>

      <p className="border border-line bg-white/70 px-4 py-3 text-sm text-ink">
        {view === "cash"
          ? analysis.headline
          : `${formatINR(analysis.livingTotal)} is living spend, ${shareOf(analysis.livingTotal, analysis.total)} of the cash that left. ${peakLiving.axisLabel} ${peakLiving.partial ? "is" : "was"} the high month at ${formatINR(peakLiving.living)}${peakLiving.partial ? " so far" : ""}.`}
      </p>

      {view === "cash" ? (
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {analysis.buckets.map((bucket) => (
            <div key={bucket.id} className="border border-line bg-white/60 px-4 py-3">
              <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                <span className="inline-block h-2.5 w-2.5" style={{ background: BUCKET_COLOR[bucket.id] }} />
                {bucket.name}
              </p>
              <p className="mt-2 font-mono text-lg font-bold text-ink">{formatINR(bucket.amount)}</p>
              <p className="mt-1 font-mono text-[11px] text-ink-soft">
                {shareOf(bucket.amount, analysis.total)} · {bucket.txns} txn{bucket.txns === 1 ? "" : "s"}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-6 border border-line bg-white/50 p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">
            {view === "cash" ? "Monthly cash outflow" : "Living spend by month"}
          </h3>
          <p className="font-mono text-[11px] text-ink-soft">
            {view === "cash" ? "Amount that left the account" : "Excludes loans, chits, card payments, and savings"}
          </p>
        </div>

        {view === "cash" ? (
          <BucketChart months={analysis.months} activeKey={activeMonth?.key ?? null} onSelect={setActiveKey} />
        ) : (
          <CategoryChart
            months={analysis.months}
            categories={livingCategories}
            activeKey={activeMonth?.key ?? null}
            onSelect={setActiveKey}
          />
        )}

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          {view === "cash"
            ? OUTFLOW_BUCKETS.map((bucket) => (
                <LegendDot key={bucket.id} color={BUCKET_COLOR[bucket.id]} label={bucket.name} />
              ))
            : livingCategories.map((category, index) => (
                <LegendDot
                  key={category.id}
                  color={LIVING_COLORS[index % LIVING_COLORS.length]}
                  label={category.name}
                />
              ))}
        </div>

        {activeMonth ? (
          <MonthDetail month={activeMonth} view={view} categories={visibleCategories} />
        ) : null}
      </div>

      <div className="mt-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">
            {view === "cash" ? "Categories, largest first" : "Living categories"}
          </h3>
          <p className="font-mono text-[11px] text-ink-soft">
            {formatINR(visibleTotal)} · share and payment count
          </p>
        </div>
        <CategoryBars categories={visibleCategories} total={visibleTotal} view={view} livingCategories={livingCategories} />
      </div>

      {view === "cash" && analysis.notes.length > 0 ? (
        <div className="mt-4 space-y-2">
          {analysis.notes.map((note) => (
            <p key={note} className="text-sm text-ink-soft">
              {note}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function BucketChart({
  months,
  activeKey,
  onSelect,
}: {
  months: OutflowMonth[];
  activeKey: string | null;
  onSelect: (key: string) => void;
}) {
  const max = Math.max(...months.map((month) => month.total), 1);
  return (
    <div className="overflow-x-auto">
      <div className="flex h-64 min-w-[36rem] items-end gap-2">
        {months.map((month) => {
          const height = (month.total / max) * 100;
          return (
            <button
              key={month.key}
              type="button"
              onClick={() => onSelect(month.key)}
              className={`flex h-full min-w-0 flex-1 flex-col text-left ${
                activeKey === month.key ? "opacity-100" : "opacity-90"
              }`}
              aria-pressed={activeKey === month.key}
              aria-label={`${month.axisLabel}, ${formatINR(month.total)}`}
            >
              <span className="h-4 text-center font-mono text-[10px] leading-4 text-ink-soft">{compactINR(month.total)}</span>
              <span className="relative min-h-0 flex-1">
                <span
                  className="absolute inset-x-0 bottom-0 flex flex-col-reverse overflow-hidden"
                  style={{ height: `${month.total > 0 ? Math.max(height, 2) : 0}%` }}
                >
                  {OUTFLOW_BUCKETS.map((bucket) => {
                    const amount = month.buckets[bucket.id];
                    if (!(amount > 0) || !(month.total > 0)) return null;
                    return (
                      <span
                        key={bucket.id}
                        style={{
                          height: `${(amount / month.total) * 100}%`,
                          background: BUCKET_COLOR[bucket.id],
                        }}
                      />
                    );
                  })}
                </span>
              </span>
              <span className="mt-2 h-4 text-center font-mono text-[10px] leading-4 text-ink">{month.axisLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CategoryChart({
  months,
  categories,
  activeKey,
  onSelect,
}: {
  months: OutflowMonth[];
  categories: OutflowCategory[];
  activeKey: string | null;
  onSelect: (key: string) => void;
}) {
  const max = Math.max(...months.map((month) => month.living), 1);
  const colorById = new Map(categories.map((category, index) => [category.id, LIVING_COLORS[index % LIVING_COLORS.length]]));

  return (
    <div className="overflow-x-auto">
      <div className="flex h-64 min-w-[36rem] items-end gap-2">
        {months.map((month) => {
          const height = (month.living / max) * 100;
          const amounts = new Map(month.categories.map((row) => [row.id, row.amount]));
          return (
            <button
              key={month.key}
              type="button"
              onClick={() => onSelect(month.key)}
              className="flex h-full min-w-0 flex-1 flex-col text-left"
              aria-pressed={activeKey === month.key}
              aria-label={`${month.axisLabel} living, ${formatINR(month.living)}`}
            >
              <span className="h-4 text-center font-mono text-[10px] leading-4 text-ink-soft">{compactINR(month.living)}</span>
              <span className="relative min-h-0 flex-1">
                <span
                  className="absolute inset-x-0 bottom-0 flex flex-col-reverse overflow-hidden"
                  style={{ height: `${month.living > 0 ? Math.max(height, 2) : 0}%` }}
                >
                  {categories.map((category) => {
                    const amount = amounts.get(category.id) || 0;
                    if (!(amount > 0) || !(month.living > 0)) return null;
                    return (
                      <span
                        key={category.id}
                        style={{
                          height: `${(amount / month.living) * 100}%`,
                          background: colorById.get(category.id),
                        }}
                      />
                    );
                  })}
                </span>
              </span>
              <span className="mt-2 h-4 text-center font-mono text-[10px] leading-4 text-ink">{month.axisLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MonthDetail({
  month,
  view,
  categories,
}: {
  month: OutflowMonth;
  view: View;
  categories: OutflowCategory[];
}) {
  const rows =
    view === "cash"
      ? OUTFLOW_BUCKETS.map((bucket) => ({
          name: bucket.name,
          amount: month.buckets[bucket.id],
        })).filter((row) => row.amount > 0)
      : categories
          .map((category) => ({
            name: category.name,
            amount: month.categories.find((row) => row.id === category.id)?.amount || 0,
          }))
          .filter((row) => row.amount > 0)
          .sort((a, b) => b.amount - a.amount);

  return (
    <div className="mt-4 border-t border-line pt-3">
      <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">
        {month.axisLabel}
        {month.partial ? " · month still open" : ""} · {formatINR(view === "cash" ? month.total : month.living)}
      </p>
      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
        {rows.map((row) => (
          <li key={row.name} className="flex items-center justify-between gap-3 font-mono text-xs text-ink">
            <span className="truncate">{row.name}</span>
            <span>{formatINR(row.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CategoryBars({
  categories,
  total,
  view,
  livingCategories,
}: {
  categories: OutflowCategory[];
  total: number;
  view: View;
  livingCategories: OutflowCategory[];
}) {
  const maxCategory = Math.max(...categories.map((row) => row.amount), 1);
  return (
    <ul className="space-y-3">
      {categories.map((category) => {
        const color =
          view === "living"
            ? LIVING_COLORS[livingCategories.findIndex((row) => row.id === category.id) % LIVING_COLORS.length]
            : BUCKET_COLOR[category.bucket];
        return (
          <li key={category.id}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-sm text-ink">{category.name}</p>
              <p className="shrink-0 font-mono text-xs text-ink-soft">
                {formatINR(category.amount)} · {shareOf(category.amount, total)} · {category.txns} txn
                {category.txns === 1 ? "" : "s"}
              </p>
            </div>
            <div className="mt-1.5 h-2 w-full bg-paper-deep">
              <div className="h-full" style={{ width: `${(category.amount / maxCategory) * 100}%`, background: color }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-soft">
      <span className="inline-block h-2.5 w-2.5" style={{ background: color }} />
      {label}
    </span>
  );
}

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider ${
        active ? "bg-ink text-white" : "border border-line bg-white/60 text-ink-soft"
      }`}
    >
      {children}
    </button>
  );
}
