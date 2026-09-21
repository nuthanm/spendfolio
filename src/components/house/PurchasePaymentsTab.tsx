"use client";

import { useMemo, useState } from "react";
import { formatINR } from "@/lib/finance";
import { formatMonthLabel } from "@/lib/dates";
import {
  PURCHASE_COST_HEADS,
  downPaymentAmountFromPercent,
  downPaymentPercentFromAmount,
  loanPercentOfPrice,
  ratePeriodEnd,
} from "@/lib/house";
import type { HouseTrackerData, HouseTrackerExpense } from "@/lib/actions/house";
import { NumberField } from "@/components/house/fields";
import type { PropertyFormState } from "@/components/house/PropertyDetailsForm";

type PaymentForm = {
  date: string;
  category: string;
  customLabel: string;
  amount: string;
  note: string;
};

const emptyPayment = (): PaymentForm => ({
  date: new Date().toISOString().slice(0, 10),
  category: "Down payment",
  customLabel: "",
  amount: "",
  note: "",
});

function ProgressBar({ pct }: { pct: number }) {
  const width = Math.max(0, Math.min(100, pct));
  return (
    <div className="mt-3 h-1.5 w-full bg-paper-deep">
      <div className="h-1.5 bg-mint" style={{ width: `${width}%` }} />
    </div>
  );
}

export function PurchasePaymentsTab({
  data,
  form,
  setForm,
  pending,
  onSaveTargets,
  onSavePayment,
  onDeletePayment,
}: {
  data: HouseTrackerData;
  form: PropertyFormState;
  setForm: (next: PropertyFormState | ((prev: PropertyFormState) => PropertyFormState)) => void;
  pending: boolean;
  onSaveTargets: (e: React.FormEvent) => void;
  onSavePayment: (payload: PaymentForm, editingId: string | null) => void;
  onDeletePayment: (id: string) => void;
}) {
  const [payment, setPayment] = useState<PaymentForm>(emptyPayment);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [groupMode, setGroupMode] = useState<"year" | "rate">("year");

  const purchaseRows = useMemo(
    () => data.expenses.filter((row) => row.kind === "purchase"),
    [data.expenses],
  );
  const maintenanceRows = useMemo(
    () => data.expenses.filter((row) => row.kind === "maintenance"),
    [data.expenses],
  );

  const groupedLedger = useMemo(() => {
    const map = new Map<string, HouseTrackerExpense[]>();
    for (const row of purchaseRows) {
      const list = map.get(row.category) || [];
      list.push(row);
      map.set(row.category, list);
    }
    return PURCHASE_COST_HEADS.map((head) => ({
      head,
      rows: map.get(head) || [],
    })).filter((group) => group.rows.length > 0);
  }, [purchaseRows]);

  const maintenanceByYear = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of maintenanceRows) {
      const year = row.date.slice(0, 4);
      map.set(year, (map.get(year) || 0) + row.amount);
    }
    return [...map.entries()]
      .map(([year, total]) => ({ year, total }))
      .sort((a, b) => b.year.localeCompare(a.year));
  }, [maintenanceRows]);

  const maintenanceByRate = useMemo(() => {
    const rates = data.profile.details.maintenanceRates;
    return rates.map((rate, index) => {
      const until = ratePeriodEnd(rates, index);
      const total = maintenanceRows
        .filter((row) => row.date >= rate.effectiveFrom && (!until || row.date <= until))
        .reduce((sum, row) => sum + row.amount, 0);
      return { rate, until, total };
    });
  }, [data.profile.details.maintenanceRates, maintenanceRows]);

  const loanPct = loanPercentOfPrice(
    form.loanSanctionedAmount ? Number(form.loanSanctionedAmount) : null,
    form.purchasePrice ? Number(form.purchasePrice) : null,
  );

  function onPercentChange(value: string) {
    const percent = value.trim() ? Number(value) : null;
    const amount = downPaymentAmountFromPercent(
      Number.isFinite(percent) ? percent : null,
      form.purchasePrice ? Number(form.purchasePrice) : null,
    );
    setForm((prev) => ({
      ...prev,
      downPaymentPercent: value,
      downPaymentTarget: amount === null ? prev.downPaymentTarget : String(Number(amount.toFixed(2))),
    }));
  }

  function onAmountChange(value: string) {
    const amount = value.trim() ? Number(value) : null;
    const percent = downPaymentPercentFromAmount(
      Number.isFinite(amount) ? amount : null,
      form.purchasePrice ? Number(form.purchasePrice) : null,
    );
    setForm((prev) => ({
      ...prev,
      downPaymentTarget: value,
      downPaymentPercent: percent === null ? prev.downPaymentPercent : String(Number(percent.toFixed(2))),
    }));
  }

  function startEdit(row: HouseTrackerExpense) {
    setEditingId(row.id);
    setPayment({
      date: row.date,
      category: row.category,
      customLabel: row.customLabel,
      amount: String(row.amount),
      note: row.note,
    });
  }

  return (
    <div className="space-y-6">
      {data.totals.legacyGaps.length > 0 ? (
        <div className="border border-gold/50 bg-white/70 p-4 text-sm text-ink">
          Older snapshot amounts are higher than the payment ledger. Paid totals now come from entries.
          <ul className="mt-2 space-y-1 text-ink-soft">
            {data.totals.legacyGaps.map((gap) => (
              <li key={gap.label}>
                {gap.label}: snapshot {formatINR(gap.snapshot)} vs ledger {formatINR(gap.ledger)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form onSubmit={onSaveTargets} className="space-y-6">
        <section className="grid gap-3 md:grid-cols-2">
          <div className="border border-line bg-white/50 p-4">
            <h3 className="font-bold text-ink">Down payment</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <NumberField label="Percent" value={form.downPaymentPercent} onChange={onPercentChange} />
              <NumberField label="Target amount" value={form.downPaymentTarget} onChange={onAmountChange} />
            </div>
            <p className="mt-2 text-xs text-ink-soft">
              Paid from ledger: {formatINR(data.totals.downPaymentPaid)} · pending {formatINR(data.totals.downPaymentPending)}
            </p>
            <ProgressBar pct={data.totals.downPaymentProgressPct} />
          </div>

          <div className="border border-line bg-white/50 p-4">
            <h3 className="font-bold text-ink">Corpus</h3>
            <div className="mt-3">
              <NumberField label="Target" value={form.corpusTarget} onChange={(value) => setForm((prev) => ({ ...prev, corpusTarget: value }))} />
            </div>
            <HeadPaid paid={data.totals.costHeads.find((h) => h.category === "Corpus")} />
          </div>

          <div className="border border-line bg-white/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold text-ink">TDS</h3>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={form.tdsApplicable}
                  onChange={(e) => setForm((prev) => ({ ...prev, tdsApplicable: e.target.checked }))}
                />
                Applicable
              </label>
            </div>
            {form.tdsApplicable ? (
              <>
                <div className="mt-3">
                  <NumberField label="Target" value={form.tdsTarget} onChange={(value) => setForm((prev) => ({ ...prev, tdsTarget: value }))} />
                </div>
                <HeadPaid paid={data.totals.costHeads.find((h) => h.category === "TDS")} />
              </>
            ) : (
              <p className="mt-3 text-sm text-ink-soft">Turn this on if TDS applies to this property.</p>
            )}
          </div>

          <div className="border border-line bg-white/50 p-4">
            <h3 className="font-bold text-ink">Registration and stamp duty</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <NumberField label="Registration target" value={form.registrationTarget} onChange={(value) => setForm((prev) => ({ ...prev, registrationTarget: value }))} />
              <NumberField label="Stamp duty target" value={form.stampDutyTarget} onChange={(value) => setForm((prev) => ({ ...prev, stampDutyTarget: value }))} />
            </div>
            <HeadPaid
              paid={{
                paid:
                  (data.totals.costHeads.find((h) => h.category === "Registration")?.paid || 0) +
                  (data.totals.costHeads.find((h) => h.category === "Stamp duty")?.paid || 0),
                target:
                  (Number(form.registrationTarget || 0) || 0) + (Number(form.stampDutyTarget || 0) || 0) || null,
              }}
            />
          </div>
        </section>

        <section className="border border-line bg-white/50 p-5">
          <h3 className="font-bold text-ink">Loan</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs text-ink-soft">Bank</span>
              <input className="field" value={form.loanBank} onChange={(e) => setForm((prev) => ({ ...prev, loanBank: e.target.value }))} />
            </label>
            <NumberField label="Sanction amount" value={form.loanSanctionedAmount} onChange={(value) => setForm((prev) => ({ ...prev, loanSanctionedAmount: value }))} />
            <NumberField
              label="Loan percent"
              value={loanPct === null ? "" : String(Number(loanPct.toFixed(2)))}
              readOnly
              hint="Sanction ÷ purchase price"
            />
            <NumberField label="Tenure (months)" value={form.loanTenureMonths} onChange={(value) => setForm((prev) => ({ ...prev, loanTenureMonths: value }))} />
            <NumberField label="Initial interest rate %" value={form.loanInterestRate} onChange={(value) => setForm((prev) => ({ ...prev, loanInterestRate: value }))} />
            <NumberField label="Outstanding amount" value={form.loanOutstandingAmount} onChange={(value) => setForm((prev) => ({ ...prev, loanOutstandingAmount: value }))} />
            <NumberField label="Outstanding EMI months" value={form.loanOutstandingEmiMonths} onChange={(value) => setForm((prev) => ({ ...prev, loanOutstandingEmiMonths: value }))} />
          </div>
        </section>

        <button disabled={pending} className="btn-primary px-4 py-2 text-sm" type="submit">
          {pending ? "Saving..." : "Save purchase targets"}
        </button>
      </form>

      <section className="border border-line bg-white/50 p-5">
        <h2 className="text-lg font-bold text-ink">{editingId ? "Edit payment details" : "Add payment details"}</h2>
        <p className="mt-1 text-sm text-ink-soft">Log every builder request or payment as its own entry.</p>
        <form
          className="mt-4 grid gap-3 lg:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSavePayment(payment, editingId);
            setPayment(emptyPayment());
            setEditingId(null);
          }}
        >
          <label className="block">
            <span className="mb-1 block text-xs text-ink-soft">Date</span>
            <input type="date" className="field" required value={payment.date} onChange={(e) => setPayment((s) => ({ ...s, date: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-ink-soft">Cost head</span>
            <select className="field" value={payment.category} onChange={(e) => setPayment((s) => ({ ...s, category: e.target.value }))}>
              {PURCHASE_COST_HEADS.filter((head) => head !== "TDS" || form.tdsApplicable).map((head) => (
                <option key={head} value={head}>
                  {head}
                </option>
              ))}
            </select>
          </label>
          {payment.category === "Other" ? (
            <label className="block lg:col-span-2">
              <span className="mb-1 block text-xs text-ink-soft">Other label</span>
              <input className="field" value={payment.customLabel} onChange={(e) => setPayment((s) => ({ ...s, customLabel: e.target.value }))} />
            </label>
          ) : null}
          <NumberField label="Amount" value={payment.amount} onChange={(value) => setPayment((s) => ({ ...s, amount: value }))} />
          <label className="block lg:col-span-2">
            <span className="mb-1 block text-xs text-ink-soft">Notes</span>
            <textarea className="field min-h-20" value={payment.note} onChange={(e) => setPayment((s) => ({ ...s, note: e.target.value }))} />
          </label>
          <div className="flex flex-wrap gap-2 lg:col-span-2">
            <button disabled={pending} className="btn-primary px-4 py-2 text-sm" type="submit">
              {pending ? "Saving..." : editingId ? "Update entry" : "Add entry"}
            </button>
            {editingId ? (
              <button
                type="button"
                className="btn-secondary px-4 py-2 text-sm"
                onClick={() => {
                  setEditingId(null);
                  setPayment(emptyPayment());
                }}
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="border border-line bg-white/50 p-5">
        <h2 className="text-lg font-bold text-ink">Payment ledger</h2>
        {groupedLedger.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">No purchase payments yet.</p>
        ) : (
          <div className="mt-4 space-y-5">
            {groupedLedger.map((group) => (
              <div key={group.head}>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h3 className="font-medium text-ink">{group.head}</h3>
                  <p className="text-sm text-ink-soft">
                    {formatINR(group.rows.reduce((sum, row) => sum + row.amount, 0))}
                  </p>
                </div>
                <div className="space-y-2">
                  {group.rows.map((row) => (
                    <div key={row.id} className="flex items-start justify-between gap-3 border border-line/70 bg-white/40 p-3">
                      <div>
                        <p className="font-medium text-ink">
                          {row.customLabel || row.category}
                        </p>
                        <p className="font-mono text-xs text-ink-soft">{row.date}</p>
                        {row.note ? <p className="mt-1 text-sm text-ink-soft">{row.note}</p> : null}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-ink">{formatINR(row.amount)}</p>
                        <div className="mt-1 flex justify-end gap-2 text-xs">
                          <button className="text-ink-soft hover:text-ink" onClick={() => startEdit(row)}>
                            edit
                          </button>
                          <button className="text-coral hover:underline" onClick={() => onDeletePayment(row.id)}>
                            delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="border border-line bg-white/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">Maintenance paid history</h2>
          <div className="flex gap-2">
            <button
              type="button"
              className={`px-3 py-1.5 text-xs font-medium ${groupMode === "year" ? "bg-ink text-white" : "border border-line text-ink-soft"}`}
              onClick={() => setGroupMode("year")}
            >
              By year
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-xs font-medium ${groupMode === "rate" ? "bg-ink text-white" : "border border-line text-ink-soft"}`}
              onClick={() => setGroupMode("rate")}
            >
              By rate change
            </button>
          </div>
        </div>

        {groupMode === "year" ? (
          maintenanceByYear.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">No maintenance payments yet.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {maintenanceByYear.map((row) => (
                <div key={row.year} className="border border-line/70 bg-white/40 p-3">
                  <p className="font-mono text-xs text-ink-soft">{row.year}</p>
                  <p className="mt-1 text-lg font-bold text-ink">{formatINR(row.total)}</p>
                </div>
              ))}
            </div>
          )
        ) : maintenanceByRate.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">Add a maintenance rate on the Property tab to group payments.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {maintenanceByRate.map(({ rate, until, total }) => (
              <div key={rate.id} className="border border-line/70 bg-white/40 p-3">
                <p className="font-medium text-ink">
                  {formatINR(rate.ratePerSqft)} / sqft from {rate.effectiveFrom}
                  {until ? ` to ${until}` : " onwards"}
                </p>
                <p className="mt-1 text-sm text-ink-soft">Paid in this period: {formatINR(total)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="border border-line bg-white/50 p-5">
        <h2 className="text-lg font-bold text-ink">Purchase month summary</h2>
        {data.totals.purchaseByMonth.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">No purchase entries yet.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.totals.purchaseByMonth.slice(0, 8).map((row) => (
              <div key={row.monthKey} className="border border-line/70 bg-white/40 p-3">
                <p className="font-mono text-xs text-ink-soft">{formatMonthLabel(row.monthKey)}</p>
                <p className="mt-1 text-lg font-bold text-ink">{formatINR(row.total)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function HeadPaid({
  paid,
}: {
  paid?: { paid: number; target: number | null; remaining?: number | null; pct?: number } | undefined;
}) {
  if (!paid) return null;
  const remaining = paid.remaining ?? (paid.target === null ? null : Math.max(0, paid.target - paid.paid));
  const pct = paid.pct ?? (paid.target && paid.target > 0 ? Math.min(100, (paid.paid / paid.target) * 100) : 0);
  return (
    <>
      <p className="mt-2 text-xs text-ink-soft">
        Paid {formatINR(paid.paid)}
        {remaining !== null ? ` · remaining ${formatINR(remaining)}` : ""}
      </p>
      <ProgressBar pct={pct} />
    </>
  );
}
