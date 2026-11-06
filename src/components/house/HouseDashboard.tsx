"use client";

import { formatINR } from "@/lib/finance";
import { formatMonthLabel } from "@/lib/dates";
import {
  HOUSE_SECTIONS,
  KITCHEN_GROUPS,
  categoryLabel,
  currentMaintenanceRate,
  expectedMonthlyMaintenance,
  formatQuantity,
  isPrimaryOnetimeCategory,
  purchasedArea,
  sectionForExpense,
  type HouseSectionId,
} from "@/lib/house";
import type { HouseTrackerData, HouseTrackerExpense } from "@/lib/actions/house";
import { formatEntryDate, formatSqft, MonthNavigator } from "@/components/house/fields";

function sum(rows: HouseTrackerExpense[]) {
  return rows.reduce((total, row) => total + row.amount, 0);
}

function inMonth(rows: HouseTrackerExpense[], monthKey: string) {
  return rows.filter((row) => row.monthKey === monthKey);
}

function inYear(rows: HouseTrackerExpense[], year: string) {
  return rows.filter((row) => row.date.startsWith(year) || row.monthKey.startsWith(year));
}

function MoneyLine({ label, amount, detail }: { label: string; amount: number; detail?: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-2 text-sm">
      <span className="min-w-0">
        <span className="text-ink">{label}</span>
        {detail ? <span className="mt-0.5 block text-xs text-ink-soft">{detail}</span> : null}
      </span>
      <span className="shrink-0 font-medium tabular-nums text-ink">{formatINR(amount)}</span>
    </li>
  );
}

export function HouseDashboard({
  data,
  monthKey,
  onMonthKey,
  onOpenSection,
}: {
  data: HouseTrackerData;
  monthKey: string;
  onMonthKey: (monthKey: string) => void;
  onOpenSection: (sectionId: HouseSectionId) => void;
}) {
  const year = monthKey.slice(0, 4);
  const bySection = new Map<HouseSectionId, HouseTrackerExpense[]>();
  for (const section of HOUSE_SECTIONS) bySection.set(section.id, []);
  for (const expense of data.expenses) {
    const sectionId = sectionForExpense(expense);
    bySection.get(sectionId)?.push(expense);
  }

  const onetime = bySection.get("onetime") || [];
  const maintenance = bySection.get("maintenance") || [];
  const yearly = bySection.get("yearly") || [];
  const utility = bySection.get("utility") || [];
  const food = bySection.get("food") || [];
  const kitchen = bySection.get("kitchen") || [];
  const transport = bySection.get("transport") || [];

  const monthMaintenance = inMonth(maintenance, monthKey);
  const monthUtility = inMonth(utility, monthKey);
  const monthFood = inMonth(food, monthKey);
  const monthKitchen = inMonth(kitchen, monthKey);
  const monthTransport = inMonth(transport, monthKey);
  const yearTaxes = inYear(yearly, year);

  const running =
    sum(monthMaintenance) + sum(monthUtility) + sum(monthFood) + sum(monthKitchen) + sum(monthTransport);

  const area = purchasedArea({
    carpetArea: data.profile.carpetArea,
    builtupArea: data.profile.builtupArea,
    superBuiltupArea: data.profile.superBuiltupArea,
    landArea: data.profile.landArea,
  });
  const expected = expectedMonthlyMaintenance(
    currentMaintenanceRate(data.profile.details.maintenanceRates),
    {
      carpetArea: data.profile.carpetArea,
      builtupArea: data.profile.builtupArea,
      superBuiltupArea: data.profile.superBuiltupArea,
      landArea: data.profile.landArea,
    },
  );

  const primaryHeads = ["TDS", "Corpus", "Registration", "Construction", "Pre-occupancy"];
  const otherPurchase = onetime.filter((row) => !isPrimaryOnetimeCategory(row.category) || row.category === "Modification");
  const otherPurchaseTotal = sum(onetime.filter((row) => !isPrimaryOnetimeCategory(row.category)));
  const modifications = onetime.filter((row) => row.category === "Modification");
  const modificationMap = new Map<string, number>();
  for (const row of modifications) {
    const label = row.customLabel || "Modification";
    modificationMap.set(label, (modificationMap.get(label) || 0) + row.amount);
  }

  const maintenanceMonths = [...new Set(maintenance.map((row) => row.monthKey))].sort((a, b) => b.localeCompare(a)).slice(0, 4);

  function categoryTotal(rows: HouseTrackerExpense[], category: string) {
    return sum(rows.filter((row) => row.category === category));
  }

  function open(sectionId: HouseSectionId) {
    return (
      <button type="button" className="btn-secondary shrink-0 px-3 py-2 text-sm" onClick={() => onOpenSection(sectionId)}>
        Add or edit
      </button>
    );
  }

  return (
    <div className="space-y-6">
      <section className="border border-line bg-white/50 p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-ink">{data.profile.name}</h2>
            <p className="mt-1 text-sm text-ink-soft">
              {data.profiles.length === 1
                ? "This is the only house set up, so its records are open."
                : "Choose another house above to load that property."}{" "}
              Figures below follow {formatMonthLabel(monthKey)}, except one-time costs, which are the full purchase.
            </p>
          </div>
          <MonthNavigator monthKey={monthKey} onChange={onMonthKey} />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border border-line bg-white/50 p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">One-time spent</p>
          <p className="mt-2 text-2xl font-bold text-ink">{formatINR(sum(onetime))}</p>
          <p className="mt-1 text-xs text-ink-soft">Purchase through pre-occupancy</p>
        </div>
        <div className="border border-line bg-white/50 p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Running this month</p>
          <p className="mt-2 text-2xl font-bold text-ink">{formatINR(running)}</p>
          <p className="mt-1 text-xs text-ink-soft">Maintenance, bills, food, transport</p>
        </div>
        <div className="border border-line bg-white/50 p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Taxes in {year}</p>
          <p className="mt-2 text-2xl font-bold text-ink">{formatINR(sum(yearTaxes))}</p>
          <p className="mt-1 text-xs text-ink-soft">Property tax{data.profile.details.waterTaxApplicable ? " and water tax" : ""}</p>
        </div>
        <div className="border border-line bg-white/50 p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">{area.basis}</p>
          <p className="mt-2 text-2xl font-bold text-ink">{formatSqft(area.sqft)}</p>
          <p className="mt-1 text-xs text-ink-soft">
            {data.profile.purchaseDate ? `Purchased ${formatEntryDate(data.profile.purchaseDate)}` : "Purchase date not set"}
          </p>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="border border-line bg-white/50 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink">One-time purchase</h2>
              <p className="mt-1 text-sm text-ink-soft">
                {data.profile.purchasePrice ? `Purchase price ${formatINR(data.profile.purchasePrice)}. ` : ""}
                {area.sqft ? `${formatSqft(area.sqft)} on ${data.profile.purchaseDate ? formatEntryDate(data.profile.purchaseDate) : "a date not set yet"}.` : "Add the sqft and purchase date from the entry screen."}
              </p>
            </div>
            {open("onetime")}
          </div>
          <ul className="mt-3 divide-y divide-line/70">
            {primaryHeads.map((category) => {
              const matched = onetime.filter((row) => row.category === category);
              const target =
                category === "TDS"
                  ? data.profile.details.tdsTarget
                  : category === "Corpus"
                    ? data.profile.details.corpusTarget
                    : category === "Registration"
                      ? data.profile.details.registrationTarget
                      : null;
              const descriptions = matched
                .map((row) => row.customLabel)
                .filter(Boolean)
                .slice(0, 3)
                .join(", ");
              return (
                <MoneyLine
                  key={category}
                  label={categoryLabel("onetime", category)}
                  amount={sum(matched)}
                  detail={[target ? `target ${formatINR(target)}` : "", descriptions].filter(Boolean).join(" · ") || undefined}
                />
              );
            })}
            {otherPurchaseTotal > 0 ? <MoneyLine label="Other purchase costs" amount={otherPurchaseTotal} /> : null}
          </ul>
          <div className="mt-4 border border-line/70 bg-white/40 p-3">
            <p className="text-sm font-medium text-ink">Modifications</p>
            {modificationMap.size === 0 ? (
              <p className="mt-1 text-sm text-ink-soft">No modification recorded. Add one and choose the work from the list.</p>
            ) : (
              <ul className="mt-1 divide-y divide-line/60">
                {[...modificationMap.entries()].map(([label, amount]) => (
                  <MoneyLine key={label} label={label} amount={amount} />
                ))}
              </ul>
            )}
          </div>
          {otherPurchase.some((row) => row.category === "Down payment") ? (
            <p className="mt-3 text-xs text-ink-soft">Down payment paid: {formatINR(data.totals.downPaymentPaid)}</p>
          ) : null}
        </section>

        <section className="border border-line bg-white/50 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink">Monthly maintenance</h2>
              <p className="mt-1 text-sm text-ink-soft">
                {expected === null ? "Set a rate per sqft under Property to see the expected bill." : `Expected about ${formatINR(expected)} from the current rate.`}
              </p>
            </div>
            {open("maintenance")}
          </div>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-ink-soft">{formatMonthLabel(monthKey)}</p>
          <p className="text-2xl font-bold text-ink">{formatINR(sum(monthMaintenance))}</p>
          {maintenanceMonths.length > 0 ? (
            <ul className="mt-4 divide-y divide-line/70">
              {maintenanceMonths.map((key) => (
                <MoneyLine key={key} label={formatMonthLabel(key)} amount={sum(inMonth(maintenance, key))} />
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-ink-soft">No maintenance entries yet.</p>
          )}
        </section>

        <section className="border border-line bg-white/50 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink">Yearly taxes</h2>
              <p className="mt-1 text-sm text-ink-soft">Calendar year {year}.</p>
            </div>
            {open("yearly")}
          </div>
          <ul className="mt-3 divide-y divide-line/70">
            <MoneyLine label="Property tax" amount={categoryTotal(yearTaxes, "Property tax")} />
            <MoneyLine
              label="Water tax"
              amount={categoryTotal(yearTaxes, "Water tax")}
              detail={data.profile.details.waterTaxApplicable ? undefined : "Not marked for this house"}
            />
          </ul>
        </section>

        <section className="border border-line bg-white/50 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink">Other monthly bills</h2>
              <p className="mt-1 text-sm text-ink-soft">{formatMonthLabel(monthKey)}</p>
            </div>
            {open("utility")}
          </div>
          <ul className="mt-3 divide-y divide-line/70">
            {["EB bill", "Internet", "Maid", "Gas / piped gas"].map((category) => (
              <MoneyLine key={category} label={categoryLabel("utility", category)} amount={categoryTotal(monthUtility, category)} />
            ))}
            {data.profile.details.dishTvApplicable || categoryTotal(utility, "Dish TV") > 0 ? (
              <MoneyLine label="Dish TV" amount={categoryTotal(monthUtility, "Dish TV")} />
            ) : (
              <li className="py-2 text-sm text-ink-soft">Dish TV is off for this house.</li>
            )}
          </ul>
        </section>

        <section className="border border-line bg-white/50 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink">Regular food</h2>
              <p className="mt-1 text-sm text-ink-soft">Milk, curd, vegetables, fruits, and nuts for {formatMonthLabel(monthKey)}.</p>
            </div>
            {open("food")}
          </div>
          <ul className="mt-3 divide-y divide-line/70">
            {["Milk", "Curd", "Vegetables", "Fruits", "Nuts"].map((category) => (
              <MoneyLine key={category} label={category} amount={categoryTotal(monthFood, category)} />
            ))}
          </ul>
        </section>

        <section className="border border-line bg-white/50 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink">Kitchen staples</h2>
              <p className="mt-1 text-sm text-ink-soft">
                {formatINR(sum(monthKitchen))} in {formatMonthLabel(monthKey)}. Quantities show when you entered grams, kilos, liters, or a description.
              </p>
            </div>
            {open("kitchen")}
          </div>
          <div className="mt-4 space-y-3">
            {KITCHEN_GROUPS.map((group) => {
              const items = monthKitchen.filter((row) => row.category === group.category);
              return (
                <div key={group.category}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-ink">{group.label}</span>
                    <span className="tabular-nums text-ink">{formatINR(sum(items))}</span>
                  </div>
                  {items.length > 0 ? (
                    <ul className="mt-1 space-y-1">
                      {items.slice(0, 4).map((row) => {
                        const qty = formatQuantity(row);
                        return (
                          <li key={row.id} className="text-xs text-ink-soft">
                            {row.customLabel || row.category}
                            {qty ? ` · ${qty}` : ""} · {formatINR(row.amount)}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <section className="border border-line bg-white/50 p-5 xl:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink">Transport</h2>
              <p className="mt-1 text-sm text-ink-soft">Fuel, service, upkeep, and public transport for {formatMonthLabel(monthKey)}.</p>
            </div>
            {open("transport")}
          </div>
          <ul className="mt-3 grid gap-x-8 sm:grid-cols-2">
            {(HOUSE_SECTIONS.find((section) => section.id === "transport")?.categories || []).map((category) => {
              const rows = monthTransport.filter((row) => row.category === category.category);
              const qty = rows
                .map((row) => formatQuantity(row))
                .filter(Boolean)
                .join(", ");
              return (
                <MoneyLine
                  key={category.category}
                  label={category.label}
                  amount={sum(rows)}
                  detail={qty || undefined}
                />
              );
            })}
          </ul>
        </section>
      </div>

      {data.profile.details.loan.sanctionedAmount ? (
        <section className="border border-line bg-white/50 p-5">
          <h2 className="text-lg font-bold text-ink">Loan</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Sanctioned {formatINR(data.profile.details.loan.sanctionedAmount)}
            {data.profile.details.loan.outstandingAmount
              ? ` · outstanding ${formatINR(data.profile.details.loan.outstandingAmount)}`
              : ""}
            {data.totals.loanPercent !== null ? ` · ${data.totals.loanPercent.toFixed(1)}% of the purchase price` : ""}
            . Loan details stay on the Property tab.
          </p>
        </section>
      ) : null}
    </div>
  );
}
