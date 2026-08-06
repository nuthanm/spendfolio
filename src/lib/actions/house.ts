"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  HOUSE_EXPENSE_CATEGORIES,
  parseHouseDetails,
  serializeHouseDetails,
  type HouseContact,
  type HouseDetailsPayload,
} from "@/lib/house";

type HouseActionResult =
  | { ok: true }
  | { error: string };

export type HouseTrackerExpense = {
  id: string;
  date: string;
  category: string;
  amount: number;
  note: string;
  recurring: boolean;
  createdAt: string;
};

export type HouseTrackerData = {
  profile: {
    id: string;
    name: string;
    address: string;
    purchaseDate: string;
    purchasePrice: number | null;
    details: HouseDetailsPayload;
  };
  expenses: HouseTrackerExpense[];
  totals: {
    totalSpend: number;
    downPaymentProgressPct: number;
    downPaymentPending: number;
    monthlyBreakdown: { monthKey: string; total: number }[];
    categoryBreakdown: { category: string; total: number }[];
  };
};

function parseNullableNumber(input: FormDataEntryValue | null): number | null {
  if (input === null) return null;
  const value = String(input).trim();
  if (!value) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseNullableInt(input: FormDataEntryValue | null): number | null {
  const num = parseNullableNumber(input);
  if (num === null) return null;
  return Math.max(0, Math.floor(num));
}

async function getOrCreateHouseProfile(userId: string) {
  let profile = await prisma.houseProfile.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  if (!profile) {
    profile = await prisma.houseProfile.create({
      data: {
        userId,
        name: "Main residence",
        address: "",
        purchaseDate: null,
        purchasePrice: null,
        loanDetails: "{}",
      },
    });
  }

  return profile;
}

function buildTotals(expenses: HouseTrackerExpense[], details: HouseDetailsPayload) {
  const totalSpend = expenses.reduce((sum, row) => sum + row.amount, 0);
  const downPaymentTarget = details.downPaymentTarget || 0;
  const downPaymentPaid = details.downPaymentPaid || 0;
  const downPaymentProgressPct =
    downPaymentTarget > 0 ? Math.min(100, (downPaymentPaid / downPaymentTarget) * 100) : 0;
  const downPaymentPending = Math.max(0, downPaymentTarget - downPaymentPaid);

  const monthlyMap = new Map<string, number>();
  const categoryMap = new Map<string, number>();

  for (const expense of expenses) {
    const monthKey = expense.date.slice(0, 7);
    monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + expense.amount);
    categoryMap.set(expense.category, (categoryMap.get(expense.category) || 0) + expense.amount);
  }

  const monthlyBreakdown = [...monthlyMap.entries()]
    .map(([monthKey, total]) => ({ monthKey, total }))
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey));

  const categoryBreakdown = [...categoryMap.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  return {
    totalSpend,
    downPaymentProgressPct,
    downPaymentPending,
    monthlyBreakdown,
    categoryBreakdown,
  };
}

export async function getHouseTrackerData(): Promise<HouseTrackerData> {
  const user = await requireUser();
  const profile = await getOrCreateHouseProfile(user.id);
  const details = parseHouseDetails(profile.loanDetails);

  const expenses = await prisma.houseExpense.findMany({
    where: { userId: user.id, houseId: profile.id },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const mappedExpenses: HouseTrackerExpense[] = expenses.map((expense) => ({
    id: expense.id,
    date: expense.date,
    category: expense.category,
    amount: expense.amount,
    note: expense.note,
    recurring: expense.recurring,
    createdAt: expense.createdAt.toISOString(),
  }));

  return {
    profile: {
      id: profile.id,
      name: profile.name,
      address: profile.address,
      purchaseDate: profile.purchaseDate || "",
      purchasePrice: profile.purchasePrice,
      details,
    },
    expenses: mappedExpenses,
    totals: buildTotals(mappedExpenses, details),
  };
}

export async function updateHouseProfile(formData: FormData): Promise<HouseActionResult> {
  const user = await requireUser();
  const profile = await getOrCreateHouseProfile(user.id);
  const parsed = parseHouseDetails(profile.loanDetails);

  const name = String(formData.get("name") || "").trim() || "Main residence";
  const address = String(formData.get("address") || "").trim();
  const purchaseDate = String(formData.get("purchaseDate") || "").trim() || null;
  const purchasePrice = parseNullableNumber(formData.get("purchasePrice"));

  const nextDetails: HouseDetailsPayload = {
    downPaymentTarget: parseNullableNumber(formData.get("downPaymentTarget")),
    downPaymentPaid: parseNullableNumber(formData.get("downPaymentPaid")),
    loanSanctionedAmount: parseNullableNumber(formData.get("loanSanctionedAmount")),
    loanOutstandingAmount: parseNullableNumber(formData.get("loanOutstandingAmount")),
    outstandingEmiMonths: parseNullableInt(formData.get("outstandingEmiMonths")),
    raisedRequestPayments: parseNullableNumber(formData.get("raisedRequestPayments")),
    modificationAmount: parseNullableNumber(formData.get("modificationAmount")),
    tdsAmount: parseNullableNumber(formData.get("tdsAmount")),
    corpusAmount: parseNullableNumber(formData.get("corpusAmount")),
    registrationCost: parseNullableNumber(formData.get("registrationCost")),
    stampDuty: parseNullableNumber(formData.get("stampDuty")),
    contacts: parsed.contacts,
  };

  await prisma.houseProfile.update({
    where: { id: profile.id },
    data: {
      name,
      address,
      purchaseDate,
      purchasePrice,
      loanDetails: serializeHouseDetails(nextDetails),
    },
  });

  revalidatePath("/house");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function addHouseExpense(formData: FormData): Promise<HouseActionResult> {
  const user = await requireUser();
  const profile = await getOrCreateHouseProfile(user.id);

  const date = String(formData.get("date") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  const note = String(formData.get("note") || "").trim();
  const recurring = String(formData.get("recurring") || "false") === "true";

  if (!date) return { error: "Date is required." };
  if (!category) return { error: "Category is required." };
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: "Amount must be zero or more." };
  }

  await prisma.houseExpense.create({
    data: {
      userId: user.id,
      houseId: profile.id,
      date,
      category,
      amount,
      note,
      recurring,
    },
  });

  revalidatePath("/house");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateHouseExpense(id: string, formData: FormData): Promise<HouseActionResult> {
  const user = await requireUser();

  const date = String(formData.get("date") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  const note = String(formData.get("note") || "").trim();
  const recurring = String(formData.get("recurring") || "false") === "true";

  if (!date) return { error: "Date is required." };
  if (!category) return { error: "Category is required." };
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: "Amount must be zero or more." };
  }

  const result = await prisma.houseExpense.updateMany({
    where: { id, userId: user.id },
    data: { date, category, amount, note, recurring },
  });

  if (!result.count) return { error: "Entry not found." };

  revalidatePath("/house");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteHouseExpense(id: string): Promise<HouseActionResult> {
  const user = await requireUser();

  await prisma.houseExpense.deleteMany({ where: { id, userId: user.id } });

  revalidatePath("/house");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function addHouseContact(formData: FormData): Promise<HouseActionResult> {
  const user = await requireUser();
  const profile = await getOrCreateHouseProfile(user.id);
  const parsed = parseHouseDetails(profile.loanDetails);

  const department = String(formData.get("department") || "").trim();
  const person = String(formData.get("person") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!department && !person) {
    return { error: "Enter at least department or contact person." };
  }

  const nextContacts: HouseContact[] = [
    {
      id: randomUUID(),
      department,
      person,
      phone,
      email,
      notes,
    },
    ...parsed.contacts,
  ];

  await prisma.houseProfile.update({
    where: { id: profile.id },
    data: {
      loanDetails: serializeHouseDetails({
        ...parsed,
        contacts: nextContacts,
      }),
    },
  });

  revalidatePath("/house");
  return { ok: true };
}

export async function updateHouseContact(contactId: string, formData: FormData): Promise<HouseActionResult> {
  const user = await requireUser();
  const profile = await getOrCreateHouseProfile(user.id);
  const parsed = parseHouseDetails(profile.loanDetails);

  const department = String(formData.get("department") || "").trim();
  const person = String(formData.get("person") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  const found = parsed.contacts.some((contact) => contact.id === contactId);
  if (!found) return { error: "Contact not found." };

  const nextContacts = parsed.contacts.map((contact) =>
    contact.id === contactId
      ? { id: contact.id, department, person, phone, email, notes }
      : contact,
  );

  await prisma.houseProfile.update({
    where: { id: profile.id },
    data: {
      loanDetails: serializeHouseDetails({
        ...parsed,
        contacts: nextContacts,
      }),
    },
  });

  revalidatePath("/house");
  return { ok: true };
}

export async function deleteHouseContact(contactId: string): Promise<HouseActionResult> {
  const user = await requireUser();
  const profile = await getOrCreateHouseProfile(user.id);
  const parsed = parseHouseDetails(profile.loanDetails);

  const nextContacts = parsed.contacts.filter((contact) => contact.id !== contactId);

  await prisma.houseProfile.update({
    where: { id: profile.id },
    data: {
      loanDetails: serializeHouseDetails({
        ...parsed,
        contacts: nextContacts,
      }),
    },
  });

  revalidatePath("/house");
  return { ok: true };
}
