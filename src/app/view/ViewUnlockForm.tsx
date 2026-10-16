"use client";

import { useState } from "react";

export function ViewUnlockForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch("/api/view/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(data.error || "Could not open this view.");
      setPending(false);
      return;
    }
    window.location.assign(`/view/${token}`);
  }

  return (
    <form className="mx-auto max-w-md border border-line bg-white/50 p-5" onSubmit={onSubmit}>
      <h1 className="text-2xl font-bold text-ink">Private view</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Enter the view password. This opens a read-only copy of expenses, categories, and summaries.
      </p>
      <label className="mt-5 block">
        <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
          Password
        </span>
        <input
          className="field font-mono"
          type="password"
          autoComplete="off"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {error ? <p className="mt-3 text-sm text-coral">{error}</p> : null}
      <button
        type="submit"
        className="btn-primary mt-5 w-full py-3 text-sm font-medium disabled:opacity-60"
        disabled={pending}
      >
        {pending ? "Checking…" : "Open view"}
      </button>
    </form>
  );
}
