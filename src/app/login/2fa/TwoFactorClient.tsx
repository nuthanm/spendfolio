"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { getSetupQr, verify2faAction } from "@/lib/actions/auth";

export default function TwoFactorClient() {
  const search = useSearchParams();
  const isSetup = search.get("setup") === "1";
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [setup, setSetup] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (isSetup) {
      getSetupQr().then((data) => {
        if (data) setSetup({ qrDataUrl: data.qrDataUrl, secret: data.secret });
      });
    }
  }, [isSetup]);

  function updateDigit(index: number, value: string) {
    const v = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = v;
    setDigits(next);
    if (v && index < 5) refs.current[index + 1]?.focus();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const code = digits.join("");
    const fd = new FormData();
    fd.set("code", code);
    setError(null);
    startTransition(async () => {
      const res = await verify2faAction(fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="min-h-screen formula-wash">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
        <Link href="/login" className="mb-10 text-sm text-ink-soft hover:text-ink">
          ← Back
        </Link>

        <h1 className="text-3xl font-bold tracking-tight text-ink anim-rise">Authenticator</h1>
        <p className="mt-2 text-ink-soft anim-rise-delay-1">
          {isSetup
            ? "Scan the QR code in your authenticator app, then enter the 6-digit code."
            : "Enter the 6-digit code from your authenticator app."}
        </p>

        {setup ? (
          <div className="mt-6 border border-line bg-white/50 p-4 anim-rise-delay-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qrDataUrl} alt="2FA QR code" className="mx-auto h-44 w-44" />
            <p className="mt-3 break-all text-center font-mono text-[11px] text-ink-soft">
              {setup.secret}
            </p>
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="mt-8 anim-rise-delay-2">
          <div className="flex gap-2">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                className="field h-14 w-12 text-center font-mono text-xl"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => updateDigit(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !digits[i] && i > 0) {
                    refs.current[i - 1]?.focus();
                  }
                }}
                aria-label={`Digit ${i + 1}`}
              />
            ))}
          </div>
          {error ? <p className="mt-3 text-sm text-coral">{error}</p> : null}
          <button
            type="submit"
            disabled={pending || digits.join("").length !== 6}
            className="btn-primary mt-6 w-full py-3 text-sm font-medium disabled:opacity-60"
          >
            {pending ? "Verifying…" : "Verify & open ledger"}
          </button>
        </form>
      </div>
    </div>
  );
}
