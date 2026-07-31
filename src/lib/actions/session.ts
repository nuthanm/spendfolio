"use server";

import { getSessionUser as getUser } from "@/lib/auth";

export async function getSessionUser() {
  const user = await getUser();
  if (!user) return null;
  return { id: user.id, email: user.email, totpEnabled: user.totpEnabled };
}
