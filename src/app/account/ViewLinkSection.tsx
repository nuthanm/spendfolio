"use client";

import { useEffect, useState } from "react";

type ViewLinkStatus =
  | { active: false }
  | {
      active: true;
      createdAt: string;
      lastViewedAt: string | null;
      lockedUntil: string | null;
    };

type Issued = {
  path: string;
  password: string;
  createdAt: string;
};

function formatWhen(value: string | null) {
  if (!value) return "Not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not yet";
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function ViewLinkSection() {
  const [status, setStatus] = useState<ViewLinkStatus | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [fullUrl, setFullUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);

  async function loadStatus() {
    const response = await fetch("/api/view-links", { cache: "no-store" });
    if (!response.ok) {
      setMessage("Could not load the view link.");
      return;
    }
    const data = (await response.json()) as ViewLinkStatus;
    setStatus(data);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/view-links", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("status");
        return (await response.json()) as ViewLinkStatus;
      })
      .then((data) => {
        if (active) setStatus(data);
      })
      .catch(() => {
        if (active) setMessage("Could not load the view link.");
      });
    return () => {
      active = false;
    };
  }, []);

  async function generate() {
    setPending(true);
    setMessage(null);
    const response = await fetch("/api/view-links", { method: "POST" });
    const data = (await response.json().catch(() => ({}))) as Issued & { error?: string };
    if (!response.ok) {
      setMessage(data.error || "Could not create a view link.");
      setPending(false);
      return;
    }
    const url = `${window.location.origin}${data.path}`;
    setIssued({ path: data.path, password: data.password, createdAt: data.createdAt });
    setFullUrl(url);
    setConfirmReplace(false);
    setConfirmRevoke(false);
    setMessage("Password shown once. It cannot be displayed again.");
    await loadStatus();
    setPending(false);
  }

  async function revoke() {
    setPending(true);
    setMessage(null);
    const response = await fetch("/api/view-links", { method: "DELETE" });
    const data = (await response.json().catch(() => ({}))) as { error?: string; revoked?: boolean };
    if (!response.ok) {
      setMessage(data.error || "Could not revoke the view link.");
      setPending(false);
      return;
    }
    setIssued(null);
    setFullUrl("");
    setConfirmRevoke(false);
    setConfirmReplace(false);
    setMessage(data.revoked ? "View link revoked." : "There was no active view link.");
    await loadStatus();
    setPending(false);
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`${label} copied.`);
    } catch {
      setMessage(`Could not copy the ${label.toLowerCase()}.`);
    }
  }

  return (
    <section className="border border-line bg-white/50 p-5 anim-rise lg:col-span-2">
      <h2 className="text-lg font-bold text-ink">Private view link</h2>
      <p className="mt-2 text-sm text-ink-soft">
        Share a read-only link to expenses, categories, and summaries. The viewer cannot add, edit,
        delete, or export. The password is shown only when you create the link.
      </p>

      {status == null ? (
        <p className="mt-4 font-mono text-xs text-ink-soft">Loading view link…</p>
      ) : status.active ? (
        <dl className="mt-4 grid gap-3 font-mono text-xs text-ink-soft sm:grid-cols-3">
          <div>
            <dt className="uppercase tracking-wider">Created</dt>
            <dd className="mt-1 text-ink">{formatWhen(status.createdAt)}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wider">Last viewed</dt>
            <dd className="mt-1 text-ink">{formatWhen(status.lastViewedAt)}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wider">Lock</dt>
            <dd className="mt-1 text-ink">
              {status.lockedUntil ? `Locked until ${formatWhen(status.lockedUntil)}` : "Open"}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-4 font-mono text-xs text-ink-soft">No active view link.</p>
      )}

      {issued ? (
        <div className="mt-4 border border-mint/40 bg-mint/5 p-4">
          <p className="text-sm font-medium text-ink">Save this password now. It cannot be shown again.</p>
          <p className="mt-3 break-all font-mono text-xs text-ink-soft">{fullUrl}</p>
          <p className="mt-2 font-mono text-sm text-ink">{issued.password}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => copy(fullUrl, "Link")}>
              Copy link
            </button>
            <button
              type="button"
              className="btn-secondary px-3 py-2 text-sm"
              onClick={() => copy(issued.password, "Password")}
            >
              Copy password
            </button>
            <button
              type="button"
              className="btn-secondary px-3 py-2 text-sm"
              onClick={() => copy(`View link: ${fullUrl}\nPassword: ${issued.password}`, "Link and password")}
            >
              Copy both
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {status == null ? null : !status.active ? (
          <button type="button" className="btn-primary px-4 py-2 text-sm" disabled={pending} onClick={generate}>
            Generate view link
          </button>
        ) : confirmReplace ? (
          <>
            <p className="w-full text-sm text-ink-soft">
              A new link revokes the current one and its password.
            </p>
            <button type="button" className="btn-primary px-4 py-2 text-sm" disabled={pending} onClick={generate}>
              Replace link
            </button>
            <button
              type="button"
              className="btn-secondary px-4 py-2 text-sm"
              disabled={pending}
              onClick={() => setConfirmReplace(false)}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn-secondary px-4 py-2 text-sm"
            disabled={pending}
            onClick={() => {
              setConfirmReplace(true);
              setConfirmRevoke(false);
            }}
          >
            Generate a new link
          </button>
        )}

        {status?.active && !confirmReplace ? (
          confirmRevoke ? (
            <>
              <p className="w-full text-sm text-coral">Revoke this link? Anyone using it will lose access.</p>
              <button type="button" className="bg-coral px-4 py-2 text-sm text-white" disabled={pending} onClick={revoke}>
                Confirm revoke
              </button>
              <button
                type="button"
                className="btn-secondary px-4 py-2 text-sm"
                disabled={pending}
                onClick={() => setConfirmRevoke(false)}
              >
                Keep link
              </button>
            </>
          ) : (
            <button
              type="button"
              className="border border-coral px-4 py-2 text-sm text-coral"
              disabled={pending}
              onClick={() => setConfirmRevoke(true)}
            >
              Revoke link
            </button>
          )
        ) : null}
      </div>

      {message ? <p className="mt-4 font-mono text-sm text-ink">{message}</p> : null}
    </section>
  );
}
