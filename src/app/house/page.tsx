import { redirect } from "next/navigation";
import { AppShellWithModules } from "@/components/AppShellWithModules";
import { getEnabledModules } from "@/lib/actions/modules";
import { HousePageClient } from "@/components/HousePageClient";
import { getHouseTrackerData } from "@/lib/actions/house";

export default async function HousePage() {
  const enabled = await getEnabledModules();
  if (!enabled.includes("house")) {
    redirect("/account");
  }

  const data = await getHouseTrackerData();

  return (
    <AppShellWithModules
      title="House Tracking"
      subtitle="Track down payment, loan outstanding/EMI months, interior costs, contacts, and all home expenses in one place."
      enabledModules={enabled}
    >
      <HousePageClient initialData={data} />
    </AppShellWithModules>
  );
}
