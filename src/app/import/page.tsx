"use client";

import { useState, useTransition } from "react";
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
};

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function mapRows(raw: Record<string, unknown>[]): PreviewRow[] {
  return raw
    .map((row) => {
      const entries = Object.entries(row).map(([k, v]) => [normalizeHeader(k), v] as const);
      const get = (...keys: string[]) => {
        for (const key of keys) {
          const hit = entries.find(([k]) => k === key || k.includes(key));
          if (hit && hit[1] != null && String(hit[1]).trim() !== "") return String(hit[1]).trim();
        }
        return "";
      };

      const dateRaw = get("date", "day");
      let date = dateRaw;
      if (dateRaw && /^\d+(\.\d+)?$/.test(dateRaw)) {
        const parsed = XLSX.SSF.parse_date_code(Number(dateRaw));
        if (parsed) {
          date = `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
        }
      }

      const amount = Number(String(get("amount", "spend", "expense")).replace(/[^\d.-]/g, "")) || 0;
      const remarks = get("remarks", "notes", "comment", "note");
      const renewalDate = get("renewal", "renewal date", "next renewal") || null;

      return {
        date: date.slice(0, 10),
        label: get("label", "kind", "category", "type") || "Other",
        amount,
        remarks,
        renewalDate,
      };
    })
    .filter((r) => r.date && r.amount >= 0);
}

export default function ImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleFile(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    setMessage(null);

    if (file.name.toLowerCase().endsWith(".csv")) {
      const text = await file.text();
      const parsed = Papa.parse<Record<string, unknown>>(text, {
        header: true,
        skipEmptyLines: true,
      });
      setRows(mapRows(parsed.data));
      setStep("preview");
      return;
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    setRows(mapRows(json));
    setStep("preview");
  }

  return (
    <AppShell
      title="Import existing file"
      subtitle="Upload your Excel/CSV, review how Spendfolio maps each column, then commit only when it looks right."
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
            Supports .xlsx / .csv with columns like Date, Amount, Label, Remarks
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
              Mapped {rows.length} rows. Review before inserting.
            </p>
          </div>

          <div className="overflow-x-auto border border-line bg-white/50">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line bg-paper-deep/60 font-mono text-[11px] uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Label</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Remarks</th>
                  <th className="px-4 py-3">Renewal</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((row, i) => (
                  <tr key={i} className="border-b border-line/60">
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

          {message ? <p className="text-sm text-coral">{message}</p> : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={pending || rows.length === 0}
              className="btn-primary px-6 py-3 text-sm font-medium disabled:opacity-60"
              onClick={() =>
                startTransition(async () => {
                  const res = await commitImportRows(rows);
                  if (res?.error) setMessage(res.error);
                  else setStep("done");
                })
              }
            >
              Looks good — insert into Spendfolio
            </button>
            <button
              type="button"
              className="btn-secondary px-6 py-3 text-sm"
              onClick={() => {
                setStep("upload");
                setFileName(null);
                setRows([]);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {step === "done" ? (
        <div className="border border-mint/40 bg-mint/5 p-8 anim-rise-delay-1">
          <p className="text-2xl font-bold text-ink">Import committed</p>
          <p className="mt-2 text-ink-soft">
            {rows.length} rows inserted into your ledger. Renewals will appear on the dashboard
            when due.
          </p>
          <button
            type="button"
            className="btn-secondary mt-6 px-5 py-2 text-sm"
            onClick={() => {
              setStep("upload");
              setFileName(null);
              setRows([]);
            }}
          >
            Import another file
          </button>
        </div>
      ) : null}
    </AppShell>
  );
}
