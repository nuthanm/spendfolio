"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

export function MobileNav({
  items,
  breakpointClassName = "md:hidden",
}: {
  items: NavItem[];
  /** Wrapper visibility — e.g. `md:hidden` or `xl:hidden`. */
  breakpointClassName?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      openRef.current?.focus();
    };
  }, [open]);

  const menu =
    open && mounted
      ? createPortal(
          <div
            id={panelId}
            className="mobile-nav-screen fixed inset-0 z-[100] flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            <div className="formula-wash absolute inset-0" aria-hidden />
            <div className="relative flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-line/60 px-5 py-4">
                <p className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-ink">
                  Spendfolio
                </p>
                <button
                  ref={closeRef}
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center border border-line/80 bg-white/50 text-ink transition-colors hover:border-mint hover:bg-white/80"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                >
                  <span aria-hidden className="relative block h-4 w-4">
                    <span className="absolute left-0 top-1/2 block h-0.5 w-full -translate-y-1/2 rotate-45 bg-current" />
                    <span className="absolute left-0 top-1/2 block h-0.5 w-full -translate-y-1/2 -rotate-45 bg-current" />
                  </span>
                </button>
              </div>

              <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-5 py-8">
                {items.map((item, index) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      data-active={active}
                      className={`mobile-nav-link anim-rise rounded-sm px-3 py-3.5 text-2xl font-semibold tracking-tight transition-colors ${
                        active ? "text-mint" : "text-ink hover:text-mint"
                      }`}
                      style={{ animationDelay: `${0.04 + index * 0.04}s` }}
                      onClick={() => setOpen(false)}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={breakpointClassName}>
      <button
        ref={openRef}
        type="button"
        className="mobile-nav-toggle inline-flex h-10 w-10 items-center justify-center border border-line/80 bg-white/50 text-ink transition-colors hover:border-mint hover:bg-white/80"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="sr-only">Menu</span>
        <span aria-hidden className="flex w-4 flex-col gap-1.5">
          <span className="block h-0.5 w-full bg-current" />
          <span className="block h-0.5 w-full bg-current" />
          <span className="block h-0.5 w-full bg-current" />
        </span>
      </button>
      {menu}
    </div>
  );
}
