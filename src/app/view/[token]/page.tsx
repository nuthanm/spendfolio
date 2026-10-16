import { unstable_noStore as noStore } from "next/cache";
import DashboardClient from "@/app/dashboard/DashboardClient";
import ExpensesClient from "@/app/expenses/ExpensesClient";
import { formatINR } from "@/lib/finance";
import {
  getViewAccess,
  loadViewCategories,
  loadViewExpenses,
  loadViewFieldDefs,
  loadViewSummary,
  viewLinkIsActive,
} from "@/lib/view-access";
import { ViewShell } from "@/app/view/ViewShell";
import { ViewUnlockForm } from "@/app/view/ViewUnlockForm";

export const dynamic = "force-dynamic";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function InactiveView() {
  return (
    <ViewShell>
      <div className="mx-auto max-w-md border border-line bg-white/50 p-5">
        <h1 className="text-2xl font-bold text-ink">Private view</h1>
        <p className="mt-2 text-sm text-ink-soft">
          This view link is inactive. Ask the owner for a new link.
        </p>
      </div>
    </ViewShell>
  );
}

export default async function ViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ month?: string | string[]; fy?: string | string[] }>;
}) {
  noStore();
  const { token } = await params;
  const query = await searchParams;
  const active = await viewLinkIsActive(token);
  if (!active) return <InactiveView />;

  const access = await getViewAccess(token);
  if (!access) {
    return (
      <ViewShell>
        <ViewUnlockForm token={token.trim().toLowerCase()} />
      </ViewShell>
    );
  }

  const month = one(query.month);
  const fy = one(query.fy);
  const [summary, expenses, fields, categories] = await Promise.all([
    loadViewSummary(access.userId, month, fy),
    loadViewExpenses(access.userId),
    loadViewFieldDefs(access.userId),
    loadViewCategories(access.userId),
  ]);

  return (
    <ViewShell ownerName={access.ownerName} token={token.trim().toLowerCase()} showLeave>
      <section id="summaries">
        <DashboardClient
          readOnly
          initialData={summary}
          viewBasePath={`/view/${token.trim().toLowerCase()}`}
        />
      </section>

      <section id="categories" className="mt-10">
        <h2 className="text-xl font-bold text-ink">Categories</h2>
        <p className="mt-1 font-mono text-xs text-ink-soft">All expense labels for this ledger</p>
        {categories.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">No categories yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {categories.map((category) => (
              <li
                key={category.label}
                className="flex items-start justify-between gap-3 border border-line bg-white/50 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-ink">{category.label}</p>
                  <p className="font-mono text-[11px] text-ink-soft">
                    {category.count} {category.count === 1 ? "entry" : "entries"}
                  </p>
                </div>
                <p className="font-mono text-sm font-semibold">{formatINR(category.amount)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="expenses" className="mt-10">
        <ExpensesClient
          readOnly
          initialExpenses={expenses}
          initialFieldDefs={fields}
          viewToken={token.trim().toLowerCase()}
        />
      </section>
    </ViewShell>
  );
}
