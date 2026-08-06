"use client";

import { useEffect, useState, useTransition } from "react";
import { AppShell } from "@/components/AppShell";
import {
  changePasswordAction,
  deleteAccountAction,
  setTotpEnabledAction,
} from "@/lib/actions/auth";
import { exportAllData } from "@/lib/actions/dashboard";
import { getSessionUser } from "@/lib/actions/session";
import { getEnabledModules, setModuleEnabled } from "@/lib/actions/modules";
import type { WealthModule } from "@/lib/modules";
import { WEALTH_MODULES, MODULE_ROUTES } from "@/lib/modules";

export default function AccountPage() {
  const [twoFA, setTwoFA] = useState(true);
  const [email, setEmail] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [enabledModules, setEnabledModulesState] = useState<WealthModule[]>([]);

  useEffect(() => {
    getSessionUser().then((u) => {
      if (u) {
        setEmail(u.email);
        setTwoFA(u.totpEnabled);
      }
    });
    getEnabledModules().then(setEnabledModulesState);
  }, []);

  function downloadExport(format: "json" | "csv") {
    startTransition(async () => {
      const data = await exportAllData();
      if (format === "json") {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        triggerDownload(blob, `spendfolio-export-${Date.now()}.json`);
        setMessage("JSON export downloaded.");
        return;
      }

      const lines = [
        "date,label,amount,remarks,renewalDate",
        ...data.expenses.map(
          (e) =>
            `${e.date},${JSON.stringify(e.label)},${e.amount},${JSON.stringify(e.remarks)},${e.renewalDate || ""}`,
        ),
      ];
      const blob = new Blob([lines.join("\n")], { type: "text/csv" });
      triggerDownload(blob, `spendfolio-expenses-${Date.now()}.csv`);
      setMessage("CSV export downloaded.");
    });
  }

  return (
    <AppShell
      title="Account"
      subtitle="Export your data, manage 2FA, change password, or leave — your ledger stays under your control."
    >
      <p className="mb-6 font-mono text-sm text-ink-soft anim-rise">
        Signed in as <span className="text-ink">{email || "…"}</span>
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border border-line bg-white/50 p-5 anim-rise">
          <h2 className="text-lg font-bold text-ink">Wealth modules</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Enable Gold, Silver, or House tracking to get started.
          </p>
          <div className="mt-4 space-y-2">
            {WEALTH_MODULES.map((module) => (
              <label key={module} className="flex items-center gap-3 rounded border border-line/60 bg-white/40 p-3 cursor-pointer hover:bg-white/50">
                <input
                  type="checkbox"
                  checked={enabledModules.includes(module)}
                  onChange={(e) =>
                    startTransition(async () => {
                      const res = await setModuleEnabled(module, e.target.checked);
                      if (res.ok) {
                        setEnabledModulesState(res.enabled);
                        setMessage(`${MODULE_ROUTES[module].label} ${e.target.checked ? "enabled" : "disabled"}.`);
                      } else {
                        setMessage(res.error);
                      }
                    })
                  }
                  className="h-4 w-4 rounded border-line/60 cursor-pointer"
                  disabled={pending}
                />
                <div>
                  <p className="font-medium text-ink">{MODULE_ROUTES[module].label}</p>
                  <p className="text-xs text-ink-soft">
                    {module === "gold" && "Track gold accumulation, goals, and profit/loss on sales"}
                    {module === "silver" && "Track silver accumulation, goals, and profit/loss on sales"}
                    {module === "house" && "Track house down payment and expenses"}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </section>

        <section className="border border-line bg-white/50 p-5 anim-rise-delay-1">
          <h2 className="text-lg font-bold text-ink">Export data</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Download income, expenses, and custom fields — for your backup, not a shared suite.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary px-4 py-2 text-sm"
              disabled={pending}
              onClick={() => downloadExport("csv")}
            >
              Export CSV
            </button>
            <button
              type="button"
              className="btn-secondary px-4 py-2 text-sm"
              disabled={pending}
              onClick={() => downloadExport("json")}
            >
              Export JSON
            </button>
          </div>
        </section>

        <section className="border border-line bg-white/50 p-5 anim-rise-delay-2">
          <h2 className="text-lg font-bold text-ink">Two-factor authentication</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Authenticator app required on every login when enabled.
          </p>
          <div className="mt-4 flex items-center justify-between gap-4 border border-line px-4 py-3">
            <div>
              <p className="font-medium text-ink">Authenticator 2FA</p>
              <p className="font-mono text-xs text-ink-soft">
                {twoFA ? "Enabled" : "Disabled"}
              </p>
            </div>
            {twoFA ? (
              <div className="flex flex-col items-end gap-2">
                <input
                  className="field w-32 font-mono text-sm"
                  placeholder="2FA code"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
                <button
                  type="button"
                  className="btn-secondary px-4 py-2 text-sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await setTotpEnabledAction(false, disableCode);
                      if (res.error) setMessage(res.error);
                      else {
                        setTwoFA(false);
                        setMessage("2FA disabled.");
                        setDisableCode("");
                      }
                    })
                  }
                >
                  Disable
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn-primary px-4 py-2 text-sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await setTotpEnabledAction(true);
                    if (res.error) setMessage(res.error);
                    else {
                      setTwoFA(true);
                      setQr(res.qrDataUrl || null);
                      setMessage("2FA enabled — scan QR if shown.");
                    }
                  })
                }
              >
                Enable
              </button>
            )}
          </div>
          {qr ? (
            <div className="mt-4 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="2FA QR" className="mx-auto h-40 w-40" />
            </div>
          ) : null}
        </section>

        <section className="border border-line bg-white/50 p-5 anim-rise-delay-3">
          <h2 className="text-lg font-bold text-ink">Change password</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Password changes always ask for a fresh 2FA code when 2FA is on.
          </p>

          {!changingPassword ? (
            <button
              type="button"
              className="btn-secondary mt-4 px-4 py-2 text-sm"
              onClick={() => setChangingPassword(true)}
            >
              Start password change
            </button>
          ) : (
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                startTransition(async () => {
                  const res = await changePasswordAction(fd);
                  if (res.error) setMessage(res.error);
                  else {
                    setMessage("Password updated.");
                    setChangingPassword(false);
                  }
                });
              }}
            >
              <input className="field" type="password" name="current" placeholder="Current password" required />
              <input className="field" type="password" name="next" placeholder="New password" minLength={8} required />
              <input className="field font-mono" name="code" placeholder="2FA code" required />
              <div className="flex gap-2">
                <button type="submit" className="btn-primary px-4 py-2 text-sm" disabled={pending}>
                  Confirm with 2FA
                </button>
                <button
                  type="button"
                  className="btn-secondary px-4 py-2 text-sm"
                  onClick={() => setChangingPassword(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="border border-coral/30 bg-coral/5 p-5 anim-rise-delay-4">
          <h2 className="text-lg font-bold text-ink">Delete account</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Permanently removes your ledger. Export first if you need a copy.
          </p>
          {!confirmDelete ? (
            <button
              type="button"
              className="mt-4 border border-coral px-4 py-2 text-sm text-coral"
              onClick={() => setConfirmDelete(true)}
            >
              Delete account
            </button>
          ) : (
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                startTransition(async () => {
                  const res = await deleteAccountAction(fd);
                  if (res?.error) setMessage(res.error);
                });
              }}
            >
              <p className="text-sm text-coral">Type DELETE and enter 2FA to confirm.</p>
              <input className="field" name="confirm" placeholder="DELETE" required />
              <input className="field font-mono" name="code" placeholder="2FA code" required />
              <div className="flex gap-2">
                <button type="submit" className="bg-coral px-4 py-2 text-sm text-white" disabled={pending}>
                  Confirm delete
                </button>
                <button
                  type="button"
                  className="btn-secondary px-4 py-2 text-sm"
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep account
                </button>
              </div>
            </form>
          )}
        </section>
      </div>

      {message ? (
        <p className="mt-6 border border-line bg-white/60 px-4 py-3 font-mono text-sm text-ink">
          {message}
        </p>
      ) : null}

      <p className="mt-8 font-mono text-xs text-ink-soft">
        Logout invalidates the session token in the database. Returning always requires password +
        2FA again.
      </p>
    </AppShell>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
