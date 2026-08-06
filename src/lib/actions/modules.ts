"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  MODULE_ROUTES,
  parseEnabledModules,
  type WealthModule,
  WEALTH_MODULES,
} from "@/lib/modules";

export async function getEnabledModules(): Promise<WealthModule[]> {
  const user = await requireUser();
  const rows = await prisma.$queryRaw<{ enabledModules: string }[]>`
    SELECT "enabledModules"
    FROM "User"
    WHERE "id" = ${user.id}
    LIMIT 1
  `;
  return parseEnabledModules(rows[0]?.enabledModules ?? "[]");
}

export async function setModuleEnabled(module: WealthModule, enabled: boolean) {
  const user = await requireUser();
  if (!WEALTH_MODULES.includes(module)) {
    return { error: "Invalid module." };
  }

  const current = await getEnabledModules();
  const next = enabled
    ? [...new Set([...current, module])]
    : current.filter((m) => m !== module);

  await prisma.user.update({
    where: { id: user.id },
    data: { enabledModules: JSON.stringify(next) },
  });

  revalidatePath("/account");
  revalidatePath("/dashboard");
  for (const m of WEALTH_MODULES) {
    revalidatePath(MODULE_ROUTES[m].href);
  }
  return { ok: true as const, enabled: next };
}

export async function getNavItems() {
  const base = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/income", label: "Income" },
    { href: "/expenses", label: "Expenses" },
    { href: "/import", label: "Import" },
  ];
  const enabled = await getEnabledModules();
  const wealth = enabled.map((m) => MODULE_ROUTES[m]);
  return [...base, ...wealth, { href: "/account", label: "Account" }];
}
