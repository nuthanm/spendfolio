import { destroyViewSession, viewJson } from "@/lib/view-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE() {
  await destroyViewSession();
  return viewJson({ ok: true });
}
