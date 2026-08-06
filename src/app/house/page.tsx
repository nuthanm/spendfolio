import { redirect } from "next/navigation";
import { AppShellWithModules } from "@/components/AppShellWithModules";
import { getEnabledModules } from "@/lib/actions/modules";

export default async function HousePage() {
  const enabled = await getEnabledModules();
  if (!enabled.includes("house")) {
    redirect("/account");
  }

  return (
    <AppShellWithModules
      title="House Tracking"
      subtitle="Keep your down payment plan, purchase costs, and home-related expenses in one place."
      enabledModules={enabled}
    >
      <div className="max-w-4xl border border-line bg-white/50 p-6 anim-rise">
        <h2 className="text-xl font-bold text-ink">House module is enabled</h2>
        <p className="mt-3 text-sm text-ink-soft">
          This route is now available from the header so the module is visible in the app.
          The detailed house workflow has not been built out yet, but you can reach the
          module page directly at any time from navigation.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="border border-line/60 bg-white/40 p-4">
            <p className="font-medium text-ink">Down payment</p>
            <p className="mt-2 text-sm text-ink-soft">
              Track your target amount and progress toward purchase readiness.
            </p>
          </div>
          <div className="border border-line/60 bg-white/40 p-4">
            <p className="font-medium text-ink">Purchase costs</p>
            <p className="mt-2 text-sm text-ink-soft">
              Keep registration, legal, tax, and setup costs grouped separately.
            </p>
          </div>
          <div className="border border-line/60 bg-white/40 p-4">
            <p className="font-medium text-ink">Ongoing expenses</p>
            <p className="mt-2 text-sm text-ink-soft">
              Use the route as the landing area for EMI, maintenance, and other house items.
            </p>
          </div>
        </div>
      </div>
    </AppShellWithModules>
  );
}
