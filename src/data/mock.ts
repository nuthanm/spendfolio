export type HealthStatus = "safe" | "tight" | "debt";

export const months = [
  "January 2026",
  "February 2026",
  "March 2026",
  "April 2026",
  "May 2026",
  "June 2026",
  "July 2026",
];

export const currentMonth = "July 2026";

export const incomeSources = [
  { id: "1", name: "Salary — Primary", amount: 82000, cadence: "Monthly", nextDate: "2026-08-01" },
  { id: "2", name: "Freelance design", amount: 14500, cadence: "Variable", nextDate: "2026-08-12" },
  { id: "3", name: "Interest (FD)", amount: 2100, cadence: "Monthly", nextDate: "2026-08-05" },
];

export const expenseLabels = [
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
];

export const expenses = [
  {
    id: "e1",
    date: "2026-07-28",
    label: "Domain renewal",
    amount: 1299,
    remarks: "bought nuthan.dev — next renewal 28 Jul 2027",
    renewalDate: "2027-07-28",
    highlight: false,
  },
  {
    id: "e2",
    date: "2026-07-30",
    label: "Subscription",
    amount: 649,
    remarks: "Cursor Pro — renews monthly",
    renewalDate: "2026-08-02",
    highlight: true,
  },
  {
    id: "e3",
    date: "2026-07-31",
    label: "Lunch",
    amount: 280,
    remarks: "Office cafeteria",
    renewalDate: null,
    highlight: false,
  },
  {
    id: "e4",
    date: "2026-07-29",
    label: "Recharge",
    amount: 399,
    remarks: "Airtel prepaid",
    renewalDate: "2026-08-28",
    highlight: false,
  },
  {
    id: "e5",
    date: "2026-07-27",
    label: "Groceries",
    amount: 2140,
    remarks: "Weekly stock",
    renewalDate: null,
    highlight: false,
  },
  {
    id: "e6",
    date: "2026-07-25",
    label: "Utilities",
    amount: 1860,
    remarks: "Electricity bill — due soon",
    renewalDate: "2026-08-03",
    highlight: true,
  },
  {
    id: "e7",
    date: "2026-07-24",
    label: "Breakfast",
    amount: 120,
    remarks: "",
    renewalDate: null,
    highlight: false,
  },
  {
    id: "e8",
    date: "2026-07-22",
    label: "Transport",
    amount: 860,
    remarks: "Metro + auto",
    renewalDate: null,
    highlight: false,
  },
];

export const spendTiles = [
  { label: "Food", amount: 12480, share: 28, tone: "mint" as const },
  { label: "Subscriptions", amount: 4890, share: 11, tone: "gold" as const },
  { label: "Transport", amount: 3120, share: 7, tone: "ink" as const },
  { label: "Utilities", amount: 5640, share: 13, tone: "coral" as const },
  { label: "Recharge", amount: 1197, share: 3, tone: "mint" as const },
  { label: "Domains & hosting", amount: 3897, share: 9, tone: "gold" as const },
  { label: "Groceries", amount: 8920, share: 20, tone: "ink" as const },
  { label: "Other", amount: 4016, share: 9, tone: "mint" as const },
];

export const monthSummary = {
  income: 98600,
  expenses: 44160,
  balance: 54440,
  status: "safe" as HealthStatus,
  statusLabel: "Safe buffer",
  statusNote: "You are spending 44.8% of income this month.",
};

export const renewals = [
  { id: "r1", title: "Cursor Pro", amount: 649, due: "Aug 2", daysLeft: 2 },
  { id: "r2", title: "Electricity", amount: 1860, due: "Aug 3", daysLeft: 3 },
  { id: "r3", title: "nuthan.dev domain", amount: 1299, due: "Jul 2027", daysLeft: 362 },
];

export const importPreviewRows = [
  { date: "2026-06-12", label: "Lunch", amount: 245, remarks: "Team outing" },
  { date: "2026-06-14", label: "Domain renewal", amount: 899, remarks: "portfolio site — renews Jun 2027" },
  { date: "2026-06-18", label: "Recharge", amount: 399, remarks: "" },
  { date: "2026-06-21", label: "Dinner", amount: 680, remarks: "Client dinner" },
  { date: "2026-06-28", label: "Subscription", amount: 499, remarks: "Spotify family" },
];

export function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}
