import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShellWithModules } from "@/components/AppShellWithModules";
import { getEnabledModules } from "@/lib/actions/modules";
import { HousePageClient } from "@/components/HousePageClient";
import { getHouseTrackerData } from "@/lib/actions/house";

export default async function HousePage({
  searchParams,
}: {
  searchParams?: Promise<{ id?: string }>;
}) {
  const enabled = await getEnabledModules();
  if (!enabled.includes("house")) {
    redirect("/account");
  }

  const params = (await searchParams) ?? {};
  const data = await getHouseTrackerData(params.id);

  return (
    <AppShellWithModules
      title="House Tracking"
      subtitle="Pick a house, then see purchase costs, maintenance, taxes, bills, food, and transport in one dashboard."
      enabledModules={enabled}
    >
      <Suspense fallback={<p className="font-mono text-sm text-ink-soft">Loading house tracker…</p>}>
        <HousePageClient initialData={data} />
      </Suspense>
    </AppShellWithModules>
  );
}
