"use client";

import { useMemo, useState, useTransition } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { AppShell } from "@/components/AppShell";
import { commitImportRows } from "@/lib/actions/expenses";
import { formatINR } from "@/lib/finance";

type Step = "upload" | "preview" | "done";
type PreviewRow = {
  date: string;
  label: string;
  amount: number;
  remarks: string;
  renewalDate: string | null;
  sheet?: string;
};

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).trim();
}

function parseDate(raw: string): string {
  if (!raw) return "";

  // Excel serial number
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const parsed = XLSX.SSF.parse_date_code(Number(raw));
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }

  // Already ISO-ish
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  // 04-June-2026 / 4 June 2026 / 04/June/2026
  const named = raw.match(
    /^(\d{1,2})[-\s/.]+([A-Za-z]+)[-\s/.]+(\d{4})$/,
  );
  if (named) {
    const day = Number(named[1]);
    const month = MONTHS[named[2].toLowerCase()];
    const year = Number(named[3]);
    if (month && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // 04-06-2026 or 04/06/2026 (assume DD-MM-YYYY for en-IN)
  const numeric = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    const year = Number(numeric[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const fallback = new Date(raw);
  if (!Number.isNaN(fallback.getTime())) {
    const y = fallback.getFullYear();
    const m = String(fallback.getMonth() + 1).padStart(2, "0");
    const d = String(fallback.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return "";
}

function getField(entries: [string, unknown][], ...keys: string[]) {
  for (const key of keys) {
    const hit = entries.find(([k]) => k === key || k.includes(key));
    if (hit && hit[1] != null && cellText(hit[1]) !== "") return cellText(hit[1]);
  }
  return "";
}

function mapRows(
  raw: Record<string, unknown>[],
  sheetName?: string,
): PreviewRow[] {
  const mapped: PreviewRow[] = [];
  let lastDate = "";

  for (const row of raw) {
    const entries = Object.entries(row).map(
      ([k, v]) => [normalizeHeader(String(k)), v] as [string, unknown],
    );

    // Skip totally empty spacer rows
    const hasAny = entries.some(([, v]) => cellText(v) !== "");
    if (!hasAny) continue;

    const dateRaw = getField(entries, "date", "day");
    const parsedDate = parseDate(dateRaw);
    if (parsedDate) lastDate = parsedDate;
    const date = parsedDate || lastDate;

    // "Expenses on" is the description column in the user's ledger
    const label =
      getField(
        entries,
        "expenses on",
        "expense on",
        "expense",
        "expenses",
        "description",
        "particulars",
        "item",
        "label",
        "kind",
        "category",
        "type",
      ) || "Other";

    const amountRaw = getField(entries, "amount", "spend", "value", "rs", "inr");
    const amount = Number(String(amountRaw).replace(/[^\d.-]/g, ""));
    const remarks = getField(entries, "remarks", "notes", "comment", "note");
    const renewalDate =
      parseDate(getField(entries, "renewal date", "renewal", "next renewal")) ||
      null;

    // Need a usable expense line: date + positive amount + label
    if (!date || !Number.isFinite(amount) || amount <= 0) continue;
    if (!label || /^date$/i.test(label)) continue;

    mapped.push({
      date,
      label,
      amount,
      remarks,
      renewalDate,
      sheet: sheetName,
    });
  }

  return mapped;
}

function readAllSheets(workbook: XLSX.WorkBook): PreviewRow[] {
  const all: PreviewRow[] = [];
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });
    all.push(...mapRows(json, name));
  }
  return all;
}

export default function ImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>("all");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visibleRows = useMemo(() => {
    if (activeSheet === "all") return rows;
    return rows.filter((r) => r.sheet === activeSheet);
  }, [rows, activeSheet]);

  async function handleFile(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    setMessage(null);
    setActiveSheet("all");

    if (file.name.toLowerCase().endsWith(".csv")) {
      const text = await file.text();
      const parsed = Papa.parse<Record<string, unknown>>(text, {
        header: true,
        skipEmptyLines: false,
      });
      const mapped = mapRows(parsed.data, "CSV");
      setSheetNames(["CSV"]);
      setRows(mapped);
      setStep("preview");
      return;
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, {
      type: "array",
      cellDates: true,
    });
    const mapped = readAllSheets(workbook);
    setSheetNames(workbook.SheetNames);
    setRows(mapped);
    setStep("preview");
  }

  function reset() {
    setStep("upload");
    setFileName(null);
    setRows([]);
    setSheetNames([]);
    setActiveSheet("all");
    setMessage(null);
  }

  return (
    <AppShell
      title="Import existing file"
      subtitle="Supports multi-sheet Excel ledgers like Date + Expenses on + Amount + Remarks — blank dates carry forward from the last filled day."
    >
      <ol className="mb-8 flex flex-wrap gap-3 font-mono text-xs anim-rise">
        {(
          [
            ["upload", "1 · Upload"],
            ["preview", "2 · Preview & map"],
            ["done", "3 · Inserted"],
          ] as const
        ).map(([key, label]) => (
          <li
            key={key}
            className={`border px-3 py-1.5 ${
              step === key ? "border-mint bg-mint/10 text-mint" : "border-line text-ink-soft"
            }`}
          >
            {label}
          </li>
        ))}
      </ol>

      {step === "upload" ? (
        <div className="border border-dashed border-line bg-white/40 p-10 text-center anim-rise-delay-1">
          <p className="text-lg font-semibold text-ink">Drop your ledger file</p>
          <p className="mt-2 text-sm text-ink-soft">
            .xlsx / .csv — columns like Date, Expenses on, Amount, Remarks. All sheets are
            imported.
          </p>
          <label className="btn-primary mt-6 inline-block cursor-pointer px-6 py-3 text-sm">
            Choose file
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      ) : null}

      {step === "preview" ? (
        <div className="space-y-6 anim-rise-delay-1">
          <div className="border border-line bg-white/50 p-5">
            <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">File</p>
            <p className="mt-1 font-medium text-ink">{fileName}</p>
            <p className="mt-3 text-sm text-ink-soft">
              Mapped {rows.length} expense rows
              {sheetNames.length > 1
                ? ` across ${sheetNames.length} sheets (${sheetNames.join(", ")})`
                : ""}
              . Blank dates were filled from the previous day. Review before inserting.
            </p>
            {sheetNames.length > 1 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`px-3 py-1.5 text-xs border ${
                    activeSheet === "all"
                      ? "border-mint bg-mint/10 text-mint"
                      : "border-line text-ink-soft"
                  }`}
                  onClick={() => setActiveSheet("all")}
                >
                  All sheets
                </button>
                {sheetNames.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={`px-3 py-1.5 text-xs border ${
                      activeSheet === name
                        ? "border-mint bg-mint/10 text-mint"
                        : "border-line text-ink-soft"
                    }`}
                    onClick={() => setActiveSheet(name)}
                  >
                    {name}
                    <span className="ml-1 font-mono opacity-70">
                      ({rows.filter((r) => r.sheet === name).length})
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="overflow-x-auto border border-line bg-white/50">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-line bg-paper-deep/60 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                <tr>
                  {sheetNames.length > 1 ? <th className="px-4 py-3">Sheet</th> : null}
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Label</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Remarks</th>
                  <th className="px-4 py-3">Renewal</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.slice(0, 100).map((row, i) => (
                  <tr key={`${row.sheet}-${row.date}-${row.label}-${i}`} className="border-b border-line/60">
                    {sheetNames.length > 1 ? (
                      <td className="px-4 py-3 font-mono text-xs text-ink-soft">{row.sheet}</td>
                    ) : null}
                    <td className="px-4 py-3 font-mono text-xs">{row.date}</td>
                    <td className="px-4 py-3">{row.label}</td>
                    <td className="px-4 py-3 font-mono">{formatINR(row.amount)}</td>
                    <td className="px-4 py-3 text-ink-soft">{row.remarks || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.renewalDate || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibleRows.length > 100 ? (
            <p className="font-mono text-xs text-ink-soft">
              Showing first 100 of {visibleRows.length} rows in this view.
            </p>
          ) : null}

          {message ? <p className="text-sm text-coral">{message}</p> : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={pending || rows.length === 0}
              className="btn-primary px-6 py-3 text-sm font-medium disabled:opacity-60"
              onClick={() =>
                startTransition(async () => {
                  const res = await commitImportRows(
                    rows.map(({ date, label, amount, remarks, renewalDate }) => ({
                      date,
                      label,
                      amount,
                      remarks,
                      renewalDate,
                    })),
                  );
                  if (res?.error) setMessage(res.error);
                  else setStep("done");
                })
              }
            >
              Looks good — insert {rows.length} rows
            </button>
            <button type="button" className="btn-secondary px-6 py-3 text-sm" onClick={reset}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {step === "done" ? (
        <div className="border border-mint/40 bg-mint/5 p-8 anim-rise-delay-1">
          <p className="text-2xl font-bold text-ink">Import committed</p>
          <p className="mt-2 text-ink-soft">
            {rows.length} rows inserted into your ledger
            {sheetNames.length > 1 ? ` from ${sheetNames.length} sheets` : ""}.
          </p>
          <button type="button" className="btn-secondary mt-6 px-5 py-2 text-sm" onClick={reset}>
            Import another file
          </button>
        </div>
      ) : null}
    </AppShell>
  );
}
