import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatINR } from "@/lib/finance";
import { getViewAccess, loadViewExpense, loadViewFieldDefs, viewLinkIsActive } from "@/lib/view-access";
import { ViewShell } from "@/app/view/ViewShell";

export const dynamic = "force-dynamic";

function readCustom(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore malformed custom fields
  }
  return {};
}

function displayValue(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value == null || value === "") return "—";
  return String(value);
}

export default async function ViewExpensePage({
  params,
}: {
  params: Promise<{ token: string; id: string }>;
}) {
  noStore();
  const { token, id } = await params;
  const active = await viewLinkIsActive(token);
  if (!active) {
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

  const access = await getViewAccess(token);
  if (!access) redirect(`/view/${token.trim().toLowerCase()}`);

  const [expense, fields] = await Promise.all([
    loadViewExpense(access.userId, id),
    loadViewFieldDefs(access.userId),
  ]);
  if (!expense) notFound();

  const custom = readCustom(expense.customFields || "{}");
  const known = new Set(fields.map((field) => field.id));
  const normalized = token.trim().toLowerCase();

  return (
    <ViewShell ownerName={access.ownerName} token={normalized} showLeave>
      <article className="mx-auto max-w-2xl border border-line bg-white/50 p-5">
        <Link href={`/view/${normalized}#expenses`} className="font-mono text-xs text-mint">
          Back to expenses
        </Link>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-ink-soft">Expense</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">{expense.label}</h1>
        <p className="mt-3 font-mono text-2xl font-semibold text-ink">{formatINR(expense.amount)}</p>
        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Date</dt>
            <dd className="font-mono text-ink">{expense.date}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Category</dt>
            <dd className="text-ink">{expense.label}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Recurring</dt>
            <dd className="text-ink">{expense.recurring ? "Yes" : "No"}</dd>
          </div>
          {expense.renewalDate ? (
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Next date</dt>
              <dd className="font-mono text-ink">{expense.renewalDate}</dd>
            </div>
          ) : null}
        </dl>
        {expense.remarks ? <p className="mt-6 text-sm text-ink-soft">{expense.remarks}</p> : null}
        {fields.length > 0 || Object.keys(custom).length > 0 ? (
          <dl className="mt-6 space-y-3 border-t border-line pt-4 text-sm">
            {fields.map((field) => (
              <div key={field.id} className="flex justify-between gap-4">
                <dt className="text-ink-soft">{field.label}</dt>
                <dd className="text-right text-ink">{displayValue(custom[field.id])}</dd>
              </div>
            ))}
            {Object.entries(custom)
              .filter(([key]) => !known.has(key))
              .map(([key, value]) => (
                <div key={key} className="flex justify-between gap-4">
                  <dt className="text-ink-soft">{key}</dt>
                  <dd className="text-right text-ink">{displayValue(value)}</dd>
                </div>
              ))}
          </dl>
        ) : null}
      </article>
    </ViewShell>
  );
}
