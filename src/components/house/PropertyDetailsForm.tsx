"use client";

import { useMemo, useState } from "react";
import {
  HOUSE_BENEFIT_PRESETS,
  PROPERTY_TYPES,
  computeUdsSqft,
  currentMaintenanceRate,
  expectedMonthlyMaintenance,
  ratePeriodEnd,
  type HouseBenefit,
  type HouseMaintenanceRate,
} from "@/lib/house";
import { formatINR } from "@/lib/finance";
import { NumberField, toInput } from "@/components/house/fields";
import type { HouseTrackerProfile } from "@/lib/actions/house";

export type PropertyFormState = {
  name: string;
  address: string;
  propertyType: string;
  purchaseDate: string;
  purchasePrice: string;
  carpetArea: string;
  builtupArea: string;
  superBuiltupArea: string;
  landArea: string;
  udsPercent: string;
  monthlyBudget: string;
  tdsApplicable: boolean;
  corpusTarget: string;
  tdsTarget: string;
  registrationTarget: string;
  stampDutyTarget: string;
  downPaymentPercent: string;
  downPaymentTarget: string;
  loanBank: string;
  loanSanctionedAmount: string;
  loanTenureMonths: string;
  loanInterestRate: string;
  loanOutstandingAmount: string;
  loanOutstandingEmiMonths: string;
  benefits: HouseBenefit[];
  maintenanceRates: HouseMaintenanceRate[];
};

export function propertyFormFromProfile(profile: HouseTrackerProfile): PropertyFormState {
  const details = profile.details;
  return {
    name: profile.name,
    address: profile.address,
    propertyType: profile.propertyType,
    purchaseDate: profile.purchaseDate,
    purchasePrice: toInput(profile.purchasePrice),
    carpetArea: toInput(profile.carpetArea),
    builtupArea: toInput(profile.builtupArea),
    superBuiltupArea: toInput(profile.superBuiltupArea),
    landArea: toInput(profile.landArea),
    udsPercent: toInput(profile.udsPercent),
    monthlyBudget: toInput(profile.monthlyBudget),
    tdsApplicable: profile.tdsApplicable,
    corpusTarget: toInput(details.corpusTarget),
    tdsTarget: toInput(details.tdsTarget),
    registrationTarget: toInput(details.registrationTarget),
    stampDutyTarget: toInput(details.stampDutyTarget),
    downPaymentPercent: toInput(details.downPaymentPercent),
    downPaymentTarget: toInput(details.downPaymentTarget),
    loanBank: details.loan.bank,
    loanSanctionedAmount: toInput(details.loan.sanctionedAmount),
    loanTenureMonths: toInput(details.loan.tenureMonths),
    loanInterestRate: toInput(details.loan.interestRate),
    loanOutstandingAmount: toInput(details.loan.outstandingAmount),
    loanOutstandingEmiMonths: toInput(details.loan.outstandingEmiMonths),
    benefits: details.benefits,
    maintenanceRates: details.maintenanceRates,
  };
}

function newId() {
  return crypto.randomUUID();
}

export function PropertyDetailsForm({
  form,
  setForm,
  pending,
  onSave,
}: {
  form: PropertyFormState;
  setForm: (next: PropertyFormState | ((prev: PropertyFormState) => PropertyFormState)) => void;
  pending: boolean;
  onSave: (e: React.FormEvent) => void;
}) {
  const [benefitType, setBenefitType] = useState<(typeof HOUSE_BENEFIT_PRESETS)[number]>("Covered parking");
  const [benefitLabel, setBenefitLabel] = useState("");
  const [benefitDetail, setBenefitDetail] = useState("");
  const [benefitValue, setBenefitValue] = useState("");
  const [rateValue, setRateValue] = useState("");
  const [rateFrom, setRateFrom] = useState(new Date().toISOString().slice(0, 10));
  const [rateNote, setRateNote] = useState("");

  const uds = useMemo(() => {
    const percent = form.udsPercent.trim() ? Number(form.udsPercent) : null;
    return computeUdsSqft(Number.isFinite(percent) ? percent : null, {
      carpetArea: form.carpetArea ? Number(form.carpetArea) : null,
      builtupArea: form.builtupArea ? Number(form.builtupArea) : null,
      superBuiltupArea: form.superBuiltupArea ? Number(form.superBuiltupArea) : null,
      landArea: form.landArea ? Number(form.landArea) : null,
    });
  }, [form.udsPercent, form.carpetArea, form.builtupArea, form.superBuiltupArea, form.landArea]);

  const currentRate = currentMaintenanceRate(form.maintenanceRates);
  const expectedMonthly = expectedMonthlyMaintenance(currentRate, {
    carpetArea: form.carpetArea ? Number(form.carpetArea) : null,
    builtupArea: form.builtupArea ? Number(form.builtupArea) : null,
    superBuiltupArea: form.superBuiltupArea ? Number(form.superBuiltupArea) : null,
    landArea: form.landArea ? Number(form.landArea) : null,
  });

  function addBenefit() {
    const type = benefitType;
    const label = type === "Other" ? benefitLabel.trim() : "";
    if (type === "Other" && !label) return;
    setForm((prev) => ({
      ...prev,
      benefits: [
        ...prev.benefits,
        {
          id: newId(),
          type,
          label,
          detail: benefitDetail.trim(),
          value: benefitValue.trim(),
        },
      ],
    }));
    setBenefitLabel("");
    setBenefitDetail("");
    setBenefitValue("");
  }

  function addRate() {
    const ratePerSqft = Number(rateValue);
    if (!rateFrom || !Number.isFinite(ratePerSqft) || ratePerSqft < 0) return;
    setForm((prev) => ({
      ...prev,
      maintenanceRates: [...prev.maintenanceRates, {
        id: newId(),
        ratePerSqft,
        effectiveFrom: rateFrom,
        note: rateNote.trim(),
      }].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)),
    }));
    setRateValue("");
    setRateNote("");
  }

  return (
    <form onSubmit={onSave} className="space-y-6">
      <section className="border border-line bg-white/50 p-5">
        <h2 className="text-lg font-bold text-ink">Add your house information details</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Store one record per house, land, apartment, or commercial place.
        </p>

        <div className="mt-4">
          <p className="mb-2 text-xs text-ink-soft">Property type</p>
          <div className="flex flex-wrap gap-2">
            {PROPERTY_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={`px-3 py-1.5 text-xs font-medium transition ${
                  form.propertyType === type
                    ? "bg-ink text-white"
                    : "border border-line bg-white/70 text-ink-soft hover:text-ink"
                }`}
                onClick={() => setForm((prev) => ({ ...prev, propertyType: type }))}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs text-ink-soft">House or project name</span>
            <input
              className="field"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs text-ink-soft">Address</span>
            <textarea
              className="field min-h-20"
              value={form.address}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
            />
          </label>
          <NumberField
            label="Purchase price"
            value={form.purchasePrice}
            onChange={(value) => setForm((prev) => ({ ...prev, purchasePrice: value }))}
          />
          <label className="block">
            <span className="mb-1 block text-xs text-ink-soft">Purchase date</span>
            <input
              type="date"
              className="field"
              value={form.purchaseDate}
              onChange={(e) => setForm((prev) => ({ ...prev, purchaseDate: e.target.value }))}
            />
          </label>
        </div>
      </section>

      <section className="border border-line bg-white/50 p-5">
        <h2 className="text-lg font-bold text-ink">Project information</h2>
        <p className="mt-1 text-sm text-ink-soft">Carpet, built-up, and super built-up are all optional.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <NumberField label="Carpet area (sqft)" value={form.carpetArea} onChange={(value) => setForm((prev) => ({ ...prev, carpetArea: value }))} />
          <NumberField label="Built-up area (sqft)" value={form.builtupArea} onChange={(value) => setForm((prev) => ({ ...prev, builtupArea: value }))} />
          <NumberField label="Super built-up area (sqft)" value={form.superBuiltupArea} onChange={(value) => setForm((prev) => ({ ...prev, superBuiltupArea: value }))} />
          <NumberField
            label="Plot / land area (sqft)"
            value={form.landArea}
            onChange={(value) => setForm((prev) => ({ ...prev, landArea: value }))}
            hint="Used to convert UDS percent into sqft."
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <NumberField label="UDS percentage" value={form.udsPercent} onChange={(value) => setForm((prev) => ({ ...prev, udsPercent: value }))} />
          <NumberField
            label="UDS in sqft"
            value={uds.sqft === null ? "" : String(Number(uds.sqft.toFixed(2)))}
            readOnly
            hint={
              uds.basis === "superBuiltup"
                ? "Using super built-up because plot/land area is empty."
                : uds.basis === "land"
                  ? "Calculated from plot/land area."
                  : "Enter UDS % and plot/land or super built-up area."
            }
          />
        </div>
      </section>

      <section className="border border-line bg-white/50 p-5">
        <h2 className="text-lg font-bold text-ink">Maintenance per sqft</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Rate changes are stored as a timeline. Cash paid is logged on Purchase and Living tabs.
        </p>
        {currentRate ? (
          <p className="mt-3 text-sm text-ink">
            Current rate {formatINR(currentRate.ratePerSqft)} / sqft
            {expectedMonthly !== null ? ` · expected monthly ${formatINR(expectedMonthly)}` : ""}
          </p>
        ) : (
          <p className="mt-3 text-sm text-ink-soft">No rate added yet.</p>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <NumberField label="Rate per sqft" value={rateValue} onChange={setRateValue} />
          <label className="block">
            <span className="mb-1 block text-xs text-ink-soft">Effective from</span>
            <input type="date" className="field" value={rateFrom} onChange={(e) => setRateFrom(e.target.value)} />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs text-ink-soft">Note</span>
            <input className="field" value={rateNote} onChange={(e) => setRateNote(e.target.value)} placeholder="Society revision" />
          </label>
        </div>
        <button type="button" className="btn-secondary mt-3 px-4 py-2 text-sm" onClick={addRate}>
          Add rate change
        </button>

        {form.maintenanceRates.length > 0 ? (
          <div className="mt-4 space-y-2">
            {form.maintenanceRates.map((rate, index) => {
              const until = ratePeriodEnd(form.maintenanceRates, index);
              return (
                <div key={rate.id} className="flex items-start justify-between gap-3 border border-line/70 bg-white/40 p-3">
                  <div>
                    <p className="font-medium text-ink">{formatINR(rate.ratePerSqft)} / sqft</p>
                    <p className="font-mono text-xs text-ink-soft">
                      From {rate.effectiveFrom}
                      {until ? ` to ${until}` : " onwards"}
                    </p>
                    {rate.note ? <p className="mt-1 text-sm text-ink-soft">{rate.note}</p> : null}
                  </div>
                  <button
                    type="button"
                    className="text-xs text-coral hover:underline"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        maintenanceRates: prev.maintenanceRates.filter((row) => row.id !== rate.id),
                      }))
                    }
                  >
                    remove
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="border border-line bg-white/50 p-5">
        <h2 className="text-lg font-bold text-ink">Benefits provided</h2>
        <p className="mt-1 text-sm text-ink-soft">Pick a benefit, then add the detail and value.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs text-ink-soft">Benefit</span>
            <select
              className="field"
              value={benefitType}
              onChange={(e) => setBenefitType(e.target.value as (typeof HOUSE_BENEFIT_PRESETS)[number])}
            >
              {HOUSE_BENEFIT_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
            </select>
          </label>
          {benefitType === "Other" ? (
            <label className="block">
              <span className="mb-1 block text-xs text-ink-soft">Other benefit name</span>
              <input className="field" value={benefitLabel} onChange={(e) => setBenefitLabel(e.target.value)} />
            </label>
          ) : null}
          <label className="block">
            <span className="mb-1 block text-xs text-ink-soft">Detail</span>
            <input
              className="field"
              value={benefitDetail}
              onChange={(e) => setBenefitDetail(e.target.value)}
              placeholder="Basement B2, 2-wheeler bay..."
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-ink-soft">Value</span>
            <input
              className="field"
              value={benefitValue}
              onChange={(e) => setBenefitValue(e.target.value)}
              placeholder="Included / ₹2,00,000"
            />
          </label>
        </div>
        <button type="button" className="btn-secondary mt-3 px-4 py-2 text-sm" onClick={addBenefit}>
          Add benefit
        </button>
        {form.benefits.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {form.benefits.map((benefit) => (
              <span key={benefit.id} className="inline-flex items-center gap-2 border border-line bg-white/70 px-3 py-1.5 text-xs">
                <span className="font-medium text-ink">
                  {benefit.type === "Other" ? benefit.label || "Other" : benefit.type}
                </span>
                {benefit.detail ? <span className="text-ink-soft">{benefit.detail}</span> : null}
                {benefit.value ? <span className="text-ink-soft">{benefit.value}</span> : null}
                <button
                  type="button"
                  className="text-coral"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      benefits: prev.benefits.filter((row) => row.id !== benefit.id),
                    }))
                  }
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="border border-line bg-white/50 p-5">
        <h2 className="text-lg font-bold text-ink">Monthly living budget</h2>
        <p className="mt-1 text-sm text-ink-soft">Used on the Living expenses tab to compare spend against plan.</p>
        <div className="mt-4 max-w-xs">
          <NumberField
            label="Budget allocated per month"
            value={form.monthlyBudget}
            onChange={(value) => setForm((prev) => ({ ...prev, monthlyBudget: value }))}
          />
        </div>
      </section>

      <button disabled={pending} className="btn-primary px-4 py-2 text-sm" type="submit">
        {pending ? "Saving..." : "Save house details"}
      </button>
    </form>
  );
}
