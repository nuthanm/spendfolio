"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/actions/auth";
import type { WealthModule } from "@/lib/modules";
import { MODULE_ROUTES } from "@/lib/modules";

const BASE_NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/income", label: "Income" },
  { href: "/expenses", label: "Expenses" },
  { href: "/import", label: "Import" },
  { href: "/account", label: "Account" },
];

export function AppShellWithModules({
  children,
  title,
  subtitle,
  enabledModules = [],
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  enabledModules?: WealthModule[];
}) {
  const pathname = usePathname();

  // Build nav with enabled modules
  const nav = [
    ...BASE_NAV.slice(0, 3), // Dashboard, Income, Expenses
    ...enabledModules.map((m) => ({
      href: MODULE_ROUTES[m].href,
      label: MODULE_ROUTES[m].label,
    })),
    ...BASE_NAV.slice(3), // Import, Account
  ];

  return (
    <div className="formula-wash min-h-screen">
      <header className="border-b border-line/60 bg-white/40 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link
            href="/dashboard"
            className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-ink"
          >
            Spendfolio
          </Link>
          <nav className="app-nav hidden items-center gap-6 text-sm text-ink-soft md:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                data-active={pathname === item.href}
                className="relative transition-colors hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <form action={logoutAction}>
            <button type="submit" className="btn-secondary px-3 py-1.5 text-xs">
              Log out
            </button>
          </form>
        </div>
        <div className="flex gap-3 overflow-x-auto border-t border-line/40 px-5 py-2 md:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap text-xs ${
                pathname === item.href ? "text-mint" : "text-ink-soft"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-8 anim-rise">
          <h1 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">{title}</h1>
          {subtitle ? <p className="mt-2 max-w-2xl text-ink-soft">{subtitle}</p> : null}
        </div>
        {children}
      </main>
    </div>
  );
}
