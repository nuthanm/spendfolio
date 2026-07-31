import { Suspense } from "react";
import DashboardClient from "./DashboardClient";
import { AppShell } from "@/components/AppShell";

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Dashboard" subtitle="Loading your monthly math…">
          <p className="font-mono text-sm text-ink-soft">Calculating…</p>
        </AppShell>
      }
    >
      <DashboardClient />
    </Suspense>
  );
}
