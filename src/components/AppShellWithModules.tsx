"use client";

import type { WealthModule } from "@/lib/modules";
import { AppShell } from "@/components/AppShell";

/** Kept for existing pages; the shell is shared with {@link AppShell}. */
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
  return (
    <AppShell title={title} subtitle={subtitle} enabledModules={enabledModules}>
      {children}
    </AppShell>
  );
}
