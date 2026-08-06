export const HOUSE_EXPENSE_CATEGORIES = [
  "Down payment",
  "Raised request payment",
  "Modification amount",
  "TDS",
  "Corpus",
  "Registration cost",
  "Stamp duty",
  "Loan EMI",
  "Loan principal prepayment",
  "Interior design cost",
  "Interior execution cost",
  "Maintenance",
  "Maid",
  "Household expense",
  "House item purchase",
  "Housewarming",
  "Other",
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

export type HouseLoanSnapshot = {
  downPaymentTarget: number | null;
  downPaymentPaid: number | null;
  loanSanctionedAmount: number | null;
  loanOutstandingAmount: number | null;
  outstandingEmiMonths: number | null;
  raisedRequestPayments: number | null;
  modificationAmount: number | null;
  tdsAmount: number | null;
  corpusAmount: number | null;
  registrationCost: number | null;
  stampDuty: number | null;
};

export type HouseDetailsPayload = HouseLoanSnapshot & {
  contacts: HouseContact[];
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

export function defaultHouseDetails(): HouseDetailsPayload {
  return {
    downPaymentTarget: null,
    downPaymentPaid: null,
    loanSanctionedAmount: null,
    loanOutstandingAmount: null,
    outstandingEmiMonths: null,
    raisedRequestPayments: null,
    modificationAmount: null,
    tdsAmount: null,
    corpusAmount: null,
    registrationCost: null,
    stampDuty: null,
    contacts: [],
  };
}

export function parseHouseDetails(raw: string | null | undefined): HouseDetailsPayload {
  const base = defaultHouseDetails();
  if (!raw) return base;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const contactsRaw = Array.isArray(parsed.contacts) ? parsed.contacts : [];
    const contacts: HouseContact[] = contactsRaw
      .map((contact) => {
        if (!contact || typeof contact !== "object") return null;
        const row = contact as Record<string, unknown>;
        return {
          id: String(row.id || ""),
          department: String(row.department || ""),
          person: String(row.person || ""),
          phone: String(row.phone || ""),
          email: String(row.email || ""),
          notes: String(row.notes || ""),
        };
      })
      .filter((contact): contact is HouseContact => Boolean(contact && contact.id));

    return {
      downPaymentTarget: toNullableNumber(parsed.downPaymentTarget),
      downPaymentPaid: toNullableNumber(parsed.downPaymentPaid),
      loanSanctionedAmount: toNullableNumber(parsed.loanSanctionedAmount),
      loanOutstandingAmount: toNullableNumber(parsed.loanOutstandingAmount),
      outstandingEmiMonths: toNullableInt(parsed.outstandingEmiMonths),
      raisedRequestPayments: toNullableNumber(parsed.raisedRequestPayments),
      modificationAmount: toNullableNumber(parsed.modificationAmount),
      tdsAmount: toNullableNumber(parsed.tdsAmount),
      corpusAmount: toNullableNumber(parsed.corpusAmount),
      registrationCost: toNullableNumber(parsed.registrationCost),
      stampDuty: toNullableNumber(parsed.stampDuty),
      contacts,
    };
  } catch {
    return base;
  }
}

export function serializeHouseDetails(details: HouseDetailsPayload): string {
  return JSON.stringify(details);
}
