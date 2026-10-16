import { unlockViewLink, ViewAccessError, viewJson } from "@/lib/view-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { token?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return viewJson({ error: "Password is required." }, 400);
  }

  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!password.trim()) {
    return viewJson({ error: "Password is required." }, 400);
  }

  try {
    const result = await unlockViewLink(token, password);
    return viewJson({ ok: result.ok });
  } catch (error) {
    if (error instanceof ViewAccessError) {
      return viewJson({ error: error.message }, error.status);
    }
    throw error;
  }
}
