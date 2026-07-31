export const DEFAULT_EXPENSE_LABELS = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Recharge",
  "Transport",
  "Groceries",
  "Domain renewal",
  "Subscription",
  "Utilities",
  "Health",
  "Other",
] as const;

export type HealthStatus = "safe" | "tight" | "debt";

export function computeHealth(income: number, expenses: number): {
  status: HealthStatus;
  label: string;
  note: string;
  balance: number;
  ratio: number;
} {
  const balance = income - expenses;
  const ratio = income > 0 ? expenses / income : expenses > 0 ? 1 : 0;

  if (balance < 0) {
    return {
      status: "debt",
      label: "In debt",
      note: `Expenses exceed income by ${Math.abs(balance).toLocaleString("en-IN")}.`,
      balance,
      ratio,
    };
  }
  if (ratio >= 0.85) {
    return {
      status: "tight",
      label: "Tight buffer",
      note: `You are spending ${(ratio * 100).toFixed(1)}% of income this month.`,
      balance,
      ratio,
    };
  }
  return {
    status: "safe",
    label: "Safe buffer",
    note: `You are spending ${(ratio * 100).toFixed(1)}% of income this month.`,
    balance,
    ratio,
  };
}

export function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function daysUntil(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
