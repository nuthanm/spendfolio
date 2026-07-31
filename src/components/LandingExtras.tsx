"use client";

import { useState } from "react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { TypingEquation } from "@/components/TypingEquation";

export function HeroLedgerVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div
        className="absolute -inset-6 -z-10 rounded-[2rem] opacity-70"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, rgba(36,176,137,0.25), transparent 55%), radial-gradient(circle at 80% 80%, rgba(184,137,45,0.18), transparent 50%)",
        }}
      />

      <div className="overflow-hidden border border-line/80 bg-white/70 shadow-[0_30px_80px_rgba(20,36,30,0.12)] backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-line/70 bg-paper-deep/50 px-4 py-3">
          <span className="text-sm font-bold text-ink">July ledger</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-mint">live math</span>
        </div>

        <div className="space-y-4 p-5">
          <TypingEquation />

          <div className="grid grid-cols-3 gap-3 border-y border-line/60 py-4">
            <MiniStat label="Income" value={98600} />
            <MiniStat label="Spent" value={44160} />
            <MiniStat label="Buffer" value={54440} mint />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-ink">Where it went</p>
              <span className="status-safe px-2 py-0.5 text-[11px] font-semibold">Safe</span>
            </div>
            <div className="space-y-2">
              {[
                { label: "Food", pct: 28 },
                { label: "Groceries", pct: 20 },
                { label: "Utilities", pct: 13 },
                { label: "Subscriptions", pct: 11 },
              ].map((row) => (
                <div key={row.label}>
                  <div className="mb-1 flex justify-between font-mono text-[10px] text-ink-soft">
                    <span>{row.label}</span>
                    <span>{row.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-paper-deep">
                    <div className="h-full bg-mint" style={{ width: `${row.pct * 2.5}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="highlight-renewal border border-line/60 px-3 py-2">
            <p className="text-xs font-medium text-ink">Cursor Pro renews in 2 days</p>
            <p className="font-mono text-[10px] text-ink-soft">₹649 · Aug 2</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  mint,
}: {
  label: string;
  value: number;
  mint?: boolean;
}) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-wider text-ink-soft">{label}</p>
      <p className={`mt-1 text-sm font-bold number-tick ${mint ? "text-mint" : "text-ink"}`}>
        <AnimatedNumber value={value} prefix="₹" duration={1600} />
      </p>
    </div>
  );
}

const FAQS = [
  {
    q: "Is my spending data private?",
    a: "Yes. Spendfolio is built so your ledger stays yours — login + authenticator 2FA, export anytime, and delete account when you want out. No shared spreadsheet exposure.",
  },
  {
    q: "Can I keep remarks like domain renewals?",
    a: "Every expense can carry free-form remarks and renewal dates. Upcoming renewals highlight on the dashboard so nothing slips.",
  },
  {
    q: "Can I customize the expense form?",
    a: "Yes. Add textboxes, dropdowns, checkboxes, textareas, dates, or numbers dynamically and bind them to each entry.",
  },
  {
    q: "What about my existing Excel file?",
    a: "Import CSV/Excel, preview the mapped rows, and only commit when the preview looks right — then it adjusts into your monthly ledger.",
  },
];

export function LandingFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-line border border-line bg-white/45">
      {FAQS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
            >
              <span className="font-medium text-ink">{item.q}</span>
              <span className="font-mono text-mint">{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen ? (
              <p className="px-5 pb-5 text-sm leading-relaxed text-ink-soft">{item.a}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
