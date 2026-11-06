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
  updateHouseContact,
  updateHouseExpense,
  updateHouseFlags,
  updateHouseProfile,
  type HouseTrackerData,
} from "@/lib/actions/house";
import { currentMonthKey } from "@/lib/dates";
import { HOUSE_SECTIONS, type HouseSectionId } from "@/lib/house";
import { PropertySwitcher } from "@/components/house/PropertySwitcher";
import {
  PropertyDetailsForm,
  propertyFormFromProfile,
  type PropertyFormState,
} from "@/components/house/PropertyDetailsForm";
import { HouseContactsTab } from "@/components/house/HouseContactsTab";
import { HouseDashboard } from "@/components/house/HouseDashboard";
import { HouseSectionLedger } from "@/components/house/HouseSectionLedger";

type HouseTab = "dashboard" | HouseSectionId | "property" | "contacts";

const TABS: { id: HouseTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  ...HOUSE_SECTIONS.map((section) => ({ id: section.id as HouseTab, label: section.shortLabel })),
  { id: "property", label: "Property" },
  { id: "contacts", label: "Contacts" },
];

export function HousePageClient({ initialData }: { initialData: HouseTrackerData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState(initialData);
  const [form, setForm] = useState<PropertyFormState>(() => propertyFormFromProfile(initialData.profile));
  const [activeTab, setActiveTab] = useState<HouseTab>("dashboard");
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [entrySavedTick, setEntrySavedTick] = useState(0);
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

  function applyResult(
    result: { ok: true } | { error: string },
    message: string,
    houseId?: string,
    entry = false,
  ) {
    if ("error" in result) {
      setError(result.error);
      return false;
    }
    setError(null);
    flashSuccess(message);
    if (entry) setEntrySavedTick((tick) => tick + 1);
    refresh(houseId);
    return true;
  }

  function onSelect(id: string) {
    setHouseUrl(id);
    startTransition(async () => {
      const next = await getHouseTrackerData(id);
      setData(next);
      setForm(propertyFormFromProfile(next.profile));
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
        setActiveTab("dashboard");
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

  const sectionTab = HOUSE_SECTIONS.find((section) => section.id === activeTab)?.id;

  function saveEntry(formData: FormData, editingId: string | null) {
    startTransition(async () => {
      const result = editingId ? await updateHouseExpense(editingId, formData) : await addHouseExpense(formData);
      applyResult(result, editingId ? "Entry updated" : "Entry added", undefined, true);
    });
  }

  return (
    <div className="space-y-8 anim-rise">
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

      {activeTab === "dashboard" ? (
        <HouseDashboard
          data={data}
          monthKey={monthKey}
          onMonthKey={setMonthKey}
          onOpenSection={(sectionId) => setActiveTab(sectionId)}
        />
      ) : null}

      {sectionTab ? (
        <HouseSectionLedger
          key={`${data.profile.id}-${sectionTab}-${entrySavedTick}`}
          sectionId={sectionTab}
          data={data}
          monthKey={monthKey}
          onMonthKey={setMonthKey}
          pending={pending}
          onSave={saveEntry}
          onDelete={(id) => {
            startTransition(async () => {
              const result = await deleteHouseExpense(id);
              applyResult(result, "Entry deleted", undefined, true);
            });
          }}
          onSaveFacts={(facts) => {
            setForm((prev) => ({ ...prev, ...facts }));
            const fd = buildProfileFormData();
            fd.set("purchaseDate", facts.purchaseDate);
            fd.set("purchasePrice", facts.purchasePrice);
            fd.set("superBuiltupArea", facts.superBuiltupArea);
            startTransition(async () => {
              const result = await updateHouseProfile(fd);
              applyResult(result, "Purchase facts saved");
            });
          }}
          onToggleFlag={(flag, value) => {
            const fd = new FormData();
            fd.set("houseId", data.profile.id);
            fd.set(flag, value ? "true" : "false");
            startTransition(async () => {
              const result = await updateHouseFlags(fd);
              applyResult(result, "Saved");
            });
          }}
        />
      ) : null}

      {activeTab === "property" ? (
        <PropertyDetailsForm form={form} setForm={setForm} pending={pending} onSave={onSaveProfile} />
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
