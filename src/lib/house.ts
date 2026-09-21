export const PROPERTY_TYPES = ["Apartment", "House", "Land", "Commercial"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const HOUSE_BENEFIT_PRESETS = [
  "Covered parking",
  "Open parking",
  "Club",
  "Gym",
  "Power backup",
  "Water",
  "Gated security",
  "Garden/terrace",
  "Other",
] as const;
export type HouseBenefitPreset = (typeof HOUSE_BENEFIT_PRESETS)[number];

export const CONTACT_ROLES = [
  "Maid",
  "Milk",
  "Electrician",
  "Plumber",
  "Carpenter",
  "Internet",
  "Gas",
  "Security",
  "IFM / Icare",
  "Association",
  "Other",
] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];

export const PURCHASE_COST_HEADS = [
  "Down payment",
  "Corpus",
  "TDS",
  "Registration",
  "Stamp duty",
  "Raised request",
  "Modification",
  "Interior",
  "Loan EMI",
  "Other",
] as const;
export type PurchaseCostHead = (typeof PURCHASE_COST_HEADS)[number];

export const LIVING_CATEGORIES = [
  "Maintenance",
  "Maid",
  "Internet",
  "Gas / piped gas",
  "Milk",
  "Rice",
  "Groceries",
  "Fruits",
  "Vegetables",
  "Household items",
  "Other",
] as const;
export type LivingCategory = (typeof LIVING_CATEGORIES)[number];

export const HOUSE_EXPENSE_KINDS = ["purchase", "living", "maintenance"] as const;
export type HouseExpenseKind = (typeof HOUSE_EXPENSE_KINDS)[number];

/** @deprecated Use PURCHASE_COST_HEADS / LIVING_CATEGORIES */
export const HOUSE_EXPENSE_CATEGORIES = [
  ...PURCHASE_COST_HEADS,
  ...LIVING_CATEGORIES,
] as const;
export type HouseExpenseCategory = (typeof HOUSE_EXPENSE_CATEGORIES)[number];

export type HouseContact = {
  id: string;
  department: string;
  person: string;
  phone: string;
  email: string;
  notes: string;
};

export type HouseBenefit = {
  id: string;
  type: string;
  label: string;
  detail: string;
  value: string;
};

export type HouseMaintenanceRate = {
  id: string;
  ratePerSqft: number;
  effectiveFrom: string;
  note: string;
};

export type HouseLoanDetails = {
  bank: string;
  sanctionedAmount: number | null;
  tenureMonths: number | null;
  interestRate: number | null;
  outstandingAmount: number | null;
  outstandingEmiMonths: number | null;
};

export type HouseLegacyPaidSnapshot = {
  downPaymentPaid: number | null;
  raisedRequestPayments: number | null;
  modificationAmount: number | null;
  tdsAmount: number | null;
  corpusAmount: number | null;
  registrationCost: number | null;
  stampDuty: number | null;
};

export type HouseDetailsPayload = {
  downPaymentPercent: number | null;
  downPaymentTarget: number | null;
  corpusTarget: number | null;
  tdsTarget: number | null;
  registrationTarget: number | null;
  stampDutyTarget: number | null;
  loan: HouseLoanDetails;
  benefits: HouseBenefit[];
  maintenanceRates: HouseMaintenanceRate[];
  contacts: HouseContact[];
  legacyPaid: HouseLegacyPaidSnapshot;
};

export type HouseAreas = {
  carpetArea: number | null;
  builtupArea: number | null;
  superBuiltupArea: number | null;
  landArea: number | null;
};

export type UdsResult = {
  sqft: number | null;
  basis: "land" | "superBuiltup" | null;
};

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toNullableInt(value: unknown): number | null {
  const num = toNullableNumber(value);
  if (num === null) return null;
  return Math.max(0, Math.floor(num));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseContacts(raw: unknown): HouseContact[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((contact) => {
      const row = asRecord(contact);
      if (!row) return null;
      const id = String(row.id || "");
      if (!id) return null;
      return {
        id,
        department: String(row.department || ""),
        person: String(row.person || ""),
        phone: String(row.phone || ""),
        email: String(row.email || ""),
        notes: String(row.notes || ""),
      };
    })
    .filter((contact): contact is HouseContact => Boolean(contact));
}

function parseBenefits(raw: unknown): HouseBenefit[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((benefit) => {
      const row = asRecord(benefit);
      if (!row) return null;
      const id = String(row.id || "");
      if (!id) return null;
      return {
        id,
        type: String(row.type || ""),
        label: String(row.label || ""),
        detail: String(row.detail || ""),
        value: String(row.value || ""),
      };
    })
    .filter((benefit): benefit is HouseBenefit => Boolean(benefit));
}

function parseMaintenanceRates(raw: unknown): HouseMaintenanceRate[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((rate) => {
      const row = asRecord(rate);
      if (!row) return null;
      const id = String(row.id || "");
      const ratePerSqft = toNullableNumber(row.ratePerSqft);
      const effectiveFrom = String(row.effectiveFrom || "");
      if (!id || ratePerSqft === null || !effectiveFrom) return null;
      return {
        id,
        ratePerSqft,
        effectiveFrom,
        note: String(row.note || ""),
      };
    })
    .filter((rate): rate is HouseMaintenanceRate => Boolean(rate))
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
}

function parseLoan(parsed: Record<string, unknown>): HouseLoanDetails {
  const nested = asRecord(parsed.loan);
  return {
    bank: String(nested?.bank ?? parsed.loanBank ?? ""),
    sanctionedAmount: toNullableNumber(nested?.sanctionedAmount ?? parsed.loanSanctionedAmount),
    tenureMonths: toNullableInt(nested?.tenureMonths ?? parsed.loanTenureMonths),
    interestRate: toNullableNumber(nested?.interestRate ?? parsed.loanInterestRate),
    outstandingAmount: toNullableNumber(nested?.outstandingAmount ?? parsed.loanOutstandingAmount),
    outstandingEmiMonths: toNullableInt(nested?.outstandingEmiMonths ?? parsed.outstandingEmiMonths),
  };
}

export function defaultHouseDetails(): HouseDetailsPayload {
  return {
    downPaymentPercent: null,
    downPaymentTarget: null,
    corpusTarget: null,
    tdsTarget: null,
    registrationTarget: null,
    stampDutyTarget: null,
    loan: {
      bank: "",
      sanctionedAmount: null,
      tenureMonths: null,
      interestRate: null,
      outstandingAmount: null,
      outstandingEmiMonths: null,
    },
    benefits: [],
    maintenanceRates: [],
    contacts: [],
    legacyPaid: {
      downPaymentPaid: null,
      raisedRequestPayments: null,
      modificationAmount: null,
      tdsAmount: null,
      corpusAmount: null,
      registrationCost: null,
      stampDuty: null,
    },
  };
}

export function parseHouseDetails(raw: string | null | undefined): HouseDetailsPayload {
  const base = defaultHouseDetails();
  if (!raw) return base;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const legacyRaw = asRecord(parsed.legacyPaid);

    return {
      downPaymentPercent: toNullableNumber(parsed.downPaymentPercent),
      downPaymentTarget: toNullableNumber(parsed.downPaymentTarget),
      corpusTarget: toNullableNumber(parsed.corpusTarget ?? parsed.corpusAmount),
      tdsTarget: toNullableNumber(parsed.tdsTarget ?? parsed.tdsAmount),
      registrationTarget: toNullableNumber(parsed.registrationTarget ?? parsed.registrationCost),
      stampDutyTarget: toNullableNumber(parsed.stampDutyTarget ?? parsed.stampDuty),
      loan: parseLoan(parsed),
      benefits: parseBenefits(parsed.benefits),
      maintenanceRates: parseMaintenanceRates(parsed.maintenanceRates),
      contacts: parseContacts(parsed.contacts),
      legacyPaid: {
        downPaymentPaid: toNullableNumber(legacyRaw?.downPaymentPaid ?? parsed.downPaymentPaid),
        raisedRequestPayments: toNullableNumber(
          legacyRaw?.raisedRequestPayments ?? parsed.raisedRequestPayments,
        ),
        modificationAmount: toNullableNumber(legacyRaw?.modificationAmount ?? parsed.modificationAmount),
        tdsAmount: toNullableNumber(legacyRaw?.tdsAmount ?? parsed.tdsAmount),
        corpusAmount: toNullableNumber(legacyRaw?.corpusAmount ?? parsed.corpusAmount),
        registrationCost: toNullableNumber(legacyRaw?.registrationCost ?? parsed.registrationCost),
        stampDuty: toNullableNumber(legacyRaw?.stampDuty ?? parsed.stampDuty),
      },
    };
  } catch {
    return base;
  }
}

export function serializeHouseDetails(details: HouseDetailsPayload): string {
  return JSON.stringify(details);
}

export function isPropertyType(value: string): value is PropertyType {
  return (PROPERTY_TYPES as readonly string[]).includes(value);
}

export function isPurchaseCostHead(value: string): value is PurchaseCostHead {
  return (PURCHASE_COST_HEADS as readonly string[]).includes(value);
}

export function livingKindForCategory(category: string): HouseExpenseKind {
  return category === "Maintenance" ? "maintenance" : "living";
}

export function maintenanceAreaSqft(areas: HouseAreas): number | null {
  return areas.superBuiltupArea ?? areas.builtupArea ?? areas.carpetArea;
}

export function computeUdsSqft(udsPercent: number | null, areas: HouseAreas): UdsResult {
  if (udsPercent === null) return { sqft: null, basis: null };
  if (areas.landArea && areas.landArea > 0) {
    return { sqft: (udsPercent / 100) * areas.landArea, basis: "land" };
  }
  if (areas.superBuiltupArea && areas.superBuiltupArea > 0) {
    return { sqft: (udsPercent / 100) * areas.superBuiltupArea, basis: "superBuiltup" };
  }
  return { sqft: null, basis: null };
}

export function currentMaintenanceRate(
  rates: HouseMaintenanceRate[],
  onDate = new Date().toISOString().slice(0, 10),
): HouseMaintenanceRate | null {
  const applicable = rates.filter((rate) => rate.effectiveFrom <= onDate);
  return applicable.at(-1) ?? rates.at(-1) ?? null;
}

export function expectedMonthlyMaintenance(
  rate: HouseMaintenanceRate | null,
  areas: HouseAreas,
): number | null {
  const area = maintenanceAreaSqft(areas);
  if (!rate || area === null) return null;
  return rate.ratePerSqft * area;
}

export function loanPercentOfPrice(sanctioned: number | null, purchasePrice: number | null): number | null {
  if (!sanctioned || !purchasePrice || purchasePrice <= 0) return null;
  return (sanctioned / purchasePrice) * 100;
}

export function downPaymentAmountFromPercent(
  percent: number | null,
  purchasePrice: number | null,
): number | null {
  if (percent === null || !purchasePrice || purchasePrice <= 0) return null;
  return (purchasePrice * percent) / 100;
}

export function downPaymentPercentFromAmount(
  amount: number | null,
  purchasePrice: number | null,
): number | null {
  if (amount === null || !purchasePrice || purchasePrice <= 0) return null;
  return (amount / purchasePrice) * 100;
}

export function ratePeriodEnd(rates: HouseMaintenanceRate[], index: number): string | null {
  const next = rates[index + 1];
  if (!next) return null;
  const date = new Date(`${next.effectiveFrom}T00:00:00`);
  date.setDate(date.getDate() - 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type CostHeadProgress = {
  category: string;
  target: number | null;
  paid: number;
  remaining: number | null;
  pct: number;
};

export function paidByCategory(expenses: { category: string; amount: number }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of expenses) {
    map.set(row.category, (map.get(row.category) || 0) + row.amount);
  }
  return map;
}

export function buildCostHeadProgress(
  details: HouseDetailsPayload,
  purchaseExpenses: { category: string; amount: number }[],
): CostHeadProgress[] {
  const paid = paidByCategory(purchaseExpenses);
  const heads: { category: string; target: number | null }[] = [
    { category: "Down payment", target: details.downPaymentTarget },
    { category: "Corpus", target: details.corpusTarget },
    { category: "TDS", target: details.tdsTarget },
    { category: "Registration", target: details.registrationTarget },
    { category: "Stamp duty", target: details.stampDutyTarget },
    { category: "Raised request", target: null },
    { category: "Modification", target: null },
    { category: "Interior", target: null },
    { category: "Loan EMI", target: null },
    { category: "Other", target: null },
  ];

  return heads.map((head) => {
    const amount = paid.get(head.category) || 0;
    const target = head.target;
    const remaining = target === null ? null : Math.max(0, target - amount);
    const pct = target && target > 0 ? Math.min(100, (amount / target) * 100) : 0;
    return { category: head.category, target, paid: amount, remaining, pct };
  });
}

export type LegacySnapshotGap = {
  label: string;
  snapshot: number;
  ledger: number;
};

export function legacySnapshotGaps(
  details: HouseDetailsPayload,
  purchaseExpenses: { category: string; amount: number }[],
): LegacySnapshotGap[] {
  const paid = paidByCategory(purchaseExpenses);
  const pairs: { label: string; snapshot: number | null; category: string }[] = [
    { label: "Down payment", snapshot: details.legacyPaid.downPaymentPaid, category: "Down payment" },
    { label: "Corpus", snapshot: details.legacyPaid.corpusAmount, category: "Corpus" },
    { label: "TDS", snapshot: details.legacyPaid.tdsAmount, category: "TDS" },
    { label: "Registration", snapshot: details.legacyPaid.registrationCost, category: "Registration" },
    { label: "Stamp duty", snapshot: details.legacyPaid.stampDuty, category: "Stamp duty" },
    { label: "Raised request", snapshot: details.legacyPaid.raisedRequestPayments, category: "Raised request" },
    { label: "Modification", snapshot: details.legacyPaid.modificationAmount, category: "Modification" },
  ];

  return pairs.flatMap((pair) => {
    if (!pair.snapshot || pair.snapshot <= 0) return [];
    const ledger = paid.get(pair.category) || 0;
    if (pair.snapshot <= ledger + 0.01) return [];
    return [{ label: pair.label, snapshot: pair.snapshot, ledger }];
  });
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [yearRaw, monthRaw] = monthKey.split("-").map(Number);
  const date = new Date(yearRaw, monthRaw - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
