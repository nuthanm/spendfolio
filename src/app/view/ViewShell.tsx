"use client";

import { useState } from "react";

export function ViewShell({
  ownerName,
  token,
  showLeave = false,
  children,
}: {
  ownerName?: string | null;
  token?: string;
  showLeave?: boolean;
  children: React.ReactNode;
}) {
  const [leaving, setLeaving] = useState(false);

  async function leave() {
    if (!token) return;
    setLeaving(true);
    await fetch("/api/view/session", { method: "DELETE" });
    window.location.assign(`/view/${token}`);
  }

  return (
    <div className="formula-wash min-h-screen">
      <header className="border-b border-line/60 bg-white/40 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:py-4">
          <div>
            <p className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-ink">
              Spendfolio
            </p>
            <p className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">
              {ownerName ? `${ownerName} · View only` : "Private view"}
            </p>
          </div>
          {showLeave && token ? (
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <nav className="flex items-center gap-4 text-ink-soft">
                <a href={`/view/${token}#summaries`} className="hover:text-ink">
                  Summaries
                </a>
                <a href={`/view/${token}#categories`} className="hover:text-ink">
                  Categories
                </a>
                <a href={`/view/${token}#expenses`} className="hover:text-ink">
                  Expenses
                </a>
              </nav>
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-xs"
                disabled={leaving}
                onClick={leave}
              >
                {leaving ? "Leaving…" : "Leave view"}
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <main className="mx-auto min-w-0 max-w-6xl px-5 py-6 sm:py-8">{children}</main>
    </div>
  );
}
