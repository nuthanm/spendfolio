export function monthKeyFromDate(dateStr: string) {
  return dateStr.slice(0, 7);
}

export function currentMonthKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function formatMonthLabel(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export function isMonthKey(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function getFinancialYearStartYear(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return month >= 4 ? year : year - 1;
}

export function buildFinancialYearMonths(startYear: number) {
  const months: string[] = [];
  for (let offset = 0; offset < 12; offset++) {
    const monthIndex = 3 + offset; // Apr is month index 3
    const year = startYear + Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    months.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return months;
}

export function formatFinancialYearLabel(startYear: number) {
  const endYearShort = String((startYear + 1) % 100).padStart(2, "0");
  return `FY ${startYear}-${endYearShort}`;
}

export function formatMonthShortLabel(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "short" });
}
