import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const users = await prisma.user.count();
    const expenses = await prisma.expense.count();
    const incomes = await prisma.incomeSource.count();
    return NextResponse.json({ ok: true, users, expenses, incomes });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
