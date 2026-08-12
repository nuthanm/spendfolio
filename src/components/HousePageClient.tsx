"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addHouseContact,
  addHouseExpense,
  deleteHouseContact,
  deleteHouseExpense,
  getHouseTrackerData,
  updateHouseContact,
  updateHouseExpense,
  updateHouseProfile,
  type HouseTrackerData,
} from "@/lib/actions/house";
import { formatINR } from "@/lib/finance";
import { formatMonthLabel } from "@/lib/dates";
import { HOUSE_EXPENSE_CATEGORIES } from "@/lib/house";

type HouseExpense = HouseTrackerData["expenses"][number];
type HouseContact = HouseTrackerData["profile"]["details"]["contacts"][number];

type ProfileFormState = {
  name: string;
  address: string;
  purchaseDate: string;
  purchasePrice: string;
  downPaymentTarget: string;
  downPaymentPaid: string;
  loanSanctionedAmount: string;
  loanOutstandingAmount: string;
  outstandingEmiMonths: string;
  raisedRequestPayments: string;
  modificationAmount: string;
  tdsAmount: string;
  corpusAmount: string;
  registrationCost: string;
  stampDuty: string;
};

type ExpenseFormState = {
  date: string;
  category: string;
  amount: string;
  recurring: boolean;
  note: string;
};

type ContactFormState = {
  department: string;
  person: string;
  phone: string;
  email: string;
  notes: string;
};

type HouseTab = "profile" | "expenses" | "contacts";

function toInput(value: number | null) {
  return value === null ? "" : String(value);
}

function profileFormFromData(data: HouseTrackerData): ProfileFormState {
  const details = data.profile.details;
  return {
    name: data.profile.name,
    address: data.profile.address,
    purchaseDate: data.profile.purchaseDate,
    purchasePrice: toInput(data.profile.purchasePrice),
    downPaymentTarget: toInput(details.downPaymentTarget),
    downPaymentPaid: toInput(details.downPaymentPaid),
    loanSanctionedAmount: toInput(details.loanSanctionedAmount),
    loanOutstandingAmount: toInput(details.loanOutstandingAmount),
    outstandingEmiMonths: toInput(details.outstandingEmiMonths),
    raisedRequestPayments: toInput(details.raisedRequestPayments),
    modificationAmount: toInput(details.modificationAmount),
    tdsAmount: toInput(details.tdsAmount),
    corpusAmount: toInput(details.corpusAmount),
    registrationCost: toInput(details.registrationCost),
    stampDuty: toInput(details.stampDuty),
  };
}

function emptyExpenseForm(categories: string[]): ExpenseFormState {
  return {
    date: new Date().toISOString().slice(0, 10),
    category: categories[0] || "Other",
    amount: "",
    recurring: false,
    note: "",
  };
}

const emptyContactForm: ContactFormState = {
  department: "",
  person: "",
  phone: "",
  email: "",
  notes: "",
};

export function HousePageClient({ initialData }: { initialData: HouseTrackerData }) {
  const [data, setData] = useState(initialData);
  const categories = useMemo(() => [...HOUSE_EXPENSE_CATEGORIES], []);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");

  const [activeTab, setActiveTab] = useState<HouseTab>("expenses");
  const [profileForm, setProfileForm] = useState<ProfileFormState>(() =>
    profileFormFromData(initialData),
  );
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(() =>
    emptyExpenseForm(categories),
  );
  const [contactForm, setContactForm] = useState<ContactFormState>(emptyContactForm);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<string>("All");
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear, currentYear - 1]);
    for (const expense of data.expenses) {
      const year = Number(expense.date.slice(0, 4));
      if (Number.isFinite(year)) {
        years.add(year);
      }
    }
    return [...years].sort((a, b) => b - a);
  }, [currentYear, data.expenses]);

  const filteredEntries = useMemo(() => {
    const monthKey = `${selectedYear}-${selectedMonth}`;
    return data.expenses.filter((row) => {
      const matchesCategory =
        selectedExpenseCategory === "All" || row.category === selectedExpenseCategory;
      const matchesMonth = row.date.startsWith(monthKey);
      return matchesCategory && matchesMonth;
    });
  }, [data.expenses, selectedExpenseCategory, selectedYear, selectedMonth]);

  const filteredTotal = useMemo(
    () => filteredEntries.reduce((sum, row) => sum + row.amount, 0),
    [filteredEntries],
  );

  function flashSuccess(message: string) {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 1800);
  }

  function refreshData() {
    startTransition(async () => {
      const next = await getHouseTrackerData();
      setData(next);
      setProfileForm(profileFormFromData(next));
    });
  }

  function buildProfileFormData() {
    const fd = new FormData();
    fd.set("name", profileForm.name);
    fd.set("address", profileForm.address);
    fd.set("purchaseDate", profileForm.purchaseDate);
    fd.set("purchasePrice", profileForm.purchasePrice);
    fd.set("downPaymentTarget", profileForm.downPaymentTarget);
    fd.set("downPaymentPaid", profileForm.downPaymentPaid);
    fd.set("loanSanctionedAmount", profileForm.loanSanctionedAmount);
    fd.set("loanOutstandingAmount", profileForm.loanOutstandingAmount);
    fd.set("outstandingEmiMonths", profileForm.outstandingEmiMonths);
    fd.set("raisedRequestPayments", profileForm.raisedRequestPayments);
    fd.set("modificationAmount", profileForm.modificationAmount);
    fd.set("tdsAmount", profileForm.tdsAmount);
    fd.set("corpusAmount", profileForm.corpusAmount);
    fd.set("registrationCost", profileForm.registrationCost);
    fd.set("stampDuty", profileForm.stampDuty);
    return fd;
  }

  function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await updateHouseProfile(buildProfileFormData());
      if ("error" in res) {
        setError(res.error);
        return;
      }
      flashSuccess("House details saved");
      refreshData();
    });
  }

  function onSaveExpense(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.set("date", expenseForm.date);
    fd.set("category", expenseForm.category);
    fd.set("amount", expenseForm.amount);
    fd.set("note", expenseForm.note);
    fd.set("recurring", expenseForm.recurring ? "true" : "false");

    startTransition(async () => {
      const res = editingExpenseId
        ? await updateHouseExpense(editingExpenseId, fd)
        : await addHouseExpense(fd);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setEditingExpenseId(null);
      setExpenseForm(emptyExpenseForm(categories));
      flashSuccess(editingExpenseId ? "Entry updated" : "Entry added");
      refreshData();
    });
  }

  function onEditExpense(row: HouseExpense) {
    setEditingExpenseId(row.id);
    setExpenseForm({
      date: row.date,
      category: row.category,
      amount: String(row.amount),
      recurring: row.recurring,
      note: row.note,
    });
    setError(null);
  }

  function onDeleteExpense(id: string) {
    if (!confirm("Delete this house entry?")) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteHouseExpense(id);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      flashSuccess("Entry deleted");
      refreshData();
    });
  }

  function onSaveContact(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.set("department", contactForm.department);
    fd.set("person", contactForm.person);
    fd.set("phone", contactForm.phone);
    fd.set("email", contactForm.email);
    fd.set("notes", contactForm.notes);

    startTransition(async () => {
      const res = editingContactId
        ? await updateHouseContact(editingContactId, fd)
        : await addHouseContact(fd);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setEditingContactId(null);
      setContactForm(emptyContactForm);
      flashSuccess(editingContactId ? "Contact updated" : "Contact added");
      refreshData();
    });
  }

  function onEditContact(contact: HouseContact) {
    setEditingContactId(contact.id);
    setContactForm({
      department: contact.department,
      person: contact.person,
      phone: contact.phone,
      email: contact.email,
      notes: contact.notes,
    });
    setError(null);
  }

  function onDeleteContact(contactId: string) {
    if (!confirm("Delete this contact?")) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteHouseContact(contactId);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      flashSuccess("Contact deleted");
      refreshData();
    });
  }

  const monthFilterKey = `${selectedYear}-${selectedMonth}`;

  return (
    <div className="space-y-8 anim-rise">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border border-line bg-white/50 p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Total spend</p>
          <p className="mt-2 text-2xl font-bold text-ink">{formatINR(data.totals.totalSpend)}</p>
        </div>
        <div className="border border-line bg-white/50 p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Down payment</p>
          <p className="mt-2 text-2xl font-bold text-ink">{data.totals.downPaymentProgressPct.toFixed(0)}%</p>
          <p className="mt-1 text-xs text-ink-soft">Pending: {formatINR(data.totals.downPaymentPending)}</p>
        </div>
        <div className="border border-line bg-white/50 p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">Loan outstanding</p>
          <p className="mt-2 text-lg font-bold text-ink">
            {formatINR(data.profile.details.loanOutstandingAmount || 0)}
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            EMI months left: {data.profile.details.outstandingEmiMonths ?? 0}
          </p>
        </div>

      </div>

      {error ? <div className="border border-coral/50 bg-red-100/70 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="border border-mint/40 bg-green-100/60 px-3 py-2 text-sm text-mint">{success}</div> : null}

      <section className="sticky top-2 z-20 border border-line bg-white/75 p-2 backdrop-blur-sm">
        <div className="grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            className={`px-3 py-2 text-sm font-medium transition ${
              activeTab === "expenses"
                ? "bg-white text-ink shadow-sm"
                : "bg-transparent text-ink-soft hover:bg-white/70 hover:text-ink"
            }`}
            onClick={() => setActiveTab("expenses")}
          >
            Expenses + logs
          </button>
          <button
            type="button"
            className={`px-3 py-2 text-sm font-medium transition ${
              activeTab === "profile"
                ? "bg-white text-ink shadow-sm"
                : "bg-transparent text-ink-soft hover:bg-white/70 hover:text-ink"
            }`}
            onClick={() => setActiveTab("profile")}
          >
            Profile + loan tracker
          </button>
          <button
            type="button"
            className={`px-3 py-2 text-sm font-medium transition ${
              activeTab === "contacts"
                ? "bg-white text-ink shadow-sm"
                : "bg-transparent text-ink-soft hover:bg-white/70 hover:text-ink"
            }`}
            onClick={() => setActiveTab("contacts")}
          >
            Contacts
          </button>
        </div>
      </section>

      {activeTab === "profile" ? (
        <section className="border border-line bg-white/50 p-5">
          <h2 className="text-lg font-bold text-ink">House profile and loan tracker</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Keep down payment, TDS, corpus, registration, stamp duty, and outstanding loan/EMI months updated.
          </p>

          <form onSubmit={onSaveProfile} className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-ink-soft">House / Apartment Name</span>
                <input
                  className="field"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm((s) => ({ ...s, name: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-ink-soft">Purchase Date</span>
                <input
                  type="date"
                  className="field"
                  value={profileForm.purchaseDate}
                  onChange={(e) => setProfileForm((s) => ({ ...s, purchaseDate: e.target.value }))}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs text-ink-soft">Address</span>
              <textarea
                className="field min-h-20"
                value={profileForm.address}
                onChange={(e) => setProfileForm((s) => ({ ...s, address: e.target.value }))}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField label="Purchase Price" value={profileForm.purchasePrice} onChange={(value) => setProfileForm((s) => ({ ...s, purchasePrice: value }))} />
              <NumberField label="Down Payment Target" value={profileForm.downPaymentTarget} onChange={(value) => setProfileForm((s) => ({ ...s, downPaymentTarget: value }))} />
              <NumberField label="Down Payment Paid" value={profileForm.downPaymentPaid} onChange={(value) => setProfileForm((s) => ({ ...s, downPaymentPaid: value }))} />
              <NumberField label="Raised Request Payments" value={profileForm.raisedRequestPayments} onChange={(value) => setProfileForm((s) => ({ ...s, raisedRequestPayments: value }))} />
              <NumberField label="Modification Amount" value={profileForm.modificationAmount} onChange={(value) => setProfileForm((s) => ({ ...s, modificationAmount: value }))} />
              <NumberField label="TDS" value={profileForm.tdsAmount} onChange={(value) => setProfileForm((s) => ({ ...s, tdsAmount: value }))} />
              <NumberField label="Corpus" value={profileForm.corpusAmount} onChange={(value) => setProfileForm((s) => ({ ...s, corpusAmount: value }))} />
              <NumberField label="Registration Cost" value={profileForm.registrationCost} onChange={(value) => setProfileForm((s) => ({ ...s, registrationCost: value }))} />
              <NumberField label="Stamp Duty" value={profileForm.stampDuty} onChange={(value) => setProfileForm((s) => ({ ...s, stampDuty: value }))} />
              <NumberField label="Loan Sanctioned Amount" value={profileForm.loanSanctionedAmount} onChange={(value) => setProfileForm((s) => ({ ...s, loanSanctionedAmount: value }))} />
              <NumberField label="Loan Outstanding Amount" value={profileForm.loanOutstandingAmount} onChange={(value) => setProfileForm((s) => ({ ...s, loanOutstandingAmount: value }))} />
              <NumberField label="Outstanding EMI Months" value={profileForm.outstandingEmiMonths} onChange={(value) => setProfileForm((s) => ({ ...s, outstandingEmiMonths: value }))} />
            </div>

            <button disabled={pending} className="btn-primary px-4 py-2 text-sm" type="submit">
              {pending ? "Saving..." : "Save house details"}
            </button>
          </form>
        </section>
      ) : null}

      {activeTab === "expenses" ? (
        <section className="space-y-6">
          <section className="border border-line bg-white/50 p-5">
            <h2 className="text-lg font-bold text-ink">
              {editingExpenseId ? "Edit house entry" : "Add house expense entry"}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              Use this for interiors, maintenance, maid, house purchases, housewarming, and all home spend.
            </p>

            <form onSubmit={onSaveExpense} className="mt-4 grid gap-3 lg:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-ink-soft">Date</span>
                <input
                  type="date"
                  className="field"
                  required
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm((s) => ({ ...s, date: e.target.value }))}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-ink-soft">Category</span>
                <select
                  className="field"
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm((s) => ({ ...s, category: e.target.value }))}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-ink-soft">Amount</span>
                <input
                  className="field"
                  type="number"
                  step="any"
                  required
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm((s) => ({ ...s, amount: e.target.value }))}
                />
              </label>

              <label className="block lg:col-span-2">
                <span className="mb-1 block text-xs text-ink-soft">Notes</span>
                <textarea
                  className="field min-h-20"
                  value={expenseForm.note}
                  onChange={(e) => setExpenseForm((s) => ({ ...s, note: e.target.value }))}
                />
              </label>

              <label className="flex items-center gap-2 border border-line px-3 py-2 text-sm text-ink lg:col-span-2">
                <input
                  type="checkbox"
                  checked={expenseForm.recurring}
                  onChange={(e) => setExpenseForm((s) => ({ ...s, recurring: e.target.checked }))}
                />
                Recurring monthly expense
              </label>

              <div className="flex flex-wrap gap-2 lg:col-span-2">
                <button disabled={pending} className="btn-primary px-4 py-2 text-sm" type="submit">
                  {pending ? "Saving..." : editingExpenseId ? "Update entry" : "Add entry"}
                </button>
                {editingExpenseId ? (
                  <button
                    type="button"
                    className="btn-secondary px-4 py-2 text-sm"
                    onClick={() => {
                      setEditingExpenseId(null);
                      setExpenseForm(emptyExpenseForm(categories));
                    }}
                  >
                    Cancel edit
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section className="border border-line bg-white/50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-ink">House expense log</h2>
              <p className="text-sm text-ink-soft">
                Showing {selectedExpenseCategory} for {formatMonthLabel(monthFilterKey)}
              </p>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs text-ink-soft">Category tabs</p>
              <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex min-w-max gap-2">
                {["All", ...categories].map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={`px-3 py-1.5 text-xs font-medium transition ${
                      selectedExpenseCategory === category
                        ? "bg-ink text-white"
                        : "border border-line bg-white/70 text-ink-soft hover:text-ink"
                    }`}
                    onClick={() => setSelectedExpenseCategory(category)}
                  >
                    {category}
                  </button>
                ))}
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-ink-soft">Year</span>
                <select className="field" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                  {availableYears.map((year) => (
                    <option key={year} value={String(year)}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-ink-soft">Month</span>
                <select className="field" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                  {MONTH_OPTIONS.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="border border-line/70 bg-white/40 p-3">
                <p className="font-mono text-xs text-ink-soft">Filtered month spend</p>
                <p className="mt-1 text-lg font-bold text-ink">{formatINR(filteredTotal)}</p>
              </div>
              <div className="border border-line/70 bg-white/40 p-3">
                <p className="font-mono text-xs text-ink-soft">Entries in view</p>
                <p className="mt-1 text-lg font-bold text-ink">{filteredEntries.length}</p>
              </div>
            </div>

            {filteredEntries.length === 0 ? (
              <p className="mt-4 text-sm text-ink-soft">No house entries found for this month/category.</p>
            ) : (
              <div className="mt-4 space-y-2">
                {filteredEntries.map((row) => (
                  <div key={row.id} className="flex items-start justify-between gap-3 border border-line/70 bg-white/40 p-3">
                    <div>
                      <p className="font-medium text-ink">{row.category}</p>
                      <p className="font-mono text-xs text-ink-soft">
                        {row.date} {row.recurring ? "· recurring" : ""}
                      </p>
                      {row.note ? <p className="mt-1 text-sm text-ink-soft">{row.note}</p> : null}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-ink">{formatINR(row.amount)}</p>
                      <div className="mt-1 flex justify-end gap-2 text-xs">
                        <button className="text-ink-soft hover:text-ink" onClick={() => onEditExpense(row)}>
                          edit
                        </button>
                        <button className="text-coral hover:underline" onClick={() => onDeleteExpense(row.id)}>
                          delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="border border-line bg-white/50 p-5">
            <h2 className="text-lg font-bold text-ink">Month-wise spending summary</h2>
            {data.totals.monthlyBreakdown.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">No entries yet.</p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {data.totals.monthlyBreakdown.slice(0, 8).map((row) => (
                  <div key={row.monthKey} className="border border-line/70 bg-white/40 p-3">
                    <p className="font-mono text-xs text-ink-soft">{formatMonthLabel(row.monthKey)}</p>
                    <p className="mt-1 text-lg font-bold text-ink">{formatINR(row.total)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>
      ) : null}

      {activeTab === "contacts" ? (
        <section className="border border-line bg-white/50 p-5">
          <h2 className="text-lg font-bold text-ink">
            {editingContactId ? "Edit contact" : "Contacts (Icare / IFM / Help Desk)"}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">Maintain all apartment/house support contacts in one place.</p>

          <form onSubmit={onSaveContact} className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs text-ink-soft">Department / Use case</span>
              <input
                className="field"
                placeholder="Icare, IFM, Help Desk, Security..."
                value={contactForm.department}
                onChange={(e) => setContactForm((s) => ({ ...s, department: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-ink-soft">Contact Person</span>
              <input
                className="field"
                value={contactForm.person}
                onChange={(e) => setContactForm((s) => ({ ...s, person: e.target.value }))}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-ink-soft">Phone</span>
                <input
                  className="field"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm((s) => ({ ...s, phone: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-ink-soft">Email</span>
                <input
                  className="field"
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm((s) => ({ ...s, email: e.target.value }))}
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs text-ink-soft">Notes</span>
              <textarea
                className="field min-h-20"
                value={contactForm.notes}
                onChange={(e) => setContactForm((s) => ({ ...s, notes: e.target.value }))}
              />
            </label>

            <div className="flex gap-2">
              <button disabled={pending} className="btn-primary px-4 py-2 text-sm" type="submit">
                {editingContactId ? "Update contact" : "Add contact"}
              </button>
              {editingContactId ? (
                <button
                  type="button"
                  className="btn-secondary px-4 py-2 text-sm"
                  onClick={() => {
                    setEditingContactId(null);
                    setContactForm(emptyContactForm);
                  }}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>

          {data.profile.details.contacts.length > 0 ? (
            <div className="mt-4 space-y-2">
              {data.profile.details.contacts.map((contact) => (
                <div key={contact.id} className="border border-line/70 bg-white/40 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink">{contact.department || "General"}</p>
                      <p className="text-sm text-ink-soft">{contact.person || "-"}</p>
                      {contact.phone ? <p className="text-xs text-ink-soft">Phone: {contact.phone}</p> : null}
                      {contact.email ? <p className="text-xs text-ink-soft">Email: {contact.email}</p> : null}
                      {contact.notes ? <p className="mt-1 text-xs text-ink-soft">{contact.notes}</p> : null}
                    </div>
                    <div className="flex gap-2 text-xs">
                      <button className="text-ink-soft hover:text-ink" onClick={() => onEditContact(contact)}>
                        edit
                      </button>
                      <button className="text-coral hover:underline" onClick={() => onDeleteContact(contact.id)}>
                        delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-soft">No contacts added yet.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}

const MONTH_OPTIONS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-ink-soft">{label}</span>
      <input className="field" type="number" step="any" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
