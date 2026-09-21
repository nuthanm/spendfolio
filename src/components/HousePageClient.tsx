"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addHouseContact,
  addHouseExpense,
  createHouseProfile,
  deleteHouseContact,
  deleteHouseExpense,
  deleteHouseProfile,
  getHouseTrackerData,
  updateHouseBudget,
  updateHouseContact,
  updateHouseExpense,
  updateHouseProfile,
  upsertLivingMonth,
  type HouseTrackerData,
} from "@/lib/actions/house";
import { formatINR } from "@/lib/finance";
import { currentMonthKey } from "@/lib/dates";
import { PropertySwitcher } from "@/components/house/PropertySwitcher";
import {
  PropertyDetailsForm,
  propertyFormFromProfile,
  type PropertyFormState,
} from "@/components/house/PropertyDetailsForm";
import { PurchasePaymentsTab } from "@/components/house/PurchasePaymentsTab";
import { LivingExpensesTab } from "@/components/house/LivingExpensesTab";
import { HouseContactsTab } from "@/components/house/HouseContactsTab";

type HouseTab = "property" | "purchase" | "living" | "contacts";

const TABS: { id: HouseTab; label: string }[] = [
  { id: "property", label: "Property" },
  { id: "purchase", label: "Purchase & payments" },
  { id: "living", label: "Living expenses" },
  { id: "contacts", label: "Contacts" },
];

export function HousePageClient({ initialData }: { initialData: HouseTrackerData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState(initialData);
  const [form, setForm] = useState<PropertyFormState>(() => propertyFormFromProfile(initialData.profile));
  const [activeTab, setActiveTab] = useState<HouseTab>("property");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setData(initialData);
    setForm(propertyFormFromProfile(initialData.profile));
  }, [initialData]);

  function flashSuccess(message: string) {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 1800);
  }

  function setHouseUrl(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("id", id);
    router.replace(`/house?${params.toString()}`, { scroll: false });
  }

  function refresh(houseId = data.profile.id) {
    startTransition(async () => {
      const next = await getHouseTrackerData(houseId);
      setData(next);
      setForm(propertyFormFromProfile(next.profile));
    });
  }

  function applyResult(result: { ok: true } | { error: string }, message: string, houseId?: string) {
    if ("error" in result) {
      setError(result.error);
      return false;
    }
    setError(null);
    flashSuccess(message);
    refresh(houseId);
    return true;
  }

  function onSelect(id: string) {
    setHouseUrl(id);
    startTransition(async () => {
      const next = await getHouseTrackerData(id);
      setData(next);
      setForm(propertyFormFromProfile(next.profile));
      setActiveTab("property");
    });
  }

  function onCreate(name: string, propertyType: string) {
    const fd = new FormData();
    fd.set("name", name);
    fd.set("propertyType", propertyType);
    startTransition(async () => {
      const result = await createHouseProfile(fd);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (result.id) {
        setHouseUrl(result.id);
        const next = await getHouseTrackerData(result.id);
        setData(next);
        setForm(propertyFormFromProfile(next.profile));
        setActiveTab("property");
        flashSuccess("Property added");
      }
    });
  }

  function onDeleteProperty(id: string) {
    if (!confirm("Delete this property and all of its house entries?")) return;
    startTransition(async () => {
      const result = await deleteHouseProfile(id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      const next = await getHouseTrackerData();
      setHouseUrl(next.profile.id);
      setData(next);
      setForm(propertyFormFromProfile(next.profile));
      flashSuccess("Property deleted");
    });
  }

  function buildProfileFormData() {
    const fd = new FormData();
    fd.set("houseId", data.profile.id);
    fd.set("name", form.name);
    fd.set("address", form.address);
    fd.set("propertyType", form.propertyType);
    fd.set("purchaseDate", form.purchaseDate);
    fd.set("purchasePrice", form.purchasePrice);
    fd.set("carpetArea", form.carpetArea);
    fd.set("builtupArea", form.builtupArea);
    fd.set("superBuiltupArea", form.superBuiltupArea);
    fd.set("landArea", form.landArea);
    fd.set("udsPercent", form.udsPercent);
    fd.set("monthlyBudget", form.monthlyBudget);
    fd.set("tdsApplicable", form.tdsApplicable ? "true" : "false");
    fd.set("corpusTarget", form.corpusTarget);
    fd.set("tdsTarget", form.tdsTarget);
    fd.set("registrationTarget", form.registrationTarget);
    fd.set("stampDutyTarget", form.stampDutyTarget);
    fd.set("downPaymentPercent", form.downPaymentPercent);
    fd.set("downPaymentTarget", form.downPaymentTarget);
    fd.set("loanBank", form.loanBank);
    fd.set("loanSanctionedAmount", form.loanSanctionedAmount);
    fd.set("loanTenureMonths", form.loanTenureMonths);
    fd.set("loanInterestRate", form.loanInterestRate);
    fd.set("loanOutstandingAmount", form.loanOutstandingAmount);
    fd.set("loanOutstandingEmiMonths", form.loanOutstandingEmiMonths);
    fd.set("benefitsJson", JSON.stringify(form.benefits));
    fd.set("maintenanceRatesJson", JSON.stringify(form.maintenanceRates));
    return fd;
  }

  function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateHouseProfile(buildProfileFormData());
      applyResult(result, "House details saved");
    });
  }

  const livingSpend = data.totals.livingThisMonth;
  const livingBudget = data.profile.monthlyBudget || 0;
  const livingOver = livingBudget > 0 && livingSpend > livingBudget;

  return (
    <div className="space-y-8 anim-rise">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border border-line bg-white/50 p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Purchase paid</p>
          <p className="mt-2 text-2xl font-bold text-ink">{formatINR(data.totals.purchasePaid)}</p>
        </div>
        <div className="border border-line bg-white/50 p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Down payment</p>
          <p className="mt-2 text-2xl font-bold text-ink">{data.totals.downPaymentProgressPct.toFixed(0)}%</p>
          <p className="mt-1 text-xs text-ink-soft">Pending: {formatINR(data.totals.downPaymentPending)}</p>
        </div>
        <div className="border border-line bg-white/50 p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Living this month</p>
          <p className={`mt-2 text-2xl font-bold ${livingOver ? "text-coral" : "text-ink"}`}>
            {formatINR(livingSpend)}
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            Budget {formatINR(livingBudget)} · {currentMonthKey()}
          </p>
        </div>
        <div className="border border-line bg-white/50 p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Loan</p>
          <p className="mt-2 text-lg font-bold text-ink">
            {formatINR(data.profile.details.loan.sanctionedAmount || 0)}
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            {data.totals.loanPercent === null ? "Set purchase price to see loan %" : `${data.totals.loanPercent.toFixed(1)}% of price`}
          </p>
        </div>
      </div>

      {error ? <div className="border border-coral/50 bg-red-100/70 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="border border-mint/40 bg-green-100/60 px-3 py-2 text-sm text-mint">{success}</div> : null}

      <PropertySwitcher
        profiles={data.profiles}
        selectedId={data.profile.id}
        pending={pending}
        onSelect={onSelect}
        onCreate={onCreate}
        onDelete={onDeleteProperty}
      />

      <section className="sticky top-2 z-20 border border-line bg-white/75 p-2 backdrop-blur-sm">
        <div className="flex gap-2 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-active={activeTab === tab.id}
              className="px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink data-[active=true]:border-b-2 data-[active=true]:border-mint data-[active=true]:text-ink"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "property" ? (
        <PropertyDetailsForm form={form} setForm={setForm} pending={pending} onSave={onSaveProfile} />
      ) : null}

      {activeTab === "purchase" ? (
        <PurchasePaymentsTab
          key={data.profile.id}
          data={data}
          form={form}
          setForm={setForm}
          pending={pending}
          onSaveTargets={onSaveProfile}
          onSavePayment={(payload, editingId) => {
            const fd = new FormData();
            fd.set("houseId", data.profile.id);
            fd.set("date", payload.date);
            fd.set("category", payload.category);
            fd.set("customLabel", payload.customLabel);
            fd.set("amount", payload.amount);
            fd.set("note", payload.note);
            fd.set("kind", "purchase");
            startTransition(async () => {
              const result = editingId
                ? await updateHouseExpense(editingId, fd)
                : await addHouseExpense(fd);
              applyResult(result, editingId ? "Payment updated" : "Payment added");
            });
          }}
          onDeletePayment={(id) => {
            if (!confirm("Delete this payment entry?")) return;
            startTransition(async () => {
              const result = await deleteHouseExpense(id);
              applyResult(result, "Payment deleted");
            });
          }}
        />
      ) : null}

      {activeTab === "living" ? (
        <LivingExpensesTab
          key={data.profile.id}
          data={data}
          pending={pending}
          onSaveBudget={(value) => {
            const fd = new FormData();
            fd.set("houseId", data.profile.id);
            fd.set("monthlyBudget", value);
            startTransition(async () => {
              const result = await updateHouseBudget(fd);
              if (applyResult(result, "Budget saved")) {
                setForm((prev) => ({ ...prev, monthlyBudget: value }));
              }
            });
          }}
          onSaveMonth={(monthKey, rows) => {
            const fd = new FormData();
            fd.set("houseId", data.profile.id);
            fd.set("monthKey", monthKey);
            fd.set("rowsJson", JSON.stringify(rows));
            startTransition(async () => {
              const result = await upsertLivingMonth(fd);
              applyResult(result, "Living expenses saved");
            });
          }}
        />
      ) : null}

      {activeTab === "contacts" ? (
        <HouseContactsTab
          key={data.profile.id}
          contacts={data.profile.details.contacts}
          pending={pending}
          onSave={(contact, editingId) => {
            const fd = new FormData();
            fd.set("houseId", data.profile.id);
            fd.set("department", contact.department);
            fd.set("person", contact.person);
            fd.set("phone", contact.phone);
            fd.set("email", contact.email);
            fd.set("notes", contact.notes);
            startTransition(async () => {
              const result = editingId
                ? await updateHouseContact(editingId, fd)
                : await addHouseContact(fd);
              applyResult(result, editingId ? "Contact updated" : "Contact added");
            });
          }}
          onDelete={(id) => {
            const fd = new FormData();
            fd.set("houseId", data.profile.id);
            startTransition(async () => {
              const result = await deleteHouseContact(id, fd);
              applyResult(result, "Contact deleted");
            });
          }}
        />
      ) : null}
    </div>
  );
}
