export const WEALTH_MODULES = ["gold", "silver", "house"] as const;
export type WealthModule = (typeof WEALTH_MODULES)[number];

export const MODULE_ROUTES: Record<WealthModule, { href: string; label: string }> = {
  gold: { href: "/gold", label: "Gold" },
  silver: { href: "/silver", label: "Silver" },
  house: { href: "/house", label: "House" },
};

export function parseEnabledModules(raw: string): WealthModule[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((m): m is WealthModule =>
      WEALTH_MODULES.includes(m as WealthModule),
    );
  } catch {
    return [];
  }
}

export const HOUSE_CATEGORIES = [
  "Down Payment",
  "Registration",
  "EMI",
  "Maintenance",
  "Property Tax",
  "Renovation",
  "Insurance",
  "Utilities",
  "Legal",
  "Other",
] as const;

export type HouseCategory = (typeof HOUSE_CATEGORIES)[number];

export type LoanDetails = {
  bank?: string;
  interestRate?: number;
  principal?: number;
  emi?: number;
  tenureMonths?: number;
  startDate?: string;
};

export function parseLoanDetails(raw: string): LoanDetails {
  try {
    return JSON.parse(raw) as LoanDetails;
  } catch {
    return {};
  }
}
