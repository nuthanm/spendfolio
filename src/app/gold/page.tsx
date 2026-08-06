import { getMetalHolding, getMetalTransactions } from "@/lib/actions/metal";
import { MetalPageClient } from "@/components/MetalPageClient";
import { AppShellWithModules } from "@/components/AppShellWithModules";
import { getEnabledModules } from "@/lib/actions/modules";
import { redirect } from "next/navigation";

export default async function GoldPage() {
  const enabled = await getEnabledModules();
  if (!enabled.includes("gold")) {
    redirect("/account");
  }

  const holding = await getMetalHolding("gold");
  const transactions = await getMetalTransactions("gold");

  return (
    <AppShellWithModules 
      title="Gold Accumulation" 
      subtitle="Track, buy, sell, and set goals for your gold holdings"
      enabledModules={enabled}
    >
      <div className="max-w-4xl mx-auto">
        <MetalPageClient metalType="gold" initialHolding={holding} initialTransactions={transactions} />
      </div>
    </AppShellWithModules>
  );
}
