import { getMetalHolding, getMetalTransactions } from "@/lib/actions/metal";
import { MetalPageClient } from "@/components/MetalPageClient";
import { AppShellWithModules } from "@/components/AppShellWithModules";
import { getEnabledModules } from "@/lib/actions/modules";
import { redirect } from "next/navigation";

export default async function SilverPage() {
  const enabled = await getEnabledModules();
  if (!enabled.includes("silver")) {
    redirect("/account");
  }

  const holding = await getMetalHolding("silver");
  const transactions = await getMetalTransactions("silver");

  return (
    <AppShellWithModules 
      title="Silver Accumulation" 
      subtitle="Track, buy, sell, and set goals for your silver holdings"
      enabledModules={enabled}
    >
      <div className="max-w-4xl mx-auto">
        <MetalPageClient metalType="silver" initialHolding={holding} initialTransactions={transactions} />
      </div>
    </AppShellWithModules>
  );
}
