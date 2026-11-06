import { shiftMonthKey } from "@/lib/house";

export const MONTH_OPTIONS = [
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

export function NumberField({
  label,
  value,
  onChange,
  readOnly,
  hint,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-ink-soft">{label}</span>
      <input
        className="field"
        type="number"
        step="any"
        value={value}
        readOnly={readOnly}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      />
      {hint ? <span className="mt-1 block text-[11px] text-ink-soft">{hint}</span> : null}
    </label>
  );
}

export function formatEntryDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function MonthNavigator({
  monthKey,
  onChange,
}: {
  monthKey: string;
  onChange: (monthKey: string) => void;
}) {
  const [year, month] = monthKey.split("-");
  const current = new Date().getFullYear();
  const years = new Set<number>();
  for (let value = current - 12; value <= current + 1; value += 1) years.add(value);
  if (year) years.add(Number(year));

  return (
    <div className="flex flex-wrap items-end gap-2">
      <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => onChange(shiftMonthKey(monthKey, -1))}>
        Previous
      </button>
      <label className="block">
        <span className="mb-1 block text-xs text-ink-soft">Month</span>
        <select className="field" value={month} onChange={(e) => onChange(`${year}-${e.target.value}`)}>
          {MONTH_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-ink-soft">Year</span>
        <select
          className="field"
          value={year}
          onChange={(e) => onChange(`${e.target.value}-${month || "01"}`)}
        >
          {[...years]
            .sort((a, b) => b - a)
            .map((value) => (
              <option key={value} value={String(value)}>
                {value}
              </option>
            ))}
        </select>
      </label>
      <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => onChange(shiftMonthKey(monthKey, 1))}>
        Next
      </button>
    </div>
  );
}

export function toInput(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

export function formatSqft(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })} sqft`;
}
