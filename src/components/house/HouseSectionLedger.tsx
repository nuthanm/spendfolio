"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatINR } from "@/lib/finance";
import { formatMonthLabel } from "@/lib/dates";
import {
  KITCHEN_GROUPS,
  MODIFICATION_OPTIONS,
  QUANTITY_UNITS,
  categoryLabel,
  currentMaintenanceRate,
  expectedMonthlyMaintenance,
  formatQuantity,
  houseSection,
  isPrimaryOnetimeCategory,
  isQuantityUnit,
  sectionForExpense,
  type HouseSectionId,
  type QuantityUnitId,
} from "@/lib/house";
import type { HouseTrackerData, HouseTrackerExpense } from "@/lib/actions/house";
import { formatEntryDate, formatSqft, MonthNavigator, NumberField, toInput } from "@/components/house/fields";

type Draft = {
  date: string;
  category: string;
  customLabel: string;
  modificationChoice: string;
  itemChoice: string;
  amount: string;
  note: string;
  quantity: string;
  unit: QuantityUnitId | "";
  quantityText: string;
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function defaultDate(sectionId: HouseSectionId, monthKey: string) {
  const today = todayKey();
  if (sectionId === "onetime") return today;
  if (houseSection(sectionId).cadence === "year") {
    const year = monthKey.slice(0, 4);
    return today.startsWith(year) ? today : `${year}-01-01`;
  }
  return today.startsWith(monthKey) ? today : `${monthKey}-01`;
}

function emptyDraft(sectionId: HouseSectionId, monthKey: string): Draft {
  const section = houseSection(sectionId);
  const first = section.categories[0]?.category || "";
  const group = KITCHEN_GROUPS[0];
  return {
    date: defaultDate(sectionId, monthKey),
    category: sectionId === "kitchen" ? group.category : first,
    customLabel: "",
    modificationChoice: MODIFICATION_OPTIONS[0],
    itemChoice: group.items[0],
    amount: "",
    note: "",
    quantity: "",
    unit: sectionId === "kitchen" ? "kg" : first && section.categories.find((item) => item.category === first)?.quantity ? "L" : "",
    quantityText: "",
  };
}

function draftFromExpense(row: HouseTrackerExpense, sectionId: HouseSectionId): Draft {
  const base = emptyDraft(sectionId, row.monthKey || row.date.slice(0, 7));
  const knownMod =
    row.category === "Modification" && (MODIFICATION_OPTIONS as readonly string[]).includes(row.customLabel);
  const group = KITCHEN_GROUPS.find((item) => item.category === row.category);
  const knownItem = group?.items.find((item) => item === row.customLabel && !item.startsWith("Other"));
  const otherItem = group?.items.find((item) => item.startsWith("Other"));
  return {
    ...base,
    date: row.date,
    category: row.category,
    customLabel: knownMod ? "" : row.customLabel,
    modificationChoice: row.category === "Modification" ? (knownMod ? row.customLabel : "Other") : base.modificationChoice,
    itemChoice: knownItem || otherItem || row.customLabel || base.itemChoice,
    amount: String(row.amount),
    note: row.note,
    quantity: row.quantity === null ? "" : String(row.quantity),
    unit: row.quantityText ? "text" : isQuantityUnit(row.unit) ? row.unit : base.unit,
    quantityText: row.quantityText,
  };
}

function ChoiceGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs text-ink-soft">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const checked = value === option.value;
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-2 border px-3 py-2 text-sm ${
                checked ? "border-ink bg-white text-ink" : "border-line/80 bg-white/40 text-ink-soft"
              }`}
            >
              <input
                type="radio"
                className="accent-[var(--mint)]"
                name={label}
                checked={checked}
                onChange={() => onChange(option.value)}
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function HouseSectionLedger({
  sectionId,
  data,
  monthKey,
  onMonthKey,
  pending,
  onSave,
  onDelete,
  onSaveFacts,
  onToggleFlag,
}: {
  sectionId: HouseSectionId;
  data: HouseTrackerData;
  monthKey: string;
  onMonthKey: (monthKey: string) => void;
  pending: boolean;
  onSave: (formData: FormData, editingId: string | null) => void;
  onDelete: (id: string) => void;
  onSaveFacts: (facts: { purchaseDate: string; purchasePrice: string; superBuiltupArea: string }) => void;
  onToggleFlag: (flag: "waterTaxApplicable" | "dishTvApplicable", value: boolean) => void;
}) {
  const section = houseSection(sectionId);
  const formRef = useRef<HTMLFormElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(sectionId, monthKey));
  const [showMorePurchase, setShowMorePurchase] = useState(false);
  const [year, setYear] = useState(monthKey.slice(0, 4));
  const [facts, setFacts] = useState({
    purchaseDate: data.profile.purchaseDate,
    purchasePrice: toInput(data.profile.purchasePrice),
    superBuiltupArea: toInput(data.profile.superBuiltupArea),
  });

  useEffect(() => {
    setYear(monthKey.slice(0, 4));
  }, [monthKey]);

  useEffect(() => {
    setFacts({
      purchaseDate: data.profile.purchaseDate,
      purchasePrice: toInput(data.profile.purchasePrice),
      superBuiltupArea: toInput(data.profile.superBuiltupArea),
    });
  }, [data.profile.id, data.profile.purchaseDate, data.profile.purchasePrice, data.profile.superBuiltupArea]);

  const rows = useMemo(
    () =>
      data.expenses
        .filter((row) => sectionForExpense(row) === sectionId)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [data.expenses, sectionId],
  );

  const visibleRows = useMemo(() => {
    if (section.cadence === "month") return rows.filter((row) => row.monthKey === monthKey);
    if (section.cadence === "year") return rows.filter((row) => row.date.startsWith(year));
    return rows;
  }, [monthKey, rows, section.cadence, year]);

  const waterOn = data.profile.details.waterTaxApplicable;
  const dishOn = data.profile.details.dishTvApplicable;
  const categories = section.categories.filter((category) => {
    if (category.category === "Water tax" && !waterOn && draft.category !== "Water tax") return false;
    if (category.category === "Dish TV" && !dishOn && draft.category !== "Dish TV") return false;
    if (sectionId === "onetime" && !showMorePurchase && !isPrimaryOnetimeCategory(category.category) && draft.category !== category.category) {
      return false;
    }
    return true;
  });

  const group = KITCHEN_GROUPS.find((item) => item.category === draft.category) || KITCHEN_GROUPS[0];
  const showQuantity = sectionId === "kitchen" || Boolean(section.categories.find((item) => item.category === draft.category)?.quantity);
  const expected = expectedMonthlyMaintenance(currentMaintenanceRate(data.profile.details.maintenanceRates), {
    carpetArea: data.profile.carpetArea,
    builtupArea: data.profile.builtupArea,
    superBuiltupArea: data.profile.superBuiltupArea,
    landArea: data.profile.landArea,
  });

  function patch(next: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  function beginCreate() {
    setEditingId(null);
    setDraft(emptyDraft(sectionId, section.cadence === "year" ? `${year}-01` : monthKey));
  }

  function beginEdit(row: HouseTrackerExpense) {
    setEditingId(row.id);
    if (sectionId === "onetime" && !isPrimaryOnetimeCategory(row.category)) setShowMorePurchase(true);
    setDraft(draftFromExpense(row, sectionId));
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    let category = sectionId === "maintenance" ? "Maintenance" : draft.category;
    let customLabel = draft.customLabel.trim();
    if (category === "Modification") {
      customLabel = draft.modificationChoice === "Other" ? customLabel || "Other" : draft.modificationChoice;
    }
    if (sectionId === "kitchen") {
      category = draft.category || group.category;
      customLabel = draft.itemChoice.startsWith("Other") ? customLabel || draft.itemChoice : draft.itemChoice;
    }

    const formData = new FormData();
    formData.set("houseId", data.profile.id);
    formData.set("date", draft.date);
    formData.set("kind", section.kind);
    formData.set("category", category);
    formData.set("customLabel", customLabel);
    formData.set("amount", draft.amount);
    formData.set("note", draft.note);
    formData.set("quantity", draft.unit === "text" ? "" : draft.quantity);
    formData.set("unit", showQuantity ? draft.unit : "");
    formData.set("quantityText", showQuantity && draft.unit === "text" ? draft.quantityText : "");
    onSave(formData, editingId);
    if (section.cadence === "month" && draft.date.slice(0, 7) !== monthKey) {
      onMonthKey(draft.date.slice(0, 7));
    }
  }

  const periodTotal = visibleRows.reduce((total, row) => total + row.amount, 0);
  const knownCategories = new Set(section.categories.map((category) => category.category));

  return (
    <div className="space-y-6">
      <section className="border border-line bg-white/50 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink">{section.label}</h2>
            <p className="mt-1 max-w-2xl text-sm text-ink-soft">{section.description}</p>
          </div>
          {section.cadence === "month" ? <MonthNavigator monthKey={monthKey} onChange={onMonthKey} /> : null}
          {section.cadence === "year" ? (
            <label className="block">
              <span className="mb-1 block text-xs text-ink-soft">Year</span>
              <input
                className="field w-32"
                type="number"
                min={1990}
                max={2100}
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </label>
          ) : null}
        </div>
        <p className="mt-4 text-sm text-ink-soft">
          {section.cadence === "once" ? "All one-time entries" : section.cadence === "year" ? `Entries in ${year}` : formatMonthLabel(monthKey)}
          {" · "}
          <span className="font-medium text-ink">{formatINR(periodTotal)}</span>
        </p>
      </section>

      {sectionId === "onetime" ? (
        <section className="border border-line bg-white/50 p-5">
          <h3 className="text-base font-bold text-ink">Sqft and purchase date</h3>
          <p className="mt-1 text-sm text-ink-soft">
            This is the area you bought and the date you bought it.
            {data.profile.carpetArea ? ` Carpet is already ${formatSqft(data.profile.carpetArea)}.` : ""}
            {data.profile.builtupArea ? ` Built-up is ${formatSqft(data.profile.builtupArea)}.` : ""}
          </p>
          <form
            className="mt-4 grid gap-3 md:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              onSaveFacts(facts);
            }}
          >
            <label className="block">
              <span className="mb-1 block text-xs text-ink-soft">Purchase date</span>
              <input
                className="field"
                type="date"
                value={facts.purchaseDate}
                onChange={(e) => setFacts((prev) => ({ ...prev, purchaseDate: e.target.value }))}
              />
            </label>
            <NumberField
              label="Sqft purchased"
              value={facts.superBuiltupArea}
              hint="Saved as super built-up area"
              onChange={(value) => setFacts((prev) => ({ ...prev, superBuiltupArea: value }))}
            />
            <NumberField
              label="Purchase price"
              value={facts.purchasePrice}
              onChange={(value) => setFacts((prev) => ({ ...prev, purchasePrice: value }))}
            />
            <div className="md:col-span-3">
              <button className="btn-secondary px-4 py-2 text-sm" type="submit" disabled={pending}>
                Save purchase facts
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {sectionId === "yearly" ? (
        <label className="flex items-center gap-2 border border-line bg-white/50 px-4 py-3 text-sm text-ink">
          <input
            type="checkbox"
            className="accent-[var(--mint)]"
            checked={waterOn}
            disabled={pending}
            onChange={(e) => onToggleFlag("waterTaxApplicable", e.target.checked)}
          />
          This house pays water tax
        </label>
      ) : null}

      {sectionId === "utility" ? (
        <label className="flex items-center gap-2 border border-line bg-white/50 px-4 py-3 text-sm text-ink">
          <input
            type="checkbox"
            className="accent-[var(--mint)]"
            checked={dishOn}
            disabled={pending}
            onChange={(e) => onToggleFlag("dishTvApplicable", e.target.checked)}
          />
          We have Dish TV
        </label>
      ) : null}

      <section className="border border-line bg-white/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-ink">{editingId ? "Edit entry" : "New entry"}</h3>
          {editingId ? (
            <button type="button" className="text-sm text-ink-soft hover:text-ink" onClick={beginCreate}>
              Cancel edit
            </button>
          ) : null}
        </div>
        {sectionId === "maintenance" && expected !== null ? (
          <p className="mt-1 text-sm text-ink-soft">Current rate works out to about {formatINR(expected)} a month.</p>
        ) : null}

        <form ref={formRef} className="mt-4 space-y-4" onSubmit={submit}>
          {sectionId !== "maintenance" && sectionId !== "kitchen" ? (
            <ChoiceGroup
              label="What is this expense?"
              value={draft.category}
              options={categories.map((category) => ({ value: category.category, label: category.label }))}
              onChange={(category) => {
                patch({
                  category,
                  unit: category.startsWith("Petrol") && !draft.unit ? "L" : draft.unit,
                });
              }}
            />
          ) : null}

          {sectionId === "onetime" ? (
            <button
              type="button"
              className="text-sm text-mint hover:underline"
              onClick={() => setShowMorePurchase((open) => !open)}
            >
              {showMorePurchase ? "Hide extra purchase costs" : "Down payment, stamp duty, interior, and other costs"}
            </button>
          ) : null}

          {draft.category === "Modification" ? (
            <div className="space-y-3">
              <ChoiceGroup
                label="Modification"
                value={draft.modificationChoice}
                options={MODIFICATION_OPTIONS.map((option) => ({ value: option, label: option }))}
                onChange={(modificationChoice) => patch({ modificationChoice })}
              />
              {draft.modificationChoice === "Other" ? (
                <label className="block">
                  <span className="mb-1 block text-xs text-ink-soft">What was modified?</span>
                  <input
                    className="field"
                    value={draft.customLabel}
                    placeholder="Describe the work"
                    onChange={(e) => patch({ customLabel: e.target.value })}
                  />
                </label>
              ) : null}
            </div>
          ) : null}

          {draft.category === "Pre-occupancy" ? (
            <label className="block">
              <span className="mb-1 block text-xs text-ink-soft">What was this?</span>
              <input
                className="field"
                value={draft.customLabel}
                placeholder="House inspection, cleaning, repairs"
                onChange={(e) => patch({ customLabel: e.target.value })}
              />
            </label>
          ) : null}

          {draft.category === "Other" && sectionId === "onetime" ? (
            <label className="block">
              <span className="mb-1 block text-xs text-ink-soft">Name this cost</span>
              <input className="field" value={draft.customLabel} onChange={(e) => patch({ customLabel: e.target.value })} />
            </label>
          ) : null}

          {sectionId === "kitchen" ? (
            <div className="space-y-4">
              <ChoiceGroup
                label="Which kind of item?"
                value={draft.category}
                options={KITCHEN_GROUPS.map((item) => ({ value: item.category, label: item.label }))}
                onChange={(category) => {
                  const nextGroup = KITCHEN_GROUPS.find((item) => item.category === category) || KITCHEN_GROUPS[0];
                  patch({ category, itemChoice: nextGroup.items[0], customLabel: "" });
                }}
              />
              <label className="block max-w-md">
                <span className="mb-1 block text-xs text-ink-soft">Item</span>
                <select
                  className="field"
                  value={group.items.includes(draft.itemChoice) ? draft.itemChoice : group.items.find((item) => item.startsWith("Other")) || group.items[0]}
                  onChange={(e) => patch({ itemChoice: e.target.value, customLabel: e.target.value.startsWith("Other") ? "" : e.target.value })}
                >
                  {group.items.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              {draft.itemChoice.startsWith("Other") ? (
                <label className="block">
                  <span className="mb-1 block text-xs text-ink-soft">Item name</span>
                  <input
                    className="field"
                    value={draft.customLabel}
                    placeholder="Type the item"
                    onChange={(e) => patch({ customLabel: e.target.value })}
                  />
                </label>
              ) : null}
            </div>
          ) : null}

          {showQuantity ? (
            <div className="space-y-3">
              <ChoiceGroup
                label="Quantity unit"
                value={draft.unit || "text"}
                options={QUANTITY_UNITS.map((unit) => ({ value: unit.id, label: unit.label }))}
                onChange={(unit) => patch({ unit: unit as QuantityUnitId })}
              />
              {(draft.unit || "text") === "text" ? (
                <label className="block">
                  <span className="mb-1 block text-xs text-ink-soft">Quantity, if the units above do not fit</span>
                  <textarea
                    className="field min-h-24"
                    value={draft.quantityText}
                    placeholder="Example: 2 packets, or half a tin"
                    onChange={(e) => patch({ quantityText: e.target.value })}
                  />
                </label>
              ) : (
                <div className="max-w-xs">
                  <NumberField
                    label={draft.unit === "g" ? "Grams" : draft.unit === "L" ? "Liters" : "Kilos"}
                    value={draft.quantity}
                    onChange={(quantity) => patch({ quantity })}
                  />
                </div>
              )}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs text-ink-soft">Date</span>
              <input className="field" type="date" required value={draft.date} onChange={(e) => patch({ date: e.target.value })} />
            </label>
            <NumberField
              label={sectionId === "kitchen" || sectionId === "food" ? "Price" : "Amount spent"}
              value={draft.amount}
              onChange={(amount) => patch({ amount })}
            />
          </div>
          <label className="block">
            <span className="mb-1 block text-xs text-ink-soft">Note, optional</span>
            <input className="field" value={draft.note} onChange={(e) => patch({ note: e.target.value })} />
          </label>
          <button className="btn-primary px-4 py-2 text-sm" type="submit" disabled={pending}>
            {pending ? "Saving..." : editingId ? "Update entry" : "Add entry"}
          </button>
        </form>
      </section>

      <section className="border border-line bg-white/50 p-5">
        <h3 className="text-base font-bold text-ink">Entries</h3>
        {visibleRows.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">Nothing here yet. Add the first one above.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line/70">
            {visibleRows.map((row) => {
              const qty = formatQuantity(row);
              const title = row.customLabel || categoryLabel(sectionId, row.category);
              const subtitle = row.customLabel ? categoryLabel(sectionId, row.category) : "";
              return (
                <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{title}</p>
                    <p className="mt-1 text-xs text-ink-soft">
                      {formatEntryDate(row.date)}
                      {subtitle ? ` · ${subtitle}` : ""}
                      {!knownCategories.has(row.category) ? " · earlier entry" : ""}
                      {qty ? ` · ${qty}` : ""}
                      {row.note ? ` · ${row.note}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-medium tabular-nums text-ink">{formatINR(row.amount)}</p>
                    <button type="button" className="text-sm text-ink hover:underline" onClick={() => beginEdit(row)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-sm text-coral hover:underline"
                      onClick={() => {
                        if (confirm("Delete this entry?")) onDelete(row.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
