import { getSessionUser } from "@/lib/auth";
import {
  getViewLinkStatus,
  issueViewLink,
  revokeViewLink,
  viewJson,
} from "@/lib/view-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function owner() {
  const user = await getSessionUser();
  if (!user) return null;
  return user;
}

export async function GET() {
  const user = await owner();
  if (!user) return viewJson({ error: "Unauthorized" }, 401);
  const status = await getViewLinkStatus(user.id);
  return viewJson(status);
}

export async function POST() {
  const user = await owner();
  if (!user) return viewJson({ error: "Unauthorized" }, 401);
  const issued = await issueViewLink(user.id);
  return viewJson(issued);
}

export async function DELETE() {
  const user = await owner();
  if (!user) return viewJson({ error: "Unauthorized" }, 401);
  const revoked = await revokeViewLink(user.id);
  return viewJson({ revoked });
}
