"use client";

import Link from "next/link";
import { FormulaField } from "@/components/FormulaField";
import { loginAction, registerAction } from "@/lib/actions/auth";
import { useState, useTransition } from "react";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="relative min-h-screen formula-wash">
      <FormulaField />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
        <Link href="/" className="mb-10 text-xl font-bold text-ink">
          Spendfolio
        </Link>

        <h1 className="text-3xl font-bold tracking-tight text-ink anim-rise">
          {mode === "login" ? "Sign in" : "Create account"}
        </h1>
        <p className="mt-2 text-ink-soft anim-rise-delay-1">
          {mode === "login"
            ? "Your ledger unlocks only after password + authenticator."
            : "Create your private ledger. Authenticator 2FA setup comes next."}
        </p>

        <form
          className="mt-8 space-y-4 anim-rise-delay-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setError(null);
            startTransition(async () => {
              const action = mode === "login" ? loginAction : registerAction;
              const res = await action(fd);
              if (res?.error) setError(res.error);
            });
          }}
        >
          <label className="block">
            <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
              Email
            </span>
            <input
              className="field"
              type="email"
              name="email"
              required
              autoComplete="username"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
              Password
            </span>
            <input
              className="field"
              type="password"
              name="password"
              required
              minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>
          {error ? <p className="text-sm text-coral">{error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="btn-primary w-full py-3 text-sm font-medium disabled:opacity-60"
          >
            {pending
              ? "Please wait…"
              : mode === "login"
                ? "Continue to 2FA"
                : "Create account & set up 2FA"}
          </button>
        </form>

        <button
          type="button"
          className="mt-6 text-left text-sm text-mint hover:underline"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
          }}
        >
          {mode === "login"
            ? "New here? Create an account"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
