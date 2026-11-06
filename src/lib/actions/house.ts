"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { monthKeyFromDate, currentMonthKey } from "@/lib/dates";
import {
  buildCostHeadProgress,
  computeUdsSqft,
  defaultHouseDetails,
  allowsCategory,
  isPropertyType,
  isQuantityUnit,
  legacySnapshotGaps,
  livingKindForCategory,
  loanPercentOfPrice,
  parseHouseDetails,
  sectionForExpense,
  serializeHouseDetails,
  type HouseBenefit,
  type HouseContact,
  type HouseDetailsPayload,
  type HouseExpenseKind,
  type HouseMaintenanceRate,
  type HouseSectionId,
} from "@/lib/house";

type HouseActionResult =
  | { ok: true }
  | { error: string };

export type HouseProfileSummary = {
  id: string;
  name: string;
  propertyType: string;
};

export type HouseTrackerExpense = {
  id: string;
  date: string;
  monthKey: string;
  kind: HouseExpenseKind;
  category: string;
  customLabel: string;
  amount: number;
  note: string;
  quantity: number | null;
  unit: string;
  quantityText: string;
  recurring: boolean;
  createdAt: string;
};

export type HouseTrackerProfile = {
  id: string;
  name: string;
  address: string;
  propertyType: string;
  purchaseDate: string;
  purchasePrice: number | null;
  carpetArea: number | null;
  builtupArea: number | null;
  superBuiltupArea: number | null;
  landArea: number | null;
  udsPercent: number | null;
  monthlyBudget: number | null;
  tdsApplicable: boolean;
  details: HouseDetailsPayload;
};

export type HouseTrackerData = {
  profiles: HouseProfileSummary[];
  profile: HouseTrackerProfile;
  expenses: HouseTrackerExpense[];
  totals: {
    purchasePaid: number;
    livingThisMonth: number;
    livingByMonth: { monthKey: string; total: number }[];
    purchaseByMonth: { monthKey: string; total: number }[];
    downPaymentPaid: number;
    downPaymentTarget: number;
    downPaymentProgressPct: number;
    downPaymentPending: number;
    loanPercent: number | null;
    udsSqft: number | null;
    udsBasis: "land" | "superBuiltup" | null;
    costHeads: ReturnType<typeof buildCostHeadProgress>;
    legacyGaps: ReturnType<typeof legacySnapshotGaps>;
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

function asKind(value: string): HouseExpenseKind {
  if (
    value === "living" ||
    value === "maintenance" ||
    value === "purchase" ||
    value === "yearly" ||
    value === "utility" ||
    value === "food" ||
    value === "kitchen" ||
    value === "transport"
  ) {
    return value;
  }
  return "purchase";
}

function readQuantity(formData: FormData): { quantity: number | null; unit: string; quantityText: string; error?: string } {
  const unitRaw = String(formData.get("unit") || "").trim();
  const quantityText = String(formData.get("quantityText") || "").trim();
  const quantity = parseNullableNumber(formData.get("quantity"));

  if (unitRaw === "text") {
    return { quantity: null, unit: "", quantityText };
  }
  if (unitRaw && !isQuantityUnit(unitRaw)) {
    return { quantity: null, unit: "", quantityText: "", error: "Pick grams, kilos, liters, or describe the quantity." };
  }
  if (quantity !== null && quantity < 0) {
    return { quantity: null, unit: "", quantityText: "", error: "Quantity cannot be negative." };
  }
  if (quantity === null) return { quantity: null, unit: "", quantityText: "" };
  return { quantity, unit: unitRaw, quantityText: "" };
}

function mapExpense(expense: {
  id: string;
  date: string;
  monthKey: string;
  kind: string;
  category: string;
  customLabel: string;
  amount: number;
  note: string;
  quantity: number | null;
  unit: string;
  quantityText: string;
  recurring: boolean;
  createdAt: Date;
}): HouseTrackerExpense {
  return {
    id: expense.id,
    date: expense.date,
    monthKey: expense.monthKey || monthKeyFromDate(expense.date),
    kind: asKind(expense.kind),
    category: expense.category,
    customLabel: expense.customLabel,
    amount: expense.amount,
    note: expense.note,
    quantity: expense.quantity,
    unit: expense.unit,
    quantityText: expense.quantityText,
    recurring: expense.recurring,
    createdAt: expense.createdAt.toISOString(),
  };
}

function summarizeProfile(profile: { id: string; name: string; propertyType: string }): HouseProfileSummary {
  return {
    id: profile.id,
    name: profile.name,
    propertyType: profile.propertyType,
  };
}

async function listUserProfiles(userId: string) {
  return prisma.houseProfile.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

async function createDefaultProfile(userId: string) {
  return prisma.houseProfile.create({
    data: {
      userId,
      name: "Main residence",
      address: "",
      propertyType: "Apartment",
      purchaseDate: null,
      purchasePrice: null,
      loanDetails: serializeHouseDetails(defaultHouseDetails()),
    },
  });
}

async function resolveHouseProfile(userId: string, houseId?: string | null) {
  const profiles = await listUserProfiles(userId);
  if (profiles.length === 0) {
    const created = await createDefaultProfile(userId);
    return { profile: created, profiles: [created] };
  }

  const selected =
    (houseId ? profiles.find((profile) => profile.id === houseId) : undefined) ?? profiles[0];
  return { profile: selected, profiles };
}

function requireHouseId(formData: FormData) {
  return String(formData.get("houseId") || "").trim();
}

async function requireOwnedProfile(userId: string, houseId: string) {
  const profile = await prisma.houseProfile.findFirst({
    where: { id: houseId, userId },
  });
  if (!profile) return null;
  return profile;
}

function monthBreakdown(expenses: HouseTrackerExpense[]) {
  const monthlyMap = new Map<string, number>();
  for (const expense of expenses) {
    const monthKey = expense.monthKey || monthKeyFromDate(expense.date);
    monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + expense.amount);
  }
  return [...monthlyMap.entries()]
    .map(([monthKey, total]) => ({ monthKey, total }))
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

function buildTotals(
  profile: HouseTrackerProfile,
  expenses: HouseTrackerExpense[],
  currentMonthKey: string,
): HouseTrackerData["totals"] {
  const purchase = expenses.filter((row) => row.kind === "purchase");
  const livingAndMaint = expenses.filter((row) => row.kind === "living" || row.kind === "maintenance");
  const downPaymentPaid = purchase
    .filter((row) => row.category === "Down payment")
    .reduce((sum, row) => sum + row.amount, 0);
  const downPaymentTarget = profile.details.downPaymentTarget || 0;
  const livingThisMonth = livingAndMaint
    .filter((row) => row.monthKey === currentMonthKey)
    .reduce((sum, row) => sum + row.amount, 0);

  const uds = computeUdsSqft(profile.udsPercent, {
    carpetArea: profile.carpetArea,
    builtupArea: profile.builtupArea,
    superBuiltupArea: profile.superBuiltupArea,
    landArea: profile.landArea,
  });

  return {
    purchasePaid: purchase.reduce((sum, row) => sum + row.amount, 0),
    livingThisMonth,
    livingByMonth: monthBreakdown(livingAndMaint),
    purchaseByMonth: monthBreakdown(purchase),
    downPaymentPaid,
    downPaymentTarget,
    downPaymentProgressPct:
      downPaymentTarget > 0 ? Math.min(100, (downPaymentPaid / downPaymentTarget) * 100) : 0,
    downPaymentPending: Math.max(0, downPaymentTarget - downPaymentPaid),
    loanPercent: loanPercentOfPrice(profile.details.loan.sanctionedAmount, profile.purchasePrice),
    udsSqft: uds.sqft,
    udsBasis: uds.basis,
    costHeads: buildCostHeadProgress(profile.details, purchase),
    legacyGaps: legacySnapshotGaps(profile.details, purchase),
  };
}

function toTrackerProfile(profile: {
  id: string;
  name: string;
  address: string;
  propertyType: string;
  purchaseDate: string | null;
  purchasePrice: number | null;
  carpetArea: number | null;
  builtupArea: number | null;
  superBuiltupArea: number | null;
  landArea: number | null;
  udsPercent: number | null;
  monthlyBudget: number | null;
  tdsApplicable: boolean;
  loanDetails: string;
}): HouseTrackerProfile {
  return {
    id: profile.id,
    name: profile.name,
    address: profile.address,
    propertyType: isPropertyType(profile.propertyType) ? profile.propertyType : "Apartment",
    purchaseDate: profile.purchaseDate || "",
    purchasePrice: profile.purchasePrice,
    carpetArea: profile.carpetArea,
    builtupArea: profile.builtupArea,
    superBuiltupArea: profile.superBuiltupArea,
    landArea: profile.landArea,
    udsPercent: profile.udsPercent,
    monthlyBudget: profile.monthlyBudget,
    tdsApplicable: profile.tdsApplicable,
    details: parseHouseDetails(profile.loanDetails),
  };
}

function revalidateHouse() {
  revalidatePath("/house");
  revalidatePath("/dashboard");
}

export async function getHouseTrackerData(houseId?: string | null): Promise<HouseTrackerData> {
  const user = await requireUser();
  const { profile, profiles } = await resolveHouseProfile(user.id, houseId);
  const trackerProfile = toTrackerProfile(profile);

  const expenses = await prisma.houseExpense.findMany({
    where: { userId: user.id, houseId: profile.id },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const mapped = expenses.map(mapExpense);
  const currentMonth = currentMonthKey();

  return {
    profiles: profiles.map(summarizeProfile),
    profile: trackerProfile,
    expenses: mapped,
    totals: buildTotals(trackerProfile, mapped, currentMonth),
  };
}

export async function createHouseProfile(formData: FormData): Promise<HouseActionResult & { id?: string }> {
  const user = await requireUser();
  const name = String(formData.get("name") || "").trim() || "New property";
  const propertyTypeRaw = String(formData.get("propertyType") || "Apartment").trim();
  const propertyType = isPropertyType(propertyTypeRaw) ? propertyTypeRaw : "Apartment";

  const created = await prisma.houseProfile.create({
    data: {
      userId: user.id,
      name,
      propertyType,
      address: "",
      loanDetails: serializeHouseDetails(defaultHouseDetails()),
    },
  });

  revalidateHouse();
  return { ok: true, id: created.id };
}

export async function deleteHouseProfile(houseId: string): Promise<HouseActionResult> {
  const user = await requireUser();
  const profiles = await listUserProfiles(user.id);
  if (profiles.length <= 1) {
    return { error: "Keep at least one property. Add another before deleting this one." };
  }

  const result = await prisma.houseProfile.deleteMany({
    where: { id: houseId, userId: user.id },
  });
  if (!result.count) return { error: "Property not found." };

  revalidateHouse();
  return { ok: true };
}

export async function updateHouseProfile(formData: FormData): Promise<HouseActionResult> {
  const user = await requireUser();
  const houseId = requireHouseId(formData);
  const profile = await requireOwnedProfile(user.id, houseId);
  if (!profile) return { error: "Property not found." };

  const parsed = parseHouseDetails(profile.loanDetails);
  const name = String(formData.get("name") || "").trim() || "Main residence";
  const address = String(formData.get("address") || "").trim();
  const propertyTypeRaw = String(formData.get("propertyType") || profile.propertyType).trim();
  const purchaseDate = String(formData.get("purchaseDate") || "").trim() || null;
  const purchasePrice = parseNullableNumber(formData.get("purchasePrice"));
  const downPaymentPercent = parseNullableNumber(formData.get("downPaymentPercent"));
  const downPaymentTarget = parseNullableNumber(formData.get("downPaymentTarget"));

  let benefits = parsed.benefits;
  const benefitsRaw = String(formData.get("benefitsJson") || "").trim();
  if (benefitsRaw) {
    try {
      const parsedBenefits = JSON.parse(benefitsRaw) as HouseBenefit[];
      if (Array.isArray(parsedBenefits)) benefits = parsedBenefits;
    } catch {
      return { error: "Benefits data is invalid." };
    }
  }

  let maintenanceRates = parsed.maintenanceRates;
  const ratesRaw = String(formData.get("maintenanceRatesJson") || "").trim();
  if (ratesRaw) {
    try {
      const parsedRates = JSON.parse(ratesRaw) as HouseMaintenanceRate[];
      if (Array.isArray(parsedRates)) {
        maintenanceRates = [...parsedRates].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
      }
    } catch {
      return { error: "Maintenance rate data is invalid." };
    }
  }

  const nextDetails: HouseDetailsPayload = {
    ...parsed,
    downPaymentPercent,
    downPaymentTarget,
    corpusTarget: parseNullableNumber(formData.get("corpusTarget")),
    tdsTarget: parseNullableNumber(formData.get("tdsTarget")),
    registrationTarget: parseNullableNumber(formData.get("registrationTarget")),
    stampDutyTarget: parseNullableNumber(formData.get("stampDutyTarget")),
    loan: {
      bank: String(formData.get("loanBank") || "").trim(),
      sanctionedAmount: parseNullableNumber(formData.get("loanSanctionedAmount")),
      tenureMonths: parseNullableInt(formData.get("loanTenureMonths")),
      interestRate: parseNullableNumber(formData.get("loanInterestRate")),
      outstandingAmount: parseNullableNumber(formData.get("loanOutstandingAmount")),
      outstandingEmiMonths: parseNullableInt(formData.get("loanOutstandingEmiMonths")),
    },
    benefits,
    maintenanceRates,
    contacts: parsed.contacts,
  };

  await prisma.houseProfile.update({
    where: { id: profile.id },
    data: {
      name,
      address,
      propertyType: isPropertyType(propertyTypeRaw) ? propertyTypeRaw : "Apartment",
      purchaseDate,
      purchasePrice,
      carpetArea: parseNullableNumber(formData.get("carpetArea")),
      builtupArea: parseNullableNumber(formData.get("builtupArea")),
      superBuiltupArea: parseNullableNumber(formData.get("superBuiltupArea")),
      landArea: parseNullableNumber(formData.get("landArea")),
      udsPercent: parseNullableNumber(formData.get("udsPercent")),
      monthlyBudget: parseNullableNumber(formData.get("monthlyBudget")),
      tdsApplicable: String(formData.get("tdsApplicable") || "") === "true",
      loanDetails: serializeHouseDetails(nextDetails),
    },
  });

  revalidateHouse();
  return { ok: true };
}

export async function updateHouseFlags(formData: FormData): Promise<HouseActionResult> {
  const user = await requireUser();
  const houseId = requireHouseId(formData);
  const profile = await requireOwnedProfile(user.id, houseId);
  if (!profile) return { error: "Property not found." };

  const parsed = parseHouseDetails(profile.loanDetails);
  const next = { ...parsed };
  if (formData.has("waterTaxApplicable")) {
    next.waterTaxApplicable = String(formData.get("waterTaxApplicable")) === "true";
  }
  if (formData.has("dishTvApplicable")) {
    next.dishTvApplicable = String(formData.get("dishTvApplicable")) === "true";
  }

  await prisma.houseProfile.update({
    where: { id: profile.id },
    data: { loanDetails: serializeHouseDetails(next) },
  });

  revalidateHouse();
  return { ok: true };
}

export async function updateHouseBudget(formData: FormData): Promise<HouseActionResult> {
  const user = await requireUser();
  const houseId = requireHouseId(formData);
  const profile = await requireOwnedProfile(user.id, houseId);
  if (!profile) return { error: "Property not found." };

  await prisma.houseProfile.update({
    where: { id: profile.id },
    data: { monthlyBudget: parseNullableNumber(formData.get("monthlyBudget")) },
  });

  revalidateHouse();
  return { ok: true };
}

function parseExpenseForm(formData: FormData):
  | {
      date: string;
      monthKey: string;
      kind: HouseExpenseKind;
      category: string;
      customLabel: string;
      amount: number;
      note: string;
      quantity: number | null;
      unit: string;
      quantityText: string;
      recurring: boolean;
    }
  | { error: string } {
  const date = String(formData.get("date") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const customLabel = String(formData.get("customLabel") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  const note = String(formData.get("note") || "").trim();
  const kind = asKind(String(formData.get("kind") || "purchase").trim());
  const section = sectionForExpense({ kind, category }) as HouseSectionId;

  if (!date) return { error: "Date is required." };
  if (!category) return { error: "Choose what this expense is for." };
  if (!Number.isFinite(amount) || amount < 0) return { error: "Amount must be zero or more." };
  if (amount <= 0) return { error: "Enter how much you spent." };
  if (!allowsCategory(section, category)) return { error: "Pick a valid expense type." };
  if (kind === "kitchen" && !customLabel) return { error: "Enter the item name." };
  if (category === "Modification" && !customLabel) return { error: "Choose the modification." };
  if (category === "Other" && kind !== "kitchen" && !customLabel && !note) {
    return { error: "Name this other expense." };
  }

  const quantity = readQuantity(formData);
  if (quantity.error) return { error: quantity.error };

  return {
    date,
    monthKey: monthKeyFromDate(date),
    kind,
    category,
    customLabel,
    amount,
    note,
    quantity: quantity.quantity,
    unit: quantity.unit,
    quantityText: quantity.quantityText,
    recurring: kind !== "purchase",
  };
}

export async function addHouseExpense(formData: FormData): Promise<HouseActionResult> {
  const user = await requireUser();
  const houseId = requireHouseId(formData);
  const profile = await requireOwnedProfile(user.id, houseId);
  if (!profile) return { error: "Property not found." };

  const parsedEntry = parseExpenseForm(formData);
  if ("error" in parsedEntry) return parsedEntry;

  await prisma.houseExpense.create({
    data: {
      userId: user.id,
      houseId: profile.id,
      ...parsedEntry,
    },
  });

  revalidateHouse();
  return { ok: true };
}

export async function updateHouseExpense(id: string, formData: FormData): Promise<HouseActionResult> {
  const user = await requireUser();

  const parsedEntry = parseExpenseForm(formData);
  if ("error" in parsedEntry) return parsedEntry;

  const result = await prisma.houseExpense.updateMany({
    where: { id, userId: user.id },
    data: parsedEntry,
  });

  if (!result.count) return { error: "Entry not found." };

  revalidateHouse();
  return { ok: true };
}

export async function deleteHouseExpense(id: string): Promise<HouseActionResult> {
  const user = await requireUser();
  await prisma.houseExpense.deleteMany({ where: { id, userId: user.id } });
  revalidateHouse();
  return { ok: true };
}

export async function upsertLivingMonth(formData: FormData): Promise<HouseActionResult> {
  const user = await requireUser();
  const houseId = requireHouseId(formData);
  const profile = await requireOwnedProfile(user.id, houseId);
  if (!profile) return { error: "Property not found." };

  const monthKey = String(formData.get("monthKey") || "").trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) {
    return { error: "Select a valid month." };
  }

  const rowsRaw = String(formData.get("rowsJson") || "").trim();
  let rows: { category: string; customLabel: string; amount: number; note: string; id?: string }[] = [];
  try {
    const parsed = JSON.parse(rowsRaw);
    if (!Array.isArray(parsed)) return { error: "Living expense data is invalid." };
    rows = parsed
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const item = row as Record<string, unknown>;
        const amount = Number(item.amount || 0);
        const category = String(item.category || "").trim();
        if (!category || !Number.isFinite(amount) || amount < 0) return null;
        return {
          id: item.id ? String(item.id) : undefined,
          category,
          customLabel: String(item.customLabel || "").trim(),
          amount,
          note: String(item.note || "").trim(),
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  } catch {
    return { error: "Living expense data is invalid." };
  }

  const existing = await prisma.houseExpense.findMany({
    where: {
      userId: user.id,
      houseId: profile.id,
      monthKey,
      kind: { in: ["living", "maintenance"] },
    },
  });

  const keepIds = new Set(rows.map((row) => row.id).filter(Boolean));
  const toDelete = existing.filter((row) => !keepIds.has(row.id));
  const date = `${monthKey}-01`;

  await prisma.$transaction(async (tx) => {
    if (toDelete.length > 0) {
      await tx.houseExpense.deleteMany({
        where: { userId: user.id, id: { in: toDelete.map((row) => row.id) } },
      });
    }

    for (const row of rows) {
      const kind = livingKindForCategory(row.category);
      if (row.id) {
        await tx.houseExpense.updateMany({
          where: { id: row.id, userId: user.id, houseId: profile.id },
          data: {
            date,
            monthKey,
            kind,
            category: row.category,
            customLabel: row.customLabel,
            amount: row.amount,
            note: row.note,
          },
        });
      } else if (row.amount > 0 || row.customLabel) {
        await tx.houseExpense.create({
          data: {
            userId: user.id,
            houseId: profile.id,
            date,
            monthKey,
            kind,
            category: row.category,
            customLabel: row.customLabel,
            amount: row.amount,
            note: row.note,
          },
        });
      }
    }
  });

  revalidateHouse();
  return { ok: true };
}

function contactFromForm(formData: FormData): Omit<HouseContact, "id"> | { error: string } {
  const department = String(formData.get("department") || "").trim();
  const person = String(formData.get("person") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!department && !person) {
    return { error: "Enter at least a role or contact person." };
  }

  return { department, person, phone, email, notes };
}

export async function addHouseContact(formData: FormData): Promise<HouseActionResult> {
  const user = await requireUser();
  const houseId = requireHouseId(formData);
  const profile = await requireOwnedProfile(user.id, houseId);
  if (!profile) return { error: "Property not found." };

  const parsed = parseHouseDetails(profile.loanDetails);
  const contact = contactFromForm(formData);
  if ("error" in contact) return contact;

  await prisma.houseProfile.update({
    where: { id: profile.id },
    data: {
      loanDetails: serializeHouseDetails({
        ...parsed,
        contacts: [{ id: randomUUID(), ...contact }, ...parsed.contacts],
      }),
    },
  });

  revalidatePath("/house");
  return { ok: true };
}

export async function updateHouseContact(contactId: string, formData: FormData): Promise<HouseActionResult> {
  const user = await requireUser();
  const houseId = requireHouseId(formData);
  const profile = await requireOwnedProfile(user.id, houseId);
  if (!profile) return { error: "Property not found." };

  const parsed = parseHouseDetails(profile.loanDetails);
  const contact = contactFromForm(formData);
  if ("error" in contact) return contact;
  if (!parsed.contacts.some((row) => row.id === contactId)) return { error: "Contact not found." };

  await prisma.houseProfile.update({
    where: { id: profile.id },
    data: {
      loanDetails: serializeHouseDetails({
        ...parsed,
        contacts: parsed.contacts.map((row) =>
          row.id === contactId ? { id: row.id, ...contact } : row,
        ),
      }),
    },
  });

  revalidatePath("/house");
  return { ok: true };
}

export async function deleteHouseContact(contactId: string, formData: FormData): Promise<HouseActionResult> {
  const user = await requireUser();
  const houseId = requireHouseId(formData);
  const profile = await requireOwnedProfile(user.id, houseId);
  if (!profile) return { error: "Property not found." };

  const parsed = parseHouseDetails(profile.loanDetails);
  await prisma.houseProfile.update({
    where: { id: profile.id },
    data: {
      loanDetails: serializeHouseDetails({
        ...parsed,
        contacts: parsed.contacts.filter((row) => row.id !== contactId),
      }),
    },
  });

  revalidatePath("/house");
  return { ok: true };
}
