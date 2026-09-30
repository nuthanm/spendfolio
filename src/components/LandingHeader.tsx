"use client";

import Link from "next/link";
import { MobileNav } from "@/components/MobileNav";

const LANDING_NAV = [
  { href: "#features", label: "Features" },
  { href: "#privacy", label: "Privacy" },
  { href: "#faq", label: "FAQ" },
  { href: "#start", label: "Start" },
];

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/50 bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
        <a href="#home" className="shrink-0 text-lg font-bold tracking-tight text-ink">
          Spendfolio
        </a>
        <nav className="hidden items-center gap-7 text-sm text-ink-soft xl:flex">
          {LANDING_NAV.map((item) => (
            <a key={item.href} href={item.href} className="hover:text-ink">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <MobileNav items={LANDING_NAV} breakpointClassName="xl:hidden" />
          <Link href="/login" className="btn-secondary px-3 py-2 text-sm">
            Sign in
          </Link>
          <Link href="/dashboard" className="btn-primary hidden px-3 py-2 text-sm sm:inline-flex">
            Open app
          </Link>
        </div>
      </div>
    </header>
  );
}
