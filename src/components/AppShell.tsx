"use client";

import { useEffect, useId, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/actions/auth";
import { getEnabledModules } from "@/lib/actions/modules";
import { MODULE_ROUTES, type WealthModule } from "@/lib/modules";
import { QuickAddSheet } from "@/components/QuickAddSheet";
import {
  BuildingIcon,
  CloseIcon,
  CoinsIcon,
  HomeIcon,
  ImportIcon,
  IncomeIcon,
  ListIcon,
  LogoutIcon,
  MoreIcon,
  PlusIcon,
  UserIcon,
} from "@/components/icons";

type NavItem = { href: string; label: string; Icon: ComponentType<{ size?: number }> };

const HOME: NavItem = { href: "/dashboard", label: "Home", Icon: HomeIcon };
const EXPENSES: NavItem = { href: "/expenses", label: "Expenses", Icon: ListIcon };
const INCOME: NavItem = { href: "/income", label: "Income", Icon: IncomeIcon };
const IMPORT: NavItem = { href: "/import", label: "Import", Icon: ImportIcon };
const ACCOUNT: NavItem = { href: "/account", label: "Account", Icon: UserIcon };

function moduleItem(module: WealthModule): NavItem {
  const route = MODULE_ROUTES[module];
  return { href: route.href, label: route.label, Icon: module === "house" ? BuildingIcon : CoinsIcon };
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppShell({
  children,
  title,
  subtitle,
  enabledModules,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Pass when the page already knows them; otherwise they are loaded here. */
  enabledModules?: WealthModule[];
}) {
  const pathname = usePathname();
  const [loadedModules, setLoadedModules] = useState<WealthModule[]>([]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (enabledModules) return;
    getEnabledModules().then(setLoadedModules).catch(() => setLoadedModules([]));
  }, [enabledModules]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const modules = (enabledModules ?? loadedModules).map(moduleItem);
  const sidebarNav = [HOME, INCOME, EXPENSES, ...modules, IMPORT, ACCOUNT];
  const moreNav = [...modules, IMPORT, ACCOUNT];
  const moreActive = moreNav.some((item) => isActive(pathname, item.href));

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }

  return (
    <div className="formula-wash min-h-screen md:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-3 focus:py-2 focus:text-on-ink"
      >
        Skip to content
      </a>

      {/* Desktop and tablet: sidebar */}
      <aside className="hidden shrink-0 border-r border-line/70 bg-white/45 backdrop-blur-md md:sticky md:top-0 md:flex md:h-dvh md:w-60 md:flex-col md:gap-6 md:px-4 md:py-6">
        <Link href="/dashboard" className="px-3 font-display text-2xl font-extrabold tracking-tight text-ink">
          Spendfolio
        </Link>
        <button
          type="button"
          onClick={() => setQuickAddOpen(true)}
          className="btn-primary flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold"
        >
          <PlusIcon size={18} />
          Add expense
        </button>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {sidebarNav.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
                  active ? "bg-paper-deep text-ink" : "text-ink-soft hover:bg-paper-deep/60 hover:text-ink"
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>
        <form action={logoutAction} className="mt-auto">
          <button
            type="submit"
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-ink-soft hover:bg-paper-deep/60 hover:text-ink"
          >
            <LogoutIcon size={18} />
            Log out
          </button>
        </form>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Phones: slim top bar */}
        <header className="flex items-center justify-between border-b border-line/60 bg-white/40 px-5 py-3 backdrop-blur-md md:hidden">
          <Link href="/dashboard" className="font-display text-xl font-bold tracking-tight text-ink">
            Spendfolio
          </Link>
        </header>

        <main id="main" className="mx-auto min-w-0 max-w-6xl px-5 pb-32 pt-6 sm:pt-8 md:px-8 md:pb-12">
          <div className="mb-6 anim-rise md:mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">{title}</h1>
            {subtitle ? <p className="mt-2 max-w-2xl text-ink-soft">{subtitle}</p> : null}
          </div>
          {children}
        </main>
      </div>

      {/* Phones: bottom tab bar with the add button in the middle */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-center border-t border-line bg-surface/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-md md:hidden"
      >
        <TabLink item={HOME} active={isActive(pathname, HOME.href)} />
        <TabLink item={EXPENSES} active={isActive(pathname, EXPENSES.href)} />
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setQuickAddOpen(true)}
            aria-label="Add expense"
            className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-on-ink shadow-[0_8px_20px_rgba(0,0,0,0.25)]"
          >
            <PlusIcon size={26} />
          </button>
        </div>
        <TabLink item={INCOME} active={isActive(pathname, INCOME.href)} />
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          className={`flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            moreActive ? "text-mint" : "text-ink-soft"
          }`}
        >
          <MoreIcon size={22} />
          More
        </button>
      </nav>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} items={moreNav} pathname={pathname} />

      <QuickAddSheet open={quickAddOpen} onClose={() => setQuickAddOpen(false)} onSaved={showToast} />

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-5 md:bottom-8">
        {toast ? (
          <p className="rounded-xl bg-ink px-4 py-3 text-sm font-medium text-on-ink shadow-[var(--shadow-soft)]">{toast}</p>
        ) : null}
      </div>
    </div>
  );
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  const { href, label, Icon } = item;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
        active ? "text-mint" : "text-ink-soft"
      }`}
    >
      <Icon size={22} />
      {label}
    </Link>
  );
}

function MoreSheet({
  open,
  onClose,
  items,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  pathname: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex flex-col gap-2 p-5 pb-7">
        <div className="mb-1 flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-semibold">
            More
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:bg-paper-deep"
          >
            <CloseIcon />
          </button>
        </div>
        {items.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-medium ${
                active ? "bg-paper-deep text-ink" : "text-ink hover:bg-paper-deep/60"
              }`}
            >
              <Icon size={20} />
              {label}
            </Link>
          );
        })}
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-base font-medium text-coral hover:bg-paper-deep/60"
          >
            <LogoutIcon size={20} />
            Log out
          </button>
        </form>
      </div>
    </dialog>
  );
}
